import { describe, it, expect, vi } from "vitest"
import * as fs from "node:fs"
import * as path from "node:path"
import { Media } from "@/collections/Media"
import { ValidationError } from "payload"
import * as migration from "@/migrations/20260509_media_tenant_filename_unique"
import { ensureUniqueTenantFilename } from "@/hooks/ensureUniqueTenantFilename"
import { forceTenantMediaUploadFilename, rewriteTenantMediaUrl } from "@/hooks/mediaTenantUrls"

import { asBeforeOperationHook, callBeforeOpHook, type BeforeOperationHook } from "../_helpers/hookFixtures"
import { cast, errLike, validationErrorData } from "../_helpers/cast"
// Audit finding #15 (P3, T8) — `media.filename` globally UNIQUE → cross-tenant
// naming side-channel. Tenant A uploading `logo.png` causes Tenant B's later
// upload to land at `logo-1.png` — leaks filename existence across tenants
// and creates support churn.
//
// Two coordinated halves (same shape as P1 #8 / P2 #11):
//   Half A — application-level beforeValidate hook on Media that pre-empts
//            the Postgres unique-violation with a clean ValidationError
//            ("A file named X already exists in this tenant").
//   Half B — hand-written DB migration:
//            1. DROP the existing global unique index `media_filename_idx`.
//            2. Detect existing duplicates within (tenant_id, filename) and
//               refuse to apply if any exist.
//            3. CREATE UNIQUE INDEX `media_tenant_filename_idx` ON media
//               (tenant_id, filename).
//            4. down() throws (canonical destructive-rollback-refusal).
//
// Both halves are required:
//  - The migration is what enforces uniqueness in the DB; without it the
//    application-level check has a TOCTOU race that lets two near-simultaneous
//    uploads slip past.
//  - The application-level hook is what surfaces a clean error to admin
//    users; without it Payload v3.84.1's drizzle adapter wraps Postgres
//    23505 into a `ValidationError` whose message is the index name —
//    user-hostile.

// -----------------------------------------------------------------------------
// Half A — application-level pre-emptive duplicate check on Media
// -----------------------------------------------------------------------------

const beforeValidateHooks = Media.hooks?.beforeValidate ?? []
const beforeOperationHooks = (Media.hooks?.beforeOperation ?? []) as unknown as BeforeOperationHook[]
const afterReadHooks = Media.hooks?.afterRead ?? []

// Invoke the hook by direct import rather than positional array access.
// The original `beforeValidateHooks[0]` access silently broke when
// validateTenantExists was prepended to Media.hooks.beforeValidate in
// commit ee4eacd8 (May 2026) — the test then ran the wrong hook against
// a `req` mock missing `findByID` and surfaced as a misleading "Tenant
// not found" ValidationError. The S1 case below still verifies the hook
// is wired into the collection chain so registration regressions trip.
const ensureUniqueFilenameHook = ensureUniqueTenantFilename as unknown as (args: unknown) => unknown

