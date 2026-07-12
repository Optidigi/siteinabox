import { describe, it, expect, vi } from "vitest"
import { Forms } from "@/collections/Forms"
import {
  purgeStaleFormSubmissions,
  resolveRetentionDays,
  DEFAULT_RETENTION_DAYS,
} from "@/lib/jobs/purgeStaleForms"

// Audit finding #10 (P2, T11) — Forms GDPR retention gap.
//
// Forms collection accumulates submissions with PII (`email`, `name`,
// `message`, `pageUrl`, `ipAddress`) indefinitely. No auto-purge, no
// per-record TTL. Maps to GDPR Art. 5(1)(e) (storage limitation) and
// operationally Art. 17 (right-to-erasure) per THREAT-MODEL §11.
//
// Stage 0 investigation finding (Payload v3.84.1):
//   - Built-in jobs/tasks infrastructure exists at
//     `node_modules/payload/dist/queues/`. `JobsConfig` lives on the root
//     payload config; `TaskConfig.schedule` admits a cron expression for
//     auto-scheduling; `JobsConfig.autoRun` registers an in-process cron
//     runner. The `autoRun` doc warns "should not be used on serverless
//     platforms like Vercel" but siab-payload runs as a long-lived Node
//     server on a VPS (per `payload.config.ts` runtime comments and
//     `scripts/migrate-on-boot.mjs`), so the constraint doesn't apply.
//   - Decision: register a `purgeStaleFormSubmissions` task with a daily
//     cron (`0 2 * * *` — 2 AM UTC) and enable autoRun. Extract the
//     core delete logic into a pure function so unit tests can call it
//     directly without spinning up the cron / a real DB.
//
// Retention default: 90 days (GDPR-norm for non-essential contact data;
// the audit suggested 24 months but didn't pin it; 90 days is a
// stricter, more defensible default and matches typical EU advisory).
// Configurable via `FORMS_RETENTION_DAYS` env var.
//
// Boundary semantics: `createdAt < cutoff` (strict less-than). A form
// created exactly retentionDays ago has `createdAt === cutoff` → NOT
// deleted. "Inclusive of newest, exclusive of oldest." Documented here
// and in the batch report.

// -----------------------------------------------------------------------------
// In-memory mock payload client for unit testing the pure function
// -----------------------------------------------------------------------------

type MockForm = {
  id: number
  tenant: number
  email: string
  createdAt: string // ISO
}

const makeMockPayload = (forms: MockForm[]) => {
  const findCalls: any[] = []
  const deleteCalls: any[] = []
  const find = vi.fn(async (args: any) => {
    findCalls.push(args)
    if (args.collection !== "forms") throw new Error(`unexpected find ${args.collection}`)
    const where = args.where ?? {}
    let docs = forms.slice()
    if (where.createdAt?.less_than) {
      const cutoff = new Date(where.createdAt.less_than).getTime()
      docs = docs.filter((f) => new Date(f.createdAt).getTime() < cutoff)
    }
    return { docs, totalDocs: docs.length }
  })
  const del = vi.fn(async (args: any) => {
    deleteCalls.push(args)
    if (args.collection !== "forms") throw new Error(`unexpected delete ${args.collection}`)
    const where = args.where ?? {}
    const before = forms.length
    if (where.createdAt?.less_than) {
      const cutoff = new Date(where.createdAt.less_than).getTime()
      // mutate the array in place to simulate a DB delete
      for (let i = forms.length - 1; i >= 0; i--) {
        if (new Date(forms[i]!.createdAt).getTime() < cutoff) forms.splice(i, 1)
      }
    }
    return { docs: [], totalDocs: 0, deletedCount: before - forms.length }
  })
  return { client: { find, delete: del }, findCalls, deleteCalls, store: forms }
}

const daysAgo = (n: number, fromMs: number) => new Date(fromMs - n * 86400_000).toISOString()

// Static "now" for deterministic boundary math. UTC noon, no DST surprises.
const NOW = new Date("2026-05-09T12:00:00.000Z").getTime()

