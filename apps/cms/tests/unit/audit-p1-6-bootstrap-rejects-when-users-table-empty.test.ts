import { describe, it, expect, afterEach } from "vitest"
import { Users } from "@/collections/Users"
import { expectAccessField } from "../_helpers/payloadFields"

// Audit finding #6 (P1, T2) — Bootstrap re-opens super-admin signup whenever
// the users table is empty. Replace the in-band count-only gate with a
// `BOOTSTRAP_TOKEN` env-var-gated header check, AND reject any incoming
// `role !== "super-admin"` from the bootstrap path. Once any user exists
// and authenticated callers exist, the bootstrap path stays closed even if
// the table is later emptied (operator must rotate BOOTSTRAP_TOKEN to re-arm).
//
// The access function is async; we exercise it directly with a hand-built
// req shape mirroring Payload's AccessArgs ({req, data}) — same pattern as
// audit-p0-2-3-role-tenants-field-access.test.ts and audit-p0-1.

const accessCreate = (Users.access as Record<string, unknown>).create as (
  args: { req: unknown; data?: unknown }
) => boolean | Promise<boolean>

const reqFor = (opts: {
  user?: { id?: number; role: string } | null
  bootstrapHeader?: string | null
  totalDocs?: number
}) => ({
  user: opts.user ?? null,
  headers: {
    get: (k: string) =>
      k.toLowerCase() === "x-bootstrap-token" ? (opts.bootstrapHeader ?? null) : null,
  },
  payload: {
    count: async () => ({ totalDocs: opts.totalDocs ?? 0 }),
  },
})

describe("audit-p1 #6 — bootstrap path requires BOOTSTRAP_TOKEN header + super-admin role", () => {
  const orig = process.env.BOOTSTRAP_TOKEN
  afterEach(() => {
    if (orig === undefined) delete process.env.BOOTSTRAP_TOKEN
    else process.env.BOOTSTRAP_TOKEN = orig
  })

  it("rejects anonymous bootstrap when BOOTSTRAP_TOKEN env var is unset (closes silent re-open on table-empty)", async () => {
    delete process.env.BOOTSTRAP_TOKEN
    const result = await accessCreate({
      req: reqFor({ user: null, totalDocs: 0 }),
      data: { role: "super-admin", email: "a@b", password: "x" },
    })
    expect(result).toBe(false)
  })

  it("rejects anonymous bootstrap with wrong header value", async () => {
    process.env.BOOTSTRAP_TOKEN = "secret-1234"
    const result = await accessCreate({
      req: reqFor({ user: null, bootstrapHeader: "wrong", totalDocs: 0 }),
      data: { role: "super-admin", email: "a@b", password: "x" },
    })
    expect(result).toBe(false)
  })

  it("rejects anonymous bootstrap when header missing (header set to null)", async () => {
    process.env.BOOTSTRAP_TOKEN = "secret-1234"
    const result = await accessCreate({
      req: reqFor({ user: null, bootstrapHeader: null, totalDocs: 0 }),
      data: { role: "super-admin", email: "a@b", password: "x" },
    })
    expect(result).toBe(false)
  })

  it("rejects bootstrap with correct header but role !== 'super-admin' (audit: 'reject any role !== super-admin')", async () => {
    process.env.BOOTSTRAP_TOKEN = "secret-1234"
    for (const role of ["owner", "editor", "viewer", undefined, null, "admin"]) {
      const result = await accessCreate({
        req: reqFor({ user: null, bootstrapHeader: "secret-1234", totalDocs: 0 }),
        data: { role: role, email: "a@b", password: "x" },
      })
      expect(result, `role=${String(role)}`).toBe(false)
    }
  })

  it("rejects bootstrap when users already exist (header + role correct)", async () => {
    process.env.BOOTSTRAP_TOKEN = "secret-1234"
    const result = await accessCreate({
      req: reqFor({ user: null, bootstrapHeader: "secret-1234", totalDocs: 3 }),
      data: { role: "super-admin", email: "a@b", password: "x" },
    })
    expect(result).toBe(false)
  })

  it("permits bootstrap when env+header+role=super-admin+empty-table all correct", async () => {
    process.env.BOOTSTRAP_TOKEN = "secret-1234"
    const result = await accessCreate({
      req: reqFor({ user: null, bootstrapHeader: "secret-1234", totalDocs: 0 }),
      data: { role: "super-admin", email: "a@b", password: "x" },
    })
    expect(result).toBe(true)
  })

  it("super-admin/owner shortcut still permits create regardless of bootstrap state", async () => {
    delete process.env.BOOTSTRAP_TOKEN
    expect(
      await accessCreate({
        req: reqFor({ user: { role: "super-admin" }, totalDocs: 5 }),
        data: { role: "editor" },
      })
    ).toBe(true)
    expect(
      await accessCreate({
        req: reqFor({ user: { role: "owner" }, totalDocs: 5 }),
        data: { role: "editor" },
      })
    ).toBe(true)
  })

  it("editor/viewer authed users are NOT shortcut-permitted (only super-admin/owner)", async () => {
    process.env.BOOTSTRAP_TOKEN = "secret-1234"
    // Editor has no header/role match → fall through to bootstrap path which fails.
    expect(
      await accessCreate({
        req: reqFor({ user: { role: "editor" }, totalDocs: 5 }),
        data: { role: "editor" },
      })
    ).toBe(false)
    expect(
      await accessCreate({
        req: reqFor({ user: { role: "viewer" }, totalDocs: 5 }),
        data: { role: "editor" },
      })
    ).toBe(false)
  })

  it("does NOT issue the DB count when env var is unset (perf + DoS surface; fail closed early)", async () => {
    delete process.env.BOOTSTRAP_TOKEN
    let countCalls = 0
    const req = {
      user: null,
      headers: { get: () => null },
      payload: {
        count: async () => {
          countCalls++
          return { totalDocs: 0 }
        },
      },
    }
    await accessCreate({ req, data: { role: "super-admin" } })
    expect(countCalls).toBe(0)
  })

  it("does NOT issue the DB count when bootstrap header is wrong (fail closed before DB)", async () => {
    process.env.BOOTSTRAP_TOKEN = "secret-1234"
    let countCalls = 0
    const req = {
      user: null,
      headers: { get: (k: string) => (k.toLowerCase() === "x-bootstrap-token" ? "wrong" : null) },
      payload: {
        count: async () => {
          countCalls++
          return { totalDocs: 0 }
        },
      },
    }
    await accessCreate({ req, data: { role: "super-admin" } })
    expect(countCalls).toBe(0)
  })

  it("rejects token comparison via length-based truncation (defense-in-depth: timing-safe compare)", async () => {
    // If a naive `===` compare were used with attacker-supplied prefix matching
    // the env var, the only signal an attacker has is the boolean reject. With
    // timing-safe compare on length-mismatched buffers we still want a clean
    // reject — assert behavioral correctness here. (The cryptographic
    // timing-safety is property of crypto.timingSafeEqual itself.)
    process.env.BOOTSTRAP_TOKEN = "secret-1234"
    const result = await accessCreate({
      req: reqFor({ user: null, bootstrapHeader: "secret", totalDocs: 0 }),
      data: { role: "super-admin", email: "a@b", password: "x" },
    })
    expect(result).toBe(false)
  })
})

