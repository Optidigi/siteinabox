import { describe, it, expect, vi, beforeEach } from "vitest"
import * as fs from "node:fs"
import * as path from "node:path"

// Audit finding #11 (P2, T8) — getOrCreateSiteSettings find-then-create race
// produces duplicate per-tenant singletons.
//
// Two coordinated halves:
//  Half A — application-level: wrap payload.create in try/catch. On unique-
//           violation (the loser of a race), re-fetch by tenant and return the
//           winner's row. Other errors propagate uncaught.
//  Half B — DB-level migration: replace the non-unique `site_settings_tenant_idx`
//           with a UNIQUE INDEX on (tenant_id). Same shape as P1 #8: refuse to
//           apply if duplicates exist; down() throws.
//
// The two halves are required together: the migration is what makes the catch
// reachable in the first place (without UNIQUE, concurrent creates both succeed
// silently — the race is invisible). The application-level catch is what stops
// the loser's caller from seeing a raw Postgres 23505 error.

// Mock the real payload config (fail-fast on missing env in payload.config.ts)
vi.mock("@/payload.config", () => ({ default: {} }))

// Provide a per-test-controllable getPayload that returns a stub whose `find`
// and `create` are vitest mocks. Each test resets the mocks in beforeEach.
const fakeFind = vi.fn()
const fakeCreate = vi.fn()
vi.mock("payload", async () => {
  const actual = await vi.importActual<typeof import("payload")>("payload")
  return {
    ...actual,
    getPayload: vi.fn(async () => ({ find: fakeFind, create: fakeCreate })),
  }
})

import { getOrCreateSiteSettings } from "@/lib/queries/settings"
import * as migration from "@/migrations/20260509_site_settings_tenant_unique"

beforeEach(() => {
  fakeFind.mockReset()
  fakeCreate.mockReset()
})

// REAL production unique-violation shape. `@payloadcms/drizzle@3.84.1` does
// NOT propagate the raw pg error to application code — its `handleUpsertError`
// (node_modules/.pnpm/@payloadcms+drizzle@3.84.1.../upsertRow/handleUpsertError.js:48-59)
// intercepts pg `.code === "23505"` and throws a Payload `ValidationError`
// whose `data.errors[0].message === "Value must be unique"` (literal when
// req.t is undefined) and whose `data.errors[0].path` is the field name
// resolved from the constraint via `adapter.fieldConstraints`. The wrapped
// error has NO `.code` property and the top-level `.message` is "The
// following field is invalid: tenant" (or similar). This was the gap caught
// by adversarial review of the first iteration of this fix.
import { cast, errLike } from "../_helpers/cast"

const makeWrappedUniqueViolation = (path = "tenant") => {
  const err = new Error(`The following field is invalid: ${path}`) as Error & {
    status?: number
    data?: { collection: string; errors: Array<{ message: string; path: string }> }
  }
  err.name = "ValidationError"
  err.status = 400
  err.data = {
    collection: "site-settings",
    errors: [{ message: "Value must be unique", path }],
  }
  return err
}

const makeRawPgUniqueViolation = (constraint = "site_settings_tenant_idx") => {
  const err = new Error(
    `duplicate key value violates unique constraint "${constraint}"`,
  ) as Error & { code?: string; constraint?: string }
  err.code = "23505"
  err.constraint = constraint
  return err
}

// Default test channel uses the production wrapped shape.
const makeUniqueViolation = makeWrappedUniqueViolation

// -----------------------------------------------------------------------------
// Half A — application-level race handling in getOrCreateSiteSettings
// -----------------------------------------------------------------------------

