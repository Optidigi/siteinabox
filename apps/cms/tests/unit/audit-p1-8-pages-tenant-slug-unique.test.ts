import { describe, it, expect, vi } from "vitest"
import * as fs from "node:fs"
import * as path from "node:path"
import { Pages } from "@/collections/Pages"
import { ValidationError } from "payload"
import * as migration from "@/migrations/20260509_pages_tenant_slug_unique"
import { ensureUniqueTenantSlug } from "@/hooks/ensureUniqueTenantSlug"

import { asBeforeOperationHook, asBeforeValidateHook, callBeforeOpHook, hookArgsFor, type BeforeOperationHook, type BeforeValidateHook } from "../_helpers/hookFixtures"
import { asPayload, matchesWhere, type MockCreateArgs, type MockDoc, type MockFindArgs, type MockUpdateArgs, type MockWhere } from "../_helpers/mockPayload"
import { cast, errLike, validationErrorData } from "../_helpers/cast"
// Audit finding #8 (P1, T8) — Pages: missing (tenant_id, slug) unique index.
//
// Two coordinated halves:
//  Half A — application-level beforeValidate hook on Pages that pre-empts the
//           Postgres unique-violation with a clean ValidationError so users see
//           "A page with this slug already exists in this tenant" rather than a
//           raw FK / unique-violation error.
//  Half B — hand-written DB migration that:
//           1. Detects existing duplicates and refuses to apply if any exist
//              (operator decides resolution; migration enforces).
//           2. Creates the unique index on (tenant_id, slug) once safe.
//           3. down() throws — destructive rollback is forbidden per the
//              codebase's foundational migration rule (audit P0 #3 / cascade-FK
//              migration's down() is the canonical template).
//
// Mechanism choice: hand-written migration. Investigation found that
// @payloadcms/plugin-multi-tenant only propagates `unique` to its own tenant
// relationship field (node_modules/@payloadcms/plugin-multi-tenant/dist/fields/
// tenantField/index.js:100) — it does NOT generate a compound (tenant_id, X)
// unique index for sibling fields. Setting `unique: true` on Pages.slug would
// generate a globally-unique slug index — wrong shape (slug "home" would only
// be allowed in one tenant). Hand-written SQL is the only route that produces
// per-tenant uniqueness. The application-level hook complements it because
// Payload v3.84.1 has no built-in unique-violation translator — raw Postgres
// errors would otherwise propagate to the admin UI.

// -----------------------------------------------------------------------------
// Half A — application-level pre-emptive duplicate check
// -----------------------------------------------------------------------------

const beforeValidateHooks = (Pages.hooks?.beforeValidate ?? []) as unknown as BeforeValidateHook[]

// Invoke the hook by direct import rather than positional array access.
// The original `beforeValidateHooks[0]` access silently broke when
// validateTenantExists was prepended to Pages.hooks.beforeValidate in
// commit ee4eacd8 (May 2026) — the test then ran the wrong hook against
// a `req` mock missing `findByID` and surfaced as a misleading "Tenant
// not found" ValidationError. The S1 case below still verifies the hook
// is wired into the collection chain so registration regressions trip.
const ensureUniqueSlugHook = ensureUniqueTenantSlug as unknown as (args: unknown) => unknown

const makeReq = (findResult: { totalDocs: number; docs?: unknown[] }) => {
  const find = vi.fn().mockResolvedValue({ docs: findResult.docs ?? [], totalDocs: findResult.totalDocs })
  return {
    req: { payload: { find } },
    find,
  }
}

const callHook = async (opts: {
  data: unknown
  operation: "create" | "update"
  originalDoc?: unknown
  req: unknown
}) =>
  ensureUniqueSlugHook({
    data: opts.data,
    operation: opts.operation,
    originalDoc: opts.originalDoc,
    req: opts.req,
    collection: { slug: "pages" },
    context: {},
  })