// Field-level interaction with batch-1 P0 fix (audit #2/#3).
//
// Adversarial-reviewer note (2026-05-08): the P0 fix wired
// `isSuperAdminField` onto `role.access.create` and `tenants.access.create`.
// For an anonymous bootstrap caller, `req.user` is null → field-access
// returns false → Payload silently strips `role` and `tenants` from the
// incoming data BEFORE validation. Default `defaultValue: "editor"` then
// fills `role`, and `validateTenants` rejects (`exactly one tenant
// required for non-super-admin users`). Net: the documented bootstrap
// curl in deploy.md cannot mint a super-admin even when the operator
// supplies a valid BOOTSTRAP_TOKEN — security-wise belt-and-suspenders,
// operationally a broken runbook that pressures operators to bypass with
// overrideAccess: true scripts (re-introducing the original P1).
//
// Fix: relax `role.access.create` and `tenants.access.create` to permit
// the SAME bootstrap conditions as the collection-level gate
// (`role === "super-admin"` is enforced by the collection gate; the field
// gate just needs to not strip the field on the legitimate path). Update
// access stays gated by `isSuperAdminField` — only create is relaxed.
describe("audit-p1 #6 — field-level role/tenants create permits bootstrap path (closes operator-runbook regression)", () => {
  const orig = process.env.BOOTSTRAP_TOKEN
  afterEach(() => {
    if (orig === undefined) delete process.env.BOOTSTRAP_TOKEN
    else process.env.BOOTSTRAP_TOKEN = orig
  })

  const roleField = expectAccessField(Users.fields, "role")
  const tenantsField = expectAccessField(Users.fields, "tenants")

  const fieldReq = (opts: {
    user?: unknown | null
    bootstrapHeader?: string | null
    data?: unknown
  }) => ({
    req: {
      user: opts.user ?? null,
      headers: {
        get: (k: string) =>
          k.toLowerCase() === "x-bootstrap-token" ? (opts.bootstrapHeader ?? null) : null,
      },
    },
    // AMD-1 tightened the field gate to require `data.role === "super-admin"`
    // on the bootstrap branch (was role-blind under `isSuperAdminOrBootstrapField`).
    // Tests that exercise the legitimate seed path now pass the role explicitly.
    data: opts.data,
  })

  it("role.access.create permits anonymous caller with valid bootstrap token + role=super-admin (legitimate first-seed flow)", () => {
    process.env.BOOTSTRAP_TOKEN = "secret-1234"
    expect(
      roleField.access.create(
        fieldReq({ user: null, bootstrapHeader: "secret-1234", data: { role: "super-admin" } })
      )
    ).toBe(true)
  })

  it("tenants.access.create permits anonymous caller with valid bootstrap token + role=super-admin", () => {
    process.env.BOOTSTRAP_TOKEN = "secret-1234"
    expect(
      tenantsField.access.create(
        fieldReq({ user: null, bootstrapHeader: "secret-1234", data: { role: "super-admin" } })
      )
    ).toBe(true)
  })

  it("role.access.create still rejects anonymous caller WITHOUT bootstrap token (BOOTSTRAP_TOKEN unset)", () => {
    delete process.env.BOOTSTRAP_TOKEN
    expect(roleField.access.create(fieldReq({ user: null }))).toBe(false)
  })

  it("role.access.create still rejects anonymous caller with WRONG bootstrap token", () => {
    process.env.BOOTSTRAP_TOKEN = "secret-1234"
    expect(roleField.access.create(fieldReq({ user: null, bootstrapHeader: "wrong" }))).toBe(false)
  })

  it("role.access.create still rejects authed editor/viewer/owner regardless of bootstrap state (P0 #2/#3 invariant)", () => {
    process.env.BOOTSTRAP_TOKEN = "secret-1234"
    // Editor/viewer/owner with no header — P0 gate must hold.
    expect(roleField.access.create(fieldReq({ user: { role: "editor" } }))).toBe(false)
    expect(roleField.access.create(fieldReq({ user: { role: "viewer" } }))).toBe(false)
    expect(roleField.access.create(fieldReq({ user: { role: "owner" } }))).toBe(false)
    // Even WITH a valid token, an authed non-super-admin must NOT escalate via
    // the bootstrap exception. The exception is for anonymous-with-token only,
    // because the collection-level gate also requires `totalDocs === 0` — but
    // the field gate runs without that signal, so we must not relax it for
    // authed callers (they already have a non-bootstrap path through the UI).
    expect(roleField.access.create(fieldReq({ user: { role: "owner" }, bootstrapHeader: "secret-1234" }))).toBe(false)
    expect(roleField.access.create(fieldReq({ user: { role: "editor" }, bootstrapHeader: "secret-1234" }))).toBe(false)
  })

  it("tenants.access.create still rejects authed editor/viewer/owner regardless of bootstrap state", () => {
    process.env.BOOTSTRAP_TOKEN = "secret-1234"
    expect(tenantsField.access.create(fieldReq({ user: { role: "editor" } }))).toBe(false)
    expect(tenantsField.access.create(fieldReq({ user: { role: "viewer" } }))).toBe(false)
    expect(tenantsField.access.create(fieldReq({ user: { role: "owner" } }))).toBe(false)
    expect(tenantsField.access.create(fieldReq({ user: { role: "owner" }, bootstrapHeader: "secret-1234" }))).toBe(false)
  })

  it("role.access.update is UNCHANGED — bootstrap token cannot escalate via PATCH (super-admin-only)", () => {
    // Critical: the bootstrap exception is for create-on-empty-table only.
    // Update must remain isSuperAdminField — otherwise a stolen token plus a
    // session cookie would let an editor PATCH their own role to super-admin.
    process.env.BOOTSTRAP_TOKEN = "secret-1234"
    expect(roleField.access.update(fieldReq({ user: { role: "editor" }, bootstrapHeader: "secret-1234" }))).toBe(false)
    expect(roleField.access.update(fieldReq({ user: { role: "owner" }, bootstrapHeader: "secret-1234" }))).toBe(false)
    expect(roleField.access.update(fieldReq({ user: null, bootstrapHeader: "secret-1234" }))).toBe(false)
    // Positive control:
    expect(roleField.access.update(fieldReq({ user: { role: "super-admin" } }))).toBe(true)
  })

  it("tenants.access.update is UNCHANGED — bootstrap token cannot rewrite tenants via PATCH", () => {
    process.env.BOOTSTRAP_TOKEN = "secret-1234"
    expect(tenantsField.access.update(fieldReq({ user: { role: "editor" }, bootstrapHeader: "secret-1234" }))).toBe(false)
    expect(tenantsField.access.update(fieldReq({ user: { role: "owner" }, bootstrapHeader: "secret-1234" }))).toBe(false)
    expect(tenantsField.access.update(fieldReq({ user: null, bootstrapHeader: "secret-1234" }))).toBe(false)
    expect(tenantsField.access.update(fieldReq({ user: { role: "super-admin" } }))).toBe(true)
  })

  it("role.access.create still permits authed super-admin (positive control)", () => {
    delete process.env.BOOTSTRAP_TOKEN
    expect(roleField.access.create(fieldReq({ user: { role: "super-admin" } }))).toBe(true)
  })
})