describe("audit-p2 #11 Half A — getOrCreateSiteSettings handles unique-violation race", () => {
  it("Case 1 — single call with no existing row → creates and returns", async () => {
    fakeFind.mockResolvedValueOnce({ docs: [], totalDocs: 0 })
    const created = { id: 1, tenant: 42, siteName: "Untitled" }
    fakeCreate.mockResolvedValueOnce(created)

    const result = await getOrCreateSiteSettings(42)

    expect(result).toEqual(created)
    expect(fakeFind).toHaveBeenCalledTimes(1)
    expect(fakeCreate).toHaveBeenCalledTimes(1)
    // The find query must scope by tenant (per-tenant singleton).
    const findArgs = fakeFind.mock.calls[0]![0]
    expect(findArgs.collection).toBe("site-settings")
    expect(JSON.stringify(findArgs.where)).toContain("42")
  })

  it("Case 2 — single call with existing row → returns existing without re-creating", async () => {
    const existing = { id: 7, tenant: 42, siteName: "Already Set" }
    fakeFind.mockResolvedValueOnce({ docs: [existing], totalDocs: 1 })

    const result = await getOrCreateSiteSettings(42)

    expect(result).toEqual(existing)
    expect(fakeFind).toHaveBeenCalledTimes(1)
    expect(fakeCreate).not.toHaveBeenCalled()
  })

  it("Case 3 — concurrent racing calls both resolve with same row id; only one create succeeds, loser catches and re-fetches", async () => {
    // Both callers' initial `find` returns 0 docs (the race precondition).
    fakeFind
      .mockResolvedValueOnce({ docs: [], totalDocs: 0 })
      .mockResolvedValueOnce({ docs: [], totalDocs: 0 })

    // Winner's create resolves; loser's create rejects with unique-violation;
    // loser's re-fetch returns the winner's row.
    const winnerRow = { id: 99, tenant: 42, siteName: "Untitled" }
    fakeCreate
      .mockResolvedValueOnce(winnerRow)
      .mockRejectedValueOnce(makeUniqueViolation())

    fakeFind.mockResolvedValueOnce({ docs: [winnerRow], totalDocs: 1 })

    const results = await Promise.all([
      getOrCreateSiteSettings(42),
      getOrCreateSiteSettings(42),
    ])
    const r1 = results[0] as { id: number }
    const r2 = results[1] as { id: number }

    expect(r1.id).toBe(99)
    expect(r2.id).toBe(99)
    // create called exactly twice (both raced); one resolved, one rejected.
    expect(fakeCreate).toHaveBeenCalledTimes(2)
    // find called three times: initial × 2 + loser's re-fetch.
    expect(fakeFind).toHaveBeenCalledTimes(3)
  })

  it("Case 4 — after successful race resolution: only ONE row exists in DB for the tenant (the loser's create did NOT insert a duplicate)", async () => {
    // The DB-level UNIQUE INDEX is what makes this true; the test asserts the
    // application-level catch does NOT mask the violation (e.g. by retrying
    // create instead of re-fetching). The catch must NEVER reach a second
    // payload.create — otherwise the loser slips through.
    fakeFind
      .mockResolvedValueOnce({ docs: [], totalDocs: 0 })
      .mockResolvedValueOnce({ docs: [], totalDocs: 0 })
    const winnerRow = { id: 1, tenant: 42, siteName: "Untitled" }
    fakeCreate
      .mockResolvedValueOnce(winnerRow)
      .mockRejectedValueOnce(makeUniqueViolation())
    fakeFind.mockResolvedValueOnce({ docs: [winnerRow], totalDocs: 1 })

    await Promise.all([
      getOrCreateSiteSettings(42),
      getOrCreateSiteSettings(42),
    ])

    // Critical invariant: create was attempted exactly twice, no retries.
    expect(fakeCreate).toHaveBeenCalledTimes(2)
  })

  it("Case 5 — cross-tenant: two tenants, one settings row each — no false unique-violation", async () => {
    // Tenant 42 has no row; tenant 99 has no row. Both create successfully.
    fakeFind
      .mockResolvedValueOnce({ docs: [], totalDocs: 0 })
      .mockResolvedValueOnce({ docs: [], totalDocs: 0 })
    fakeCreate
      .mockResolvedValueOnce({ id: 1, tenant: 42 })
      .mockResolvedValueOnce({ id: 2, tenant: 99 })

    const both = await Promise.all([
      getOrCreateSiteSettings(42),
      getOrCreateSiteSettings(99),
    ])
    const r42 = both[0] as { id: number }
    const r99 = both[1] as { id: number }

    expect(r42.id).toBe(1)
    expect(r99.id).toBe(2)
    expect(fakeCreate).toHaveBeenCalledTimes(2)
    // No re-fetch (no error caught) — find called only twice (initial reads).
    expect(fakeFind).toHaveBeenCalledTimes(2)
    // The create calls must each carry the correct tenant id.
    expect(fakeCreate.mock.calls[0]![0].data.tenant).toBe(42)
    expect(fakeCreate.mock.calls[1]![0].data.tenant).toBe(99)
  })

  it("Case 6 — real (non-race) error in create propagates uncaught", async () => {
    fakeFind.mockResolvedValueOnce({ docs: [], totalDocs: 0 })
    const dbDownErr = new Error("ECONNREFUSED 127.0.0.1:5432") as Error & { code?: string }
    dbDownErr.code = "ECONNREFUSED"
    fakeCreate.mockRejectedValueOnce(dbDownErr)

    let caught: unknown = null
    try {
      await getOrCreateSiteSettings(42)
    } catch (e) {
      caught = e
    }

    expect(caught, "non-23505 error must propagate").not.toBeNull()
    expect((caught as Error & { code?: string }).code).toBe("ECONNREFUSED")
    // Critical: catch MUST NOT swallow non-unique-violation errors.
    // Re-fetch must NOT have happened on a non-race error.
    expect(fakeFind).toHaveBeenCalledTimes(1)
  })

  it("Case 6b — unique-violation caught BUT re-fetch returns 0 docs → re-throw the SAME original error (don't infinite-loop or return undefined)", async () => {
    // Pathological case: create rejects with a unique-violation (phantom
    // constraint or unrelated UNIQUE just added) but the re-fetch finds
    // nothing. The catch MUST NOT loop or return undefined; it MUST re-throw
    // the original error reference so the caller knows something is genuinely
    // wrong. Identity-equality on the thrown value is the binding contract.
    fakeFind.mockResolvedValueOnce({ docs: [], totalDocs: 0 })
    const violation = makeUniqueViolation()
    fakeCreate.mockRejectedValueOnce(violation)
    fakeFind.mockResolvedValueOnce({ docs: [], totalDocs: 0 })

    let caught: unknown = null
    try {
      await getOrCreateSiteSettings(42)
    } catch (e) {
      caught = e
    }
    expect(caught, "expected re-throw when re-fetch finds no row").not.toBeNull()
    // Identity check: the SAME error object is propagated (not a wrapped one).
    expect(caught).toBe(violation)
    // Initial find + create + re-fetch find = 2 finds, 1 create. NO further calls.
    expect(fakeFind).toHaveBeenCalledTimes(2)
    expect(fakeCreate).toHaveBeenCalledTimes(1)
  })

  it("Case 6d — defense-in-depth: raw pg-shaped error (.code === '23505') is also detected as a race", async () => {
    // The production path goes through drizzle's handleUpsertError wrapping,
    // but if a future adapter change strips the wrapping (or a direct-driver
    // path is added), the raw-pg channel must still detect the race.
    fakeFind.mockResolvedValueOnce({ docs: [], totalDocs: 0 })
    const winnerRow = { id: 1, tenant: 42, siteName: "Untitled" }
    fakeCreate.mockRejectedValueOnce(makeRawPgUniqueViolation())
    fakeFind.mockResolvedValueOnce({ docs: [winnerRow], totalDocs: 1 })

    const result = (await getOrCreateSiteSettings(42)) as { id: number }
    expect(result.id).toBe(1)
  })

  it("Case 6f — OBS-13: language-invariant detection survives i18n-translated message", async () => {
    // If a future PR sets payload.config.ts → i18n.fallbackLanguage: "nl"
    // (or any non-English value), Payload translates "Value must be unique"
    // and the channel-1 literal-message comparison silently degrades. The
    // path-based check keeps detection intact regardless of i18n config.
    fakeFind.mockResolvedValueOnce({ docs: [], totalDocs: 0 })
    const winnerRow = { id: 1, tenant: 42, siteName: "Untitled" }
    const translated = new Error("Het volgende veld is ongeldig: tenant") as Error & {
      status?: number
      data?: { collection: string; errors: Array<{ message: string; path: string }> }
    }
    translated.name = "ValidationError"
    translated.status = 400
    translated.data = {
      collection: "site-settings",
      errors: [{ message: "Waarde moet uniek zijn", path: "tenant" }],
    }
    fakeCreate.mockRejectedValueOnce(translated)
    fakeFind.mockResolvedValueOnce({ docs: [winnerRow], totalDocs: 1 })

    const result = (await getOrCreateSiteSettings(42)) as { id: number }
    expect(result.id).toBe(1)
  })

  it("Case 6e — defense-in-depth: pg-message-only error (no .code) is still detected via message regex", async () => {
    // Hypothetical adapter that strips both .code and the wrapping but leaves
    // the original Postgres message text intact. Covered by channel 3.
    fakeFind.mockResolvedValueOnce({ docs: [], totalDocs: 0 })
    const winnerRow = { id: 1, tenant: 42, siteName: "Untitled" }
    const messageOnly: unknown = new Error(
      `duplicate key value violates unique constraint "site_settings_tenant_idx"`,
    )
    fakeCreate.mockRejectedValueOnce(messageOnly)
    fakeFind.mockResolvedValueOnce({ docs: [winnerRow], totalDocs: 1 })

    const result = (await getOrCreateSiteSettings(42)) as { id: number }
    expect(result.id).toBe(1)
  })

  it("Case 6c — type confusion: tenantId may be string or number; both must scope correctly to the tenant", async () => {
    // Payload's tenant relationship column is integer; callers may pass either
    // string "42" or number 42 depending on URL/query origin. Both must work
    // and both must produce a where clause that scopes by the tenant.
    fakeFind.mockResolvedValueOnce({ docs: [{ id: 1, tenant: 42 }], totalDocs: 1 })
    await getOrCreateSiteSettings("42")
    const where1 = JSON.stringify(fakeFind.mock.calls[0]![0].where)
    expect(where1).toContain("42")
  })
})