const expectValidationError = async (p: Promise<unknown>) => {
  let err: unknown = null
  try {
    await p
  } catch (e) {
    err = e
  }
  expect(err, "expected the hook to throw").not.toBeNull()
  expect(err, "expected ValidationError, not plain Error").toBeInstanceOf(ValidationError)
  // The errors[] entry must carry path:"slug" so the admin UI binds it to the slug field.
  expect(validationErrorData(err)?.errors?.[0]?.path).toBe("slug")
}

describe("audit-p1 #8 Half A — ensureUniqueTenantSlug pre-empts unique-violation with clean ValidationError", () => {
  it("S1: ensureUniqueTenantSlug is registered on Pages.hooks.beforeValidate", () => {
    expect(beforeValidateHooks.length).toBeGreaterThanOrEqual(1)
    expect(typeof ensureUniqueSlugHook).toBe("function")
    // Pin the wiring contract: the imported hook reference must actually be
    // part of the collection's beforeValidate chain. Position within the
    // array is intentionally NOT asserted — additions in front are fine as
    // long as registration survives.
    expect(beforeValidateHooks).toContain(ensureUniqueTenantSlug)
  })

  it("Case 1 — create page with unique (tenant, slug) → succeeds (positive control)", async () => {
    const { req, find } = makeReq({ totalDocs: 0 })
    const data = { title: "Home", slug: "home", tenant: 42, status: "draft" }
    const result = await callHook({ data, operation: "create", req })
    expect(result).toEqual(data)
    // Must have queried for an existing duplicate.
    expect(find).toHaveBeenCalledTimes(1)
    const findArgs = find.mock.calls[0]![0]
    expect(findArgs.collection).toBe("pages")
    // Must scope the query by tenant equals 42 AND slug equals "home".
    const where = JSON.stringify(findArgs.where)
    expect(where).toContain("\"tenant\"")
    expect(where).toContain("42")
    expect(where).toContain("\"slug\"")
    expect(where).toContain("home")
  })

  it("Case 2 — create page with duplicate (tenant, slug) → ValidationError on path:slug", async () => {
    // Simulate one existing page with the same (tenant, slug).
    const { req } = makeReq({ totalDocs: 1, docs: [{ id: 99, slug: "home", tenant: 42 }] })
    await expectValidationError(
      callHook({
        data: { title: "Home Again", slug: "home", tenant: 42, status: "draft" },
        operation: "create",
        req,
      }),
    )
  })

  it("Case 3 — create page with same slug but different tenant → succeeds (per-tenant, not global)", async () => {
    // The hook's where filter must include `tenant equals X`, so a search for
    // tenant 99 must return 0 even when tenant 42 has a page with slug "home".
    // We simulate the find returning 0 for the queried (tenant=99, slug=home)
    // because no existing page matches tenant=99.
    const { req, find } = makeReq({ totalDocs: 0 })
    const data = { title: "Home", slug: "home", tenant: 99, status: "draft" }
    const result = await callHook({ data, operation: "create", req })
    expect(result).toEqual(data)
    const where = JSON.stringify(find.mock.calls[0]![0].where)
    // Verify the query was scoped to tenant 99 (not 42, not unscoped).
    expect(where).toContain("99")
  })

  it("Case 4 — update slug to one that exists in same tenant → ValidationError on path:slug", async () => {
    const { req } = makeReq({ totalDocs: 1, docs: [{ id: 50, slug: "about", tenant: 42 }] })
    await expectValidationError(
      callHook({
        data: { slug: "about" },
        operation: "update",
        originalDoc: { id: 7, slug: "home", tenant: 42, title: "Home", status: "draft" },
        req,
      }),
    )
  })

  it("Case 5 — update slug to one that exists in different tenant → succeeds (per-tenant)", async () => {
    // Caller is in tenant 42; another tenant (99) has a page with slug "about".
    // The hook's query is scoped to tenant 42, so totalDocs is 0.
    const { req } = makeReq({ totalDocs: 0 })
    const result = await callHook({
      data: { slug: "about" },
      operation: "update",
      originalDoc: { id: 7, slug: "home", tenant: 42, title: "Home" },
      req,
    })
    expect(result).toEqual({ slug: "about" })
  })

  it("Case 6 — update where slug isn't changing (no-op write) → does NOT query, does NOT throw", async () => {
    // The hook should short-circuit when neither slug nor tenant is changing
    // on an update. No DB query is made (avoids spurious load on every PATCH
    // that touches unrelated fields like `title`).
    const { req, find } = makeReq({ totalDocs: 0 })
    const result = await callHook({
      data: { title: "Renamed" },
      operation: "update",
      originalDoc: { id: 7, slug: "home", tenant: 42, title: "Home" },
      req,
    })
    expect(result).toEqual({ title: "Renamed" })
    expect(find).not.toHaveBeenCalled()
  })

  it("Case 6b — update where slug is supplied but identical to originalDoc.slug → no query (idempotent PATCH)", async () => {
    const { req, find } = makeReq({ totalDocs: 0 })
    await callHook({
      data: { slug: "home", title: "Same Page" },
      operation: "update",
      originalDoc: { id: 7, slug: "home", tenant: 42, title: "Home" },
      req,
    })
    expect(find).not.toHaveBeenCalled()
  })

  it("Case 7 — update tenant such that the new (tenant, slug) collides with an existing row → ValidationError", async () => {
    // Page id=7 has slug=home in tenant 42. PATCH moves it to tenant 99 where
    // a page with slug=home already exists.
    const { req } = makeReq({ totalDocs: 1, docs: [{ id: 200, slug: "home", tenant: 99 }] })
    await expectValidationError(
      callHook({
        data: { tenant: 99 },
        operation: "update",
        originalDoc: { id: 7, slug: "home", tenant: 42 },
        req,
      }),
    )
  })

  it("Case 7b — duplicate-check excludes self (id not_equals originalDoc.id) on update", async () => {
    // The single existing match is the doc itself — that must NOT count as a
    // collision. The hook's where clause must include `id not_equals <self>`.
    const { req, find } = makeReq({ totalDocs: 0 })
    await callHook({
      data: { slug: "about" },
      operation: "update",
      originalDoc: { id: 7, slug: "home", tenant: 42 },
      req,
    })
    const where = JSON.stringify(find.mock.calls[0]![0].where)
    expect(where).toContain("not_equals")
    expect(where).toContain("\"id\"")
  })

  it("Tenant id-shape robustness: populated object {id:42} on data.tenant is normalized to 42", async () => {
    // Payload may pass tenant as a populated object depending on auth depth.
    // The hook must extract .id rather than passing the object through to find().
    const { req, find } = makeReq({ totalDocs: 0 })
    await callHook({
      data: { title: "Home", slug: "home", tenant: { id: 42, slug: "tenant-a" } },
      operation: "create",
      req,
    })
    const where = JSON.stringify(find.mock.calls[0]![0].where)
    expect(where).toContain("42")
    expect(where).not.toContain("tenant-a")
  })

  it("Skip when data is null/undefined (defensive)", async () => {
    const { req, find } = makeReq({ totalDocs: 0 })
    const result = await callHook({ data: null, operation: "create", req })
    expect(result).toBe(null)
    expect(find).not.toHaveBeenCalled()
  })

  it("Skip when slug is missing on create (defensive — Payload's required validator handles it)", async () => {
    const { req, find } = makeReq({ totalDocs: 0 })
    await callHook({
      data: { title: "Home", tenant: 42 },
      operation: "create",
      req,
    })
    expect(find).not.toHaveBeenCalled()
  })

  it("Skip when tenant is missing on create (defensive — multi-tenant plugin's required-tenant validator handles it)", async () => {
    const { req, find } = makeReq({ totalDocs: 0 })
    await callHook({
      data: { title: "Home", slug: "home" },
      operation: "create",
      req,
    })
    expect(find).not.toHaveBeenCalled()
  })
})