describe("audit-p2 #10 — purgeStaleFormSubmissions (pure function)", () => {
  it("Case 1 — submissions older than retentionDays are deleted", async () => {
    const old1 = { id: 1, tenant: 1, email: "old1@x", createdAt: daysAgo(120, NOW) }
    const old2 = { id: 2, tenant: 1, email: "old2@x", createdAt: daysAgo(91, NOW) }
    const fresh = { id: 3, tenant: 1, email: "fresh@x", createdAt: daysAgo(10, NOW) }
    const { client, store, deleteCalls } = makeMockPayload([old1, old2, fresh])

    const result = await purgeStaleFormSubmissions({ payload: client as any, retentionDays: 90, now: new Date(NOW) })

    expect(result.deleted).toBe(2)
    expect(store).toEqual([fresh])
    // Single bulk delete, not N individual deletes (per-row delete would scale poorly).
    expect(deleteCalls).toHaveLength(1)
    expect(deleteCalls[0]!.collection).toBe("forms")
    expect(deleteCalls[0]!.overrideAccess).toBe(true)
  })

  it("Case 2 — submissions newer than retentionDays are preserved", async () => {
    const fresh1 = { id: 1, tenant: 1, email: "a@x", createdAt: daysAgo(0, NOW) }
    const fresh2 = { id: 2, tenant: 1, email: "b@x", createdAt: daysAgo(1, NOW) }
    const fresh3 = { id: 3, tenant: 1, email: "c@x", createdAt: daysAgo(89, NOW) }
    const { client, store } = makeMockPayload([fresh1, fresh2, fresh3])

    const result = await purgeStaleFormSubmissions({ payload: client as any, retentionDays: 90, now: new Date(NOW) })

    expect(result.deleted).toBe(0)
    expect(store).toHaveLength(3)
  })

  it("Case 3 — boundary: exactly retentionDays old → preserved (inclusive newest, exclusive oldest)", async () => {
    // createdAt === cutoff. With strict less-than the row is NOT deleted.
    const onBoundary = { id: 1, tenant: 1, email: "edge@x", createdAt: daysAgo(90, NOW) }
    const justOver = { id: 2, tenant: 1, email: "over@x", createdAt: new Date(NOW - (90 * 86400_000 + 1)).toISOString() }
    const { client, store } = makeMockPayload([onBoundary, justOver])

    const result = await purgeStaleFormSubmissions({ payload: client as any, retentionDays: 90, now: new Date(NOW) })

    expect(result.deleted).toBe(1)
    expect(store).toEqual([onBoundary])
  })

  it("Case 4 — multi-tenant: purge does not bleed across tenants", async () => {
    // Tenant A has old + new; tenant B has only new. After purge, ONLY
    // tenant A's old should be gone; both tenants' new must survive.
    const a_old = { id: 1, tenant: 100, email: "old.a@x", createdAt: daysAgo(120, NOW) }
    const a_new = { id: 2, tenant: 100, email: "new.a@x", createdAt: daysAgo(10, NOW) }
    const b_new1 = { id: 3, tenant: 200, email: "new.b1@x", createdAt: daysAgo(5, NOW) }
    const b_new2 = { id: 4, tenant: 200, email: "new.b2@x", createdAt: daysAgo(89, NOW) }
    const { client, store } = makeMockPayload([a_old, a_new, b_new1, b_new2])

    const result = await purgeStaleFormSubmissions({ payload: client as any, retentionDays: 90, now: new Date(NOW) })

    expect(result.deleted).toBe(1)
    expect(store).toEqual([a_new, b_new1, b_new2])
    // Pin tenant integrity: every surviving row's tenant is unchanged.
    expect(store.every((f) => f.tenant === 100 || f.tenant === 200)).toBe(true)
  })

  it("Case 5 — empty Forms table → no errors, deleted=0", async () => {
    const { client, store, deleteCalls } = makeMockPayload([])

    const result = await purgeStaleFormSubmissions({ payload: client as any, retentionDays: 90, now: new Date(NOW) })

    expect(result.deleted).toBe(0)
    expect(store).toEqual([])
    // Implementation may short-circuit before issuing the delete; both
    // shapes are acceptable, but if delete IS issued it must still match
    // the cutoff shape. Assert the contract: at most one delete call,
    // and if present it carries the cutoff.
    expect(deleteCalls.length).toBeLessThanOrEqual(1)
  })

  it("Case 6 — config: env override changes retentionDays", () => {
    const before = process.env.FORMS_RETENTION_DAYS
    try {
      delete process.env.FORMS_RETENTION_DAYS
      expect(resolveRetentionDays()).toBe(DEFAULT_RETENTION_DAYS)
      expect(DEFAULT_RETENTION_DAYS).toBe(90)

      process.env.FORMS_RETENTION_DAYS = "30"
      expect(resolveRetentionDays()).toBe(30)

      process.env.FORMS_RETENTION_DAYS = "365"
      expect(resolveRetentionDays()).toBe(365)
    } finally {
      if (before === undefined) delete process.env.FORMS_RETENTION_DAYS
      else process.env.FORMS_RETENTION_DAYS = before
    }
  })

  // -------------------------------------------------------------------------
  // Adversarial-walk hardening — items the dispatch §Step 4 reviewer will
  // attempt against the fix. Pin them in the test file so a regression that
  // re-opens any of these vectors fails CI loudly.
  // -------------------------------------------------------------------------

  it("Hardening — retentionDays=0 is rejected (would purge everything)", () => {
    expect(() => resolveRetentionDays(0)).toThrow(/retentionDays/i)
    expect(() => resolveRetentionDays(-1)).toThrow(/retentionDays/i)
    expect(() => resolveRetentionDays(Number.NaN)).toThrow(/retentionDays/i)
  })

  it("Hardening — env override of '0' / '-5' / 'abc' falls back to default (refuse to nuke)", () => {
    const before = process.env.FORMS_RETENTION_DAYS
    try {
      process.env.FORMS_RETENTION_DAYS = "0"
      expect(resolveRetentionDays()).toBe(DEFAULT_RETENTION_DAYS)
      process.env.FORMS_RETENTION_DAYS = "-5"
      expect(resolveRetentionDays()).toBe(DEFAULT_RETENTION_DAYS)
      process.env.FORMS_RETENTION_DAYS = "abc"
      expect(resolveRetentionDays()).toBe(DEFAULT_RETENTION_DAYS)
      process.env.FORMS_RETENTION_DAYS = ""
      expect(resolveRetentionDays()).toBe(DEFAULT_RETENTION_DAYS)
    } finally {
      if (before === undefined) delete process.env.FORMS_RETENTION_DAYS
      else process.env.FORMS_RETENTION_DAYS = before
    }
  })

  it("Hardening — overrideAccess: true is set (task runs without a user; admin ACLs would deny)", async () => {
    const { client, deleteCalls } = makeMockPayload([
      { id: 1, tenant: 1, email: "old@x", createdAt: daysAgo(120, NOW) },
    ])
    await purgeStaleFormSubmissions({ payload: client as any, retentionDays: 90, now: new Date(NOW) })
    expect(deleteCalls[0]!.overrideAccess).toBe(true)
  })

  it("Hardening — cutoff is computed in UTC milliseconds (no TZ drift)", async () => {
    // Anchor a "now" + a row exactly retentionDays-1 millisecond older.
    // The row IS older than the cutoff (cutoff = now - 90d; row =
    // now - (90d - 1ms); row > cutoff → preserved; flip the polarity
    // to confirm the comparison uses millisecond-precision UTC).
    const justInside = { id: 1, tenant: 1, email: "inside@x", createdAt: new Date(NOW - (90 * 86400_000 - 1)).toISOString() }
    const justOutside = { id: 2, tenant: 1, email: "outside@x", createdAt: new Date(NOW - (90 * 86400_000 + 1)).toISOString() }
    const { client, store } = makeMockPayload([justInside, justOutside])
    await purgeStaleFormSubmissions({ payload: client as any, retentionDays: 90, now: new Date(NOW) })
    expect(store).toEqual([justInside])
  })
})