// -----------------------------------------------------------------------------
// Half B — migration shape
// -----------------------------------------------------------------------------

describe("audit-p2 #11 Half B — migration shape", () => {
  it("Case 7 — migration file exports up and down functions", () => {
    expect(typeof migration.up).toBe("function")
    expect(typeof migration.down).toBe("function")
  })

  it("Case 7b — up() source includes duplicate-detection guard before index creation", () => {
    const source = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "src/migrations/20260509_site_settings_tenant_unique.ts",
      ),
      "utf-8",
    )
    // Duplicate detection: SELECT ... GROUP BY tenant_id ... HAVING COUNT(*) > 1
    expect(source).toMatch(/SELECT[\s\S]+tenant_id[\s\S]+GROUP BY[\s\S]+HAVING/i)
    // Unique index creation on site_settings (tenant_id)
    expect(source).toMatch(
      /CREATE\s+UNIQUE\s+INDEX[\s\S]+"site_settings_tenant_idx"[\s\S]+\(\s*"tenant_id"\s*\)/,
    )
    // The duplicate-detection SELECT must precede the CREATE UNIQUE INDEX.
    const dupIdx = source.search(/HAVING\s+COUNT\s*\(\s*\*\s*\)/i)
    const idxIdx = source.search(/CREATE\s+UNIQUE\s+INDEX\s+"site_settings_tenant_idx"/)
    expect(dupIdx).toBeGreaterThan(-1)
    expect(idxIdx).toBeGreaterThan(-1)
    expect(dupIdx).toBeLessThan(idxIdx)
  })

  it("Case 7c — up() drops the existing non-unique site_settings_tenant_idx before re-creating it as unique", () => {
    // Postgres won't let two indexes with the same name coexist. The audit
    // notes the existing non-unique index lives at
    // 20260505_172626_initial_schema.ts:377. The new migration must DROP it
    // first (or use a different name; the dispatch picks the same name).
    const source = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "src/migrations/20260509_site_settings_tenant_unique.ts",
      ),
      "utf-8",
    )
    expect(source).toMatch(/DROP\s+INDEX[^;]*site_settings_tenant_idx/i)
  })

  it("Case 8 — down() throws unconditionally", async () => {
    let err: unknown = null
    try {
      await migration.down(cast({ db: {}, payload: {}, req: {} }))
    } catch (e) {
      err = e
    }
    expect(err, "down() must throw").not.toBeNull()
    expect(err).toBeInstanceOf(Error)
    const msg = String(errLike(err).message ?? "")
    // Mention destructive + name the index so an operator who genuinely needs
    // to roll back has the exact identifier.
    expect(msg.toLowerCase()).toContain("destructive")
    expect(msg).toContain("site_settings_tenant_idx")
  })

  it("Migration is wired into src/migrations/index.ts so the runner picks it up", () => {
    const indexSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/migrations/index.ts"),
      "utf-8",
    )
    expect(indexSource).toContain("20260509_site_settings_tenant_unique")
  })
})