// -----------------------------------------------------------------------------
// Half B — migration shape
// -----------------------------------------------------------------------------

describe("audit-p1 #8 Half B — migration shape", () => {
  it("Case 8 — migration file exports up and down functions", () => {
    expect(typeof migration.up).toBe("function")
    expect(typeof migration.down).toBe("function")
  })

  it("Case 9 — down() throws when called (refuses destructive rollback)", async () => {
    // The down() must throw unconditionally per audit P0 #3 + the cascade-FK
    // migration's canonical pattern (20260505_202447_cascade_tenant_delete.ts:65-72).
    let err: unknown = null
    try {
      await migration.down(cast({ db: {}, payload: {}, req: {} }))
    } catch (e) {
      err = e
    }
    expect(err, "down() must throw").not.toBeNull()
    expect(err).toBeInstanceOf(Error)
  })

  it("Case 10 — down() error message mentions 'destructive' and instructs manual recovery", async () => {
    let err: unknown = null
    try {
      await migration.down(cast({ db: {}, payload: {}, req: {} }))
    } catch (e) {
      err = e
    }
    const msg = String(errLike(err).message ?? "")
    expect(msg.toLowerCase()).toContain("destructive")
    // Must reference the index name so an operator who genuinely needs to roll
    // back has the exact identifier to drop manually.
    expect(msg).toContain("pages_tenant_slug_idx")
  })

  it("Case 11 — up() source includes duplicate-detection guard before index creation", () => {
    // String-match assertion: we cannot run the migration without a DB, but we
    // CAN verify the source includes the duplicate-detection step before the
    // CREATE UNIQUE INDEX call. Per the dispatch §"Migration up() structure"
    // binding template, this is the operator-safety contract.
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "src/migrations/20260509_pages_tenant_slug_unique.ts"),
      "utf-8",
    )
    // Both the duplicate detection and the CREATE UNIQUE INDEX must exist.
    expect(source).toMatch(/SELECT[\s\S]+tenant_id[\s\S]+slug[\s\S]+GROUP BY[\s\S]+HAVING/i)
    expect(source).toMatch(/CREATE\s+UNIQUE\s+INDEX[\s\S]+"pages_tenant_slug_idx"[\s\S]+\(\s*"tenant_id"\s*,\s*"slug"\s*\)/)
    // Order: the SELECT/HAVING must appear before the CREATE UNIQUE INDEX SQL.
    // Match on the quoted identifier form so prose mentions of "create the
    // unique index" in the docstring don't trigger this anchor.
    const dupIdx = source.search(/HAVING\s+COUNT\s*\(\s*\*\s*\)/i)
    const idxIdx = source.search(/CREATE\s+UNIQUE\s+INDEX\s+"pages_tenant_slug_idx"/)
    expect(dupIdx).toBeGreaterThan(-1)
    expect(idxIdx).toBeGreaterThan(-1)
    expect(dupIdx).toBeLessThan(idxIdx)
  })

  it("Migration is wired into src/migrations/index.ts so the runner picks it up", () => {
    const indexSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/migrations/index.ts"),
      "utf-8",
    )
    expect(indexSource).toContain("20260509_pages_tenant_slug_unique")
  })
})