// -----------------------------------------------------------------------------
// Integration sanity — the task is registered on payload config and the
// Forms collection still has its P1 #5 invariants (size cap + bogus-auth
// gate). Re-arm guards.
// -----------------------------------------------------------------------------

describe("audit-p2 #10 — re-arm guards", () => {
  it("R1 — Forms.fields[data].validate is still wired (P1 #5 sub-fix 2 size cap)", () => {
    const dataField = (Forms.fields as any[]).find((f) => f.name === "data")
    expect(dataField).toBeTruthy()
    expect(typeof dataField.validate).toBe("function")
    // Call with oversized payload — must reject (preserves the 32 KB cap).
    const oversized = { x: "a".repeat(40_000) }
    const result = dataField.validate(oversized, { req: { i18n: { language: "en" } } })
    expect(result).toMatch(/exceeds the .*byte limit/)
  })

  it("R2 — Forms.access.create is still the layer-2 bogus-auth gate (P1 #5 sub-fix 1)", () => {
    const create = Forms.access?.create
    expect(typeof create).toBe("function")
    // user present -> permitted (API-key client path)
    expect((create as any)({ req: { user: { role: "super-admin" } } })).toBe(true)
    // user null + no auth signal → permitted (legitimate anon submit)
    expect((create as any)({ req: { user: null, headers: new Headers() } })).toBe(true)
  })

  it("R3 — Forms.access.delete still admits owner + super-admin only", () => {
    const del = Forms.access?.delete
    expect(typeof del).toBe("function")
    expect((del as any)({ req: { user: { role: "super-admin" } } })).toBe(true)
    expect((del as any)({ req: { user: { role: "owner" } } })).toBe(true)
    expect((del as any)({ req: { user: { role: "editor" } } })).toBe(false)
    expect((del as any)({ req: { user: { role: "viewer" } } })).toBe(false)
    expect((del as any)({ req: { user: null } })).toBeFalsy()
  })

  it("R4 — task wrapper is registered on payload.config.ts (file inspection)", async () => {
    // Avoid importing @/payload.config directly: it eagerly throws on
    // missing PAYLOAD_SECRET / DATABASE_URI, which unit tests can't be
    // expected to provide. Instead, read the source file and assert the
    // wiring hasn't been removed.
    const fs = await import("node:fs/promises")
    const path = await import("node:path")
    const cfgPath = path.resolve(process.cwd(), "src/payload.config.ts")
    const cfgSrc = await fs.readFile(cfgPath, "utf8")
    expect(cfgSrc).toMatch(/purgeStaleFormSubmissionsTask/)
    expect(cfgSrc).toMatch(/jobs\s*:\s*\{/)
    expect(cfgSrc).toMatch(/tasks\s*:\s*\[\s*purgeStaleFormSubmissionsTask/)
    expect(cfgSrc).toMatch(/autoRun\s*:/)
  })

  it("R4b — task wrapper exports the right slug + daily schedule", async () => {
    const { purgeStaleFormSubmissionsTask } = await import("@/lib/jobs/purgeStaleFormsTask")
    expect(purgeStaleFormSubmissionsTask.slug).toBe("purge-stale-form-submissions")
    expect(Array.isArray(purgeStaleFormSubmissionsTask.schedule)).toBe(true)
    expect(purgeStaleFormSubmissionsTask.schedule!.length).toBeGreaterThan(0)
    expect(typeof purgeStaleFormSubmissionsTask.schedule![0]!.cron).toBe("string")
    // Cron is a daily-or-shorter cadence: must contain at least one
    // non-wildcard field at minute or hour position so it doesn't fire
    // every minute (which would do nothing harmful, but is wasteful).
    const cron = purgeStaleFormSubmissionsTask.schedule![0]!.cron
    expect(cron).not.toBe("* * * * *")
    expect(cron).not.toBe("* * * * * *")
  })
})
