import { describe, it, expect, afterEach } from "vitest"
import { Users } from "@/collections/Users"
import { expectAccessField } from "../_helpers/payloadFields"
import { cast } from "../_helpers/cast"
import type { FieldAccessArgs } from "../_helpers/payloadFields"

import { asPayload, matchesWhere, type MockCreateArgs, type MockDoc, type MockFindArgs, type MockUpdateArgs, type MockWhere } from "../_helpers/mockPayload"
// Audit AMENDMENT AMD-1 (T2 secondary) — Owner cannot invite team members.
//
// Background: P0 batch-1 commit cb00e47 wired `isSuperAdminField` onto
// `role.access.create` and `tenants.access.create` to close the parallel-create
// escalation surfaced by the security-review soft-note rebuttal. P1 batch-2
// commit 2002223 then relaxed those to `isSuperAdminOrBootstrapField` so the
// anonymous bootstrap seed could mint the first super-admin. Neither change
// admits the legitimate owner-invite path: an authed owner calling
// `inviteUser({role:"editor", tenantId:<own>})` has both `role` and `tenants`
// stripped by the field gate, defaultValue repopulates `role:"editor"`,
// `tenants` stays undefined, and `validateTenants` throws 400.
//
// Required fix shape (per AMD-1 §"Suggested fix"): replace the field gates on
// `role.access.create` and `tenants.access.create` ONLY with a new
// `canCreateUserField` admitting:
//   A) super-admin (always)
//   B) anonymous + valid bootstrap token AND data.role === "super-admin"
//   C) owner whose own tenant matches the supplied tenants[0].tenant AND
//      data.role ∈ {"editor", "viewer"}
//   D) everything else → false
//
// Update access stays `isSuperAdminField` — the relaxation is create-only;
// the stolen-cookie PATCH vector (P0 #2/#3) must remain closed.
//
// Test notes on red-baseline interpretation:
//   - Cases 1-2 (owner→editor/viewer own tenant — should be PERMITTED) are
//     genuinely red under current code: the gate returns false, but the test
//     expects true. After the fix they go green.
//   - Cases 3-5 (owner→owner / owner→super-admin / owner→other-tenant —
//     should be REJECTED) currently pass for the WRONG reason: the gate
//     rejects all owner cases blindly. After the fix the test still passes,
//     but for the right reason (the new gate looks at data.role and
//     data.tenants and rejects these specific shapes).
//   - Cases 6-7 (editor/viewer cannot invite) pass for the right reason
//     today and after the fix: non-(super-admin/owner/anon-bootstrap) is
//     always rejected.
//   - Case 8 (anonymous + bootstrap token + role:editor/viewer) is red under
//     current code: `isSuperAdminOrBootstrapField` permits any anonymous
//     caller with a valid token regardless of role. After the fix this is
//     rejected because the new gate's bootstrap branch requires
//     data.role === "super-admin" (re-arm guard for P1 #6).
//   - Case 9 (super-admin positive control) is green both before and after.

const reqAnon = (opts: { bootstrapHeader?: string | null } = {}) => ({
  user: null,
  headers: {
    get: (k: string) =>
      k.toLowerCase() === "x-bootstrap-token" ? (opts.bootstrapHeader ?? null) : null,
  },
})

const reqAuthed = (role: string, tenantId?: number | string | null) => ({
  user: {
    id: "u1",
    role,
    tenants: tenantId == null ? [] : [{ tenant: tenantId }],
  },
  headers: { get: () => null },
})

const inviteData = (
  role: "super-admin" | "owner" | "editor" | "viewer",
  tenantId: number | string | null
) => ({
  email: "new@example.com",
  name: "New User",
  password: "x",
  role,
  ...(tenantId == null ? { tenants: [] } : { tenants: [{ tenant: tenantId }] }),
})

const roleField = expectAccessField(Users.fields, "role")
const tenantsField = expectAccessField(Users.fields, "tenants")

const callBoth = (partial: Record<string, unknown>) => {
  const args = partial as FieldAccessArgs
  return {
    role: roleField.access.create(args),
    tenants: tenantsField.access.create(args),
  }
}