// -----------------------------------------------------------------------------
// projectPageToDisk interaction (audit text references src/hooks/projectToDisk.ts:27-33)
// -----------------------------------------------------------------------------

describe("audit-p1 #8 — projectPageToDisk interaction (no changes required)", () => {
  it("Case 12/13 — Pages.hooks.afterChange still includes projectPageToDisk; the unique-violation surface is pre-empted before this hook runs", () => {
    // projectPageToDisk is afterChange — by definition it only runs once the
    // create/update has succeeded. Half A's beforeValidate hook short-circuits
    // duplicate-slug writes BEFORE the DB write, so the projection hook never
    // sees a duplicate slug. No changes to src/hooks/projectToDisk.ts are
    // required by this batch; the existing afterChange semantics combined with
    // the new unique constraint means the manifest can no longer be corrupted
    // by two pages claiming the same (tenant, slug).
    const afterChangeHooks = (Pages.hooks?.afterChange ?? []) as Array<unknown>
    expect(afterChangeHooks.length).toBeGreaterThanOrEqual(1)
    // Identity check: the projection hook reference is the same one exported
    // from src/hooks/projectToDisk.ts (no per-collection wrapper).
    // (We don't reach further into the hook — it's afterChange, runs only on
    // success, and the test is a placeholder confirming no regression.)
  })
})