const makeReq = (findResult: { totalDocs: number; docs?: unknown[] }) => {
  const find = vi.fn().mockResolvedValue({
    docs: findResult.docs ?? [],
    totalDocs: findResult.totalDocs,
  })
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
  ensureUniqueFilenameHook({
    data: opts.data,
    operation: opts.operation,
    originalDoc: opts.originalDoc,
    req: opts.req,
    collection: { slug: "media" },
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
  expect(validationErrorData(err)?.errors?.[0]?.path).toBe("filename")
}

describe("audit-p3 #15 Half A — ensureUniqueTenantFilename pre-empts unique-violation with clean ValidationError", () => {
  it("S1: ensureUniqueTenantFilename is registered on Media.hooks.beforeValidate", () => {
    expect(beforeValidateHooks.length).toBeGreaterThanOrEqual(1)
    expect(typeof ensureUniqueFilenameHook).toBe("function")
    // Pin the wiring contract: the imported hook reference must actually be
    // part of the collection's beforeValidate chain. Position within the
    // array is intentionally NOT asserted — additions in front are fine as
    // long as registration survives.
    expect(beforeValidateHooks).toContain(ensureUniqueTenantFilename)
  })

  it("Case 1 — upload media with unique (tenant_id, filename) → succeeds (positive control)", async () => {
    const { req, find } = makeReq({ totalDocs: 0 })
    const data = { filename: "logo.png", tenant: 42, alt: "Brand logo" }
    const result = await callHook({ data, operation: "create", req })
    expect(result).toEqual(data)
    // Must have queried for an existing duplicate scoped by tenant.
    expect(find).toHaveBeenCalledTimes(1)
    const findArgs = find.mock.calls[0]![0]
    expect(findArgs.collection).toBe("media")
    const where = JSON.stringify(findArgs.where)
    expect(where).toContain("\"tenant\"")
    expect(where).toContain("42")
    expect(where).toContain("\"filename\"")
    expect(where).toContain("logo.png")
  })

  it("Case 2 — upload duplicate (tenant_id, filename) → ValidationError on path:filename with helpful message", async () => {
    // Simulate one existing media row with the same (tenant, filename).
    const { req } = makeReq({
      totalDocs: 1,
      docs: [{ id: 99, filename: "logo.png", tenant: 42 }],
    })
    let err: unknown = null
    try {
      await callHook({
        data: { filename: "logo.png", tenant: 42 },
        operation: "create",
        req,
      })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(ValidationError)
    expect(validationErrorData(err)?.errors?.[0]?.path).toBe("filename")
    const msg = String(validationErrorData(err)?.errors?.[0]?.message ?? "")
    expect(msg).toContain("logo.png")
    expect(msg.toLowerCase()).toContain("tenant")
  })

  it("Case 3 — upload same filename in different tenants → BOTH succeed (per-tenant uniqueness, not global)", async () => {
    // Tenant 42 already uploaded logo.png; tenant 99 uploads logo.png.
    // The hook's where filter must scope by tenant 99, so totalDocs is 0.
    // This is the audit's headline win: no cross-tenant naming collisions.
    const { req, find } = makeReq({ totalDocs: 0 })
    const data = { filename: "logo.png", tenant: 99 }
    const result = await callHook({ data, operation: "create", req })
    expect(result).toEqual(data)
    const where = JSON.stringify(find.mock.calls[0]![0].where)
    // Verify the query was scoped to tenant 99 (not 42, not unscoped).
    expect(where).toContain("99")
  })

  it("Case 4 — update media filename to one that exists in the same tenant → ValidationError on path:filename", async () => {
    const { req } = makeReq({
      totalDocs: 1,
      docs: [{ id: 50, filename: "logo.png", tenant: 42 }],
    })
    await expectValidationError(
      callHook({
        data: { filename: "logo.png" },
        operation: "update",
        originalDoc: { id: 7, filename: "old.png", tenant: 42, alt: "" },
        req,
      }),
    )
  })

  it("Case 5 — update media filename to one that exists in a DIFFERENT tenant → succeeds", async () => {
    // Caller's media is in tenant 42; another tenant (99) has a media row
    // with filename "logo.png". The hook's query is scoped to tenant 42,
    // so totalDocs is 0 from that scope.
    const { req } = makeReq({ totalDocs: 0 })
    const result = await callHook({
      data: { filename: "logo.png" },
      operation: "update",
      originalDoc: { id: 7, filename: "old.png", tenant: 42 },
      req,
    })
    expect(result).toEqual({ filename: "logo.png" })
  })

  it("Update where filename isn't changing (no-op write) → does NOT query, does NOT throw", async () => {
    // Short-circuit when neither filename nor tenant is changing on an
    // update. Avoids a spurious DB round-trip on every PATCH that touches
    // unrelated fields (e.g. `alt`, `caption`).
    const { req, find } = makeReq({ totalDocs: 0 })
    const result = await callHook({
      data: { alt: "Updated alt text" },
      operation: "update",
      originalDoc: { id: 7, filename: "logo.png", tenant: 42 },
      req,
    })
    expect(result).toEqual({ alt: "Updated alt text" })
    expect(find).not.toHaveBeenCalled()
  })

  it("Self-exclusion: duplicate-check excludes self (id not_equals originalDoc.id) on update", async () => {
    // The single existing match is the doc itself — that must NOT count as
    // a collision. The hook's where clause must include `id not_equals <self>`.
    const { req, find } = makeReq({ totalDocs: 0 })
    await callHook({
      data: { filename: "new.png" },
      operation: "update",
      originalDoc: { id: 7, filename: "old.png", tenant: 42 },
      req,
    })
    const where = JSON.stringify(find.mock.calls[0]![0].where)
    expect(where).toContain("not_equals")
    expect(where).toContain("\"id\"")
  })

  it("Tenant id-shape robustness: populated object {id:42} on data.tenant is normalized to 42", async () => {
    // Payload may pass tenant as a populated object depending on auth depth.
    // The hook must extract .id rather than passing the object through.
    const { req, find } = makeReq({ totalDocs: 0 })
    await callHook({
      data: { filename: "logo.png", tenant: { id: 42, slug: "tenant-a" } },
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

  it("Skip when filename is missing on create (defensive — Payload's upload validator handles it)", async () => {
    const { req, find } = makeReq({ totalDocs: 0 })
    await callHook({
      data: { tenant: 42, alt: "no file" },
      operation: "create",
      req,
    })
    expect(find).not.toHaveBeenCalled()
  })

  it("Skip when tenant is missing on create (defensive — multi-tenant plugin handles it)", async () => {
    const { req, find } = makeReq({ totalDocs: 0 })
    await callHook({
      data: { filename: "logo.png" },
      operation: "create",
      req,
    })
    expect(find).not.toHaveBeenCalled()
  })
})

// -----------------------------------------------------------------------------
// Half B — migration shape
// -----------------------------------------------------------------------------

describe("audit-p3 #15 Half B — migration shape", () => {
  it("Case 6a — migration file exports up and down functions", () => {
    expect(typeof migration.up).toBe("function")
    expect(typeof migration.down).toBe("function")
  })

  it("Case 6 — up() source includes duplicate-detection guard before index creation (refuses if existing duplicates present)", () => {
    // Per-tenant duplicates SHOULD be zero today (the global unique enforced
    // a stricter constraint). The detection step is canonical safety: silent
    // data mutation by a migration is forbidden in this codebase. Operator
    // decides resolution; migration enforces.
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "src/migrations/20260509_media_tenant_filename_unique.ts"),
      "utf-8",
    )
    expect(source).toMatch(/SELECT[\s\S]+tenant_id[\s\S]+filename[\s\S]+GROUP BY[\s\S]+HAVING/i)
    // Order: SELECT/HAVING must precede CREATE UNIQUE INDEX. The duplicate
    // detection must happen before any structural change.
    const dupIdx = source.search(/HAVING\s+COUNT\s*\(\s*\*\s*\)/i)
    const idxIdx = source.search(/CREATE\s+UNIQUE\s+INDEX\s+"media_tenant_filename_idx"/)
    expect(dupIdx).toBeGreaterThan(-1)
    expect(idxIdx).toBeGreaterThan(-1)
    expect(dupIdx).toBeLessThan(idxIdx)
  })

  it("Case 7 — down() throws unconditionally with a destructive-rollback message that names the new index", async () => {
    let err: unknown = null
    try {
      await migration.down(cast({ db: {}, payload: {}, req: {} }))
    } catch (e) {
      err = e
    }
    expect(err, "down() must throw").not.toBeNull()
    expect(err).toBeInstanceOf(Error)
    const msg = String(errLike(err).message ?? "")
    expect(msg.toLowerCase()).toContain("destructive")
    expect(msg).toContain("media_tenant_filename_idx")
  })

  it("Case 8 — up() drops the OLD global unique index AND creates the new compound unique on (tenant_id, filename)", () => {
    // The original schema declared `CREATE UNIQUE INDEX "media_filename_idx"
    // ON "media" USING btree ("filename")` at line 336 of the initial-schema
    // migration. The new migration MUST drop that index by name AND create
    // the new compound unique. Postgres won't let two indexes coexist with
    // the same name, but here the names differ — so DROP + CREATE are both
    // strictly required.
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "src/migrations/20260509_media_tenant_filename_unique.ts"),
      "utf-8",
    )
    // DROP the old global unique index
    expect(source).toMatch(/DROP\s+INDEX[^;]*"?media_filename_idx"?/i)
    // CREATE the new compound unique index on (tenant_id, filename)
    expect(source).toMatch(
      /CREATE\s+UNIQUE\s+INDEX[\s\S]+"media_tenant_filename_idx"[\s\S]+\(\s*"tenant_id"\s*,\s*"filename"\s*\)/,
    )
  })

  it("Migration is wired into src/migrations/index.ts so the runner picks it up", () => {
    const indexSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/migrations/index.ts"),
      "utf-8",
    )
    expect(indexSource).toContain("20260509_media_tenant_filename_unique")
    expect(indexSource).toContain("20260522_083500_media_filename_compound_index")
  })
})

// -----------------------------------------------------------------------------
// Half C — OBS-17 Payload safe-name bypass + tenant-scoped serving
// -----------------------------------------------------------------------------

describe("OBS-17 — media uploads do not leak cross-tenant filename existence through Payload safe-name probing", () => {
  it("Media upload config declares tenant as the filename compound index", () => {
    expect(typeof Media.upload).toBe("object")
    expect((Media.upload as Record<string, unknown>).filenameCompoundIndex).toEqual(["tenant", "filename"])
  })

  it("forceTenantMediaUploadFilename is registered before Payload generates upload data", () => {
    expect(beforeOperationHooks).toContain(forceTenantMediaUploadFilename)
  })

  it("forceTenantMediaUploadFilename sets overwriteExistingFiles only for upload create/update operations", () => {
    const req = { file: { name: "logo.png", data: Buffer.from("x") } }
    const result = forceTenantMediaUploadFilename(
      cast<Parameters<typeof forceTenantMediaUploadFilename>[0]>({
        args: { req, collection: { config: Media } },
        collection: Media,
        context: {},
        operation: "create",
        req,
      }),
    ) as { overwriteExistingFiles?: boolean }

    expect(result.overwriteExistingFiles).toBe(true)

    const readResult = forceTenantMediaUploadFilename(
      cast<Parameters<typeof forceTenantMediaUploadFilename>[0]>({
        args: { req },
        collection: Media,
        context: {},
        operation: "find",
        req,
      }),
    ) as { overwriteExistingFiles?: boolean }
    expect(readResult.overwriteExistingFiles).toBeUndefined()
  })

  it("rewriteTenantMediaUrl is registered and rewrites populated media URLs to tenant-scoped routes", () => {
    expect(afterReadHooks).toContain(rewriteTenantMediaUrl)

    const doc = rewriteTenantMediaUrl(cast<Parameters<typeof rewriteTenantMediaUrl>[0]>({
      doc: {
        id: 10,
        filename: "logo file.png",
        tenant: { id: 42 },
        thumbnailURL: "/api/media/file/logo%20file.png",
        url: "/api/media/file/logo%20file.png",
      },
      req: cast({}),
      collection: {},
      context: {},
    }))

    expect(doc.url).toBe("/api/tenant-media/42/logo%20file.png")
    expect(doc.thumbnailURL).toBe("/api/tenant-media/42/logo%20file.png")
  })

  it("tenant-media route keeps auth and tenant checks in front of disk reads", () => {
    const routeSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/(payload)/api/tenant-media/[tenantId]/[filename]/route.ts"),
      "utf-8",
    )

    expect(routeSource).toContain("payload.auth")
    expect(routeSource).toContain('user.role !== "super-admin"')
    expect(routeSource).toContain("userTenantIds(user).has")
    expect(routeSource).toContain('collection: "media"')
    expect(routeSource).toContain("resolve(DATA_DIR, \"tenants\", tenantId, \"media\")")
  })
})