describe("AMD-1 — owner can invite editor/viewer into own tenant; everything else stays closed", () => {
  const orig = process.env.BOOTSTRAP_TOKEN
  afterEach(() => {
    if (orig === undefined) delete process.env.BOOTSTRAP_TOKEN
    else process.env.BOOTSTRAP_TOKEN = orig
  })

  it("Case 1: owner can invite EDITOR into OWN tenant (legitimate path)", () => {
    const result = callBoth({
      req: reqAuthed("owner", 42),
      data: inviteData("editor", 42),
      siblingData: inviteData("editor", 42),
    })
    expect(result.role).toBe(true)
    expect(result.tenants).toBe(true)
  })

  it("Case 2: owner can invite VIEWER into OWN tenant (legitimate path)", () => {
    const result = callBoth({
      req: reqAuthed("owner", 42),
      data: inviteData("viewer", 42),
      siblingData: inviteData("viewer", 42),
    })
    expect(result.role).toBe(true)
    expect(result.tenants).toBe(true)
  })

  it("Case 3: owner CANNOT invite another OWNER (no role-promotion within tenant)", () => {
    const result = callBoth({
      req: reqAuthed("owner", 42),
      data: inviteData("owner", 42),
      siblingData: inviteData("owner", 42),
    })
    expect(result.role).toBe(false)
    expect(result.tenants).toBe(false)
  })

  it("Case 4: owner CANNOT invite a SUPER-ADMIN (re-arm guard for P0 #2/#3)", () => {
    // The audit's P0 #2/#3 escalation shape was {role:"super-admin", tenants:[]}.
    // Test both that shape and the more obvious {role:"super-admin", tenants:[ownTenant]} —
    // owner must not be able to mint a super-admin under any tenants payload.
    const a = callBoth({
      req: reqAuthed("owner", 42),
      data: inviteData("super-admin", null),
      siblingData: inviteData("super-admin", null),
    })
    expect(a.role).toBe(false)
    expect(a.tenants).toBe(false)
    const b = callBoth({
      req: reqAuthed("owner", 42),
      data: inviteData("super-admin", 42),
      siblingData: inviteData("super-admin", 42),
    })
    expect(b.role).toBe(false)
    expect(b.tenants).toBe(false)
  })

  it("Case 5: owner CANNOT invite editor into a DIFFERENT tenant (T1 cross-tenant guard)", () => {
    const result = callBoth({
      req: reqAuthed("owner", 42),
      data: inviteData("editor", 99),
      siblingData: inviteData("editor", 99),
    })
    expect(result.role).toBe(false)
    expect(result.tenants).toBe(false)
  })

  it("Case 6: editor CANNOT invite anyone (any role / tenant)", () => {
    for (const role of ["editor", "viewer", "owner", "super-admin"] as const) {
      const args = {
        req: reqAuthed("editor", 42),
        data: inviteData(role, 42),
        siblingData: inviteData(role, 42),
      }
      const r = callBoth(args)
      expect(r.role, `editor inviting ${role}`).toBe(false)
      expect(r.tenants, `editor inviting ${role}`).toBe(false)
    }
  })

  it("Case 7: viewer CANNOT invite anyone (any role / tenant)", () => {
    for (const role of ["editor", "viewer", "owner", "super-admin"] as const) {
      const args = {
        req: reqAuthed("viewer", 42),
        data: inviteData(role, 42),
        siblingData: inviteData(role, 42),
      }
      const r = callBoth(args)
      expect(r.role, `viewer inviting ${role}`).toBe(false)
      expect(r.tenants, `viewer inviting ${role}`).toBe(false)
    }
  })

  it("Case 8: anonymous + valid BOOTSTRAP_TOKEN CANNOT mint editor/viewer/owner — only super-admin (re-arm guard for P1 #6)", () => {
    process.env.BOOTSTRAP_TOKEN = "secret-1234"
    for (const role of ["editor", "viewer", "owner"] as const) {
      const args = {
        req: reqAnon({ bootstrapHeader: "secret-1234" }),
        data: inviteData(role, 42),
        siblingData: inviteData(role, 42),
      }
      const r = callBoth(args)
      expect(r.role, `anon+token inviting ${role}`).toBe(false)
      expect(r.tenants, `anon+token inviting ${role}`).toBe(false)
    }
    // Positive sub-control: anon + token + role=super-admin still permitted
    // (Case B of the gate; matches the collection-level bootstrap path).
    const ok = callBoth({
      req: reqAnon({ bootstrapHeader: "secret-1234" }),
      data: inviteData("super-admin", null),
      siblingData: inviteData("super-admin", null),
    })
    expect(ok.role).toBe(true)
    expect(ok.tenants).toBe(true)
  })

  it("Case 9 (positive control): super-admin can create any role into any tenant shape", () => {
    // Any role, with any tenants shape — super-admin always passes.
    for (const [role, tenantId] of [
      ["super-admin", null],
      ["owner", 7],
      ["editor", 99],
      ["viewer", 1234],
    ] as const) {
      const r = callBoth({
        req: reqAuthed("super-admin"),
        data: inviteData(role, tenantId),
        siblingData: inviteData(role, tenantId),
      })
      expect(r.role, `super-admin minting ${role}`).toBe(true)
      expect(r.tenants, `super-admin minting ${role}`).toBe(true)
    }
  })

  // ---- Re-arm protection: update access on role/tenants must remain super-admin-only.
  // This guards against accidentally widening update during the create relaxation
  // (which would re-arm P0 #2 / #3 — the stolen-cookie PATCH vector).
  it("update access on role/tenants UNCHANGED — owner/editor/viewer/anon cannot PATCH (P0 #2/#3 stays closed)", () => {
    for (const role of ["editor", "viewer", "owner"]) {
      const req = { req: reqAuthed(role, 42) }
      expect(roleField.access.update(req), `${role} role.update`).toBe(false)
      expect(tenantsField.access.update(req), `${role} tenants.update`).toBe(false)
    }
    const anon = { req: reqAnon() }
    expect(roleField.access.update(anon)).toBe(false)
    expect(tenantsField.access.update(anon)).toBe(false)
    const sa = { req: reqAuthed("super-admin") }
    expect(roleField.access.update(sa)).toBe(true)
    expect(tenantsField.access.update(sa)).toBe(true)
  })
})
