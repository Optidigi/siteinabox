import { describe, it, expect, afterEach } from "vitest"
import { Users } from "@/collections/Users"
import { expectAccessField, type FieldAccessArgs } from "../_helpers/payloadFields"

import { asPayload, matchesWhere, type MockCreateArgs, type MockDoc, type MockFindArgs, type MockUpdateArgs, type MockWhere } from "../_helpers/mockPayload"
// Audit AMENDMENT AMD-2 (T2 primary, T5 secondary) — `apiKey` mass-assignment.
//
// Background: Payload v3.84.1 auto-injects three fields when a collection
// sets `auth.useAPIKey: true`:
//   - enableAPIKey (checkbox)
//   - apiKey       (text; encrypt/decrypt hooks)
//   - apiKeyIndex  (text; HMAC index used by the api-key auth strategy)
// All three ship with NO `access` property — Payload's default-allow-when-
// unspecified semantics make them writable by any caller who passes the
// collection-level access. After AMD-1, the collection-level create gate
// admits owner unconditionally, which means an owner can mass-assign
// `apiKey` on create or update and obtain attacker-known API-key
// credentials for any user in their tenant. Editor/viewer can persist
// past-cookie-expiry session via their own self-update path.
//
// Required fix shape (per AMD-2 §"Suggested fix"): declare matching-name
// overrides in Users.fields with explicit access:
//   { create: isSuperAdminField, update: isSuperAdminField }
// on enableAPIKey, apiKey, AND apiKeyIndex (defense-in-depth — apiKeyIndex
// is transitively locked when apiKey is locked, but explicit lock in case
// future Payload versions wire the hook differently).
//
// Mechanism evidence (in commit body): Payload's `mergeBaseFields` at
// node_modules/payload/dist/fields/mergeBaseFields.js:7-31 finds a matching
// field in the collection's fields by name, splices it out, and pushes
// deepMergeWithReactComponents(baseField, matchCopy). The deepmerge default
// has obj2 (matchCopy = collection's explicit field) winning on conflicts
// while preserving obj1's (baseField's) unique properties — so declaring
// {name, type, access} in Users.fields yields a merged field that retains
// the baseField's encrypt/decrypt hooks and admin config while picking up
// our access gate.
//
// Cases (8 from AMD-2 §"TDD coverage required" + 3 re-arm guards):
//
// 1. Super-admin CAN create with apiKey/enableAPIKey set       (positive ctrl)
// 2. Super-admin CAN update with apiKey/enableAPIKey set       (positive ctrl)
// 3. Owner CANNOT create with apiKey set                       (sub-vector A)
// 4. Owner CANNOT update tenant-member with apiKey set         (sub-vector C)
// 5. Owner CANNOT update self with apiKey set
// 6. Editor CANNOT update self with apiKey set                 (sub-vector B)
// 7. Viewer CANNOT update self with apiKey set
// 8. Anonymous + valid BOOTSTRAP_TOKEN: apiKey writes locked
//    (locking bootstrap from setting apiKey is the documented choice per
//    AMD-2 §"TDD coverage" Case 8 — operator rotates post-seed via the
//    super-admin path; no UI surface for self-rotation today.)
//
// Re-arm guards:
//  R1. AMD-1 owner-invite path still works (sans apiKey)
//  R2. P0 #2/#3 still closed — role/tenants UPDATE access still
//      isSuperAdminField for owner/editor/viewer
//  R3. P1 #6 still closed — bootstrap branch can ONLY mint super-admin via
//      canCreateUserField; editor/viewer/owner role rejected on anon+token
//
// Structural sanity:
//  S1. The three apiKey-related fields are explicitly declared in
//      Users.fields with .access.create AND .access.update functions
//      (the canary against the bug class — a future regression that drops
//      the declarations re-arms the default-allow gap).

const reqAnon = (opts: { bootstrapHeader?: string | null } = {}) => ({
  user: null,
  headers: {
    get: (k: string) =>
      k.toLowerCase() === "x-bootstrap-token" ? (opts.bootstrapHeader ?? null) : null,
  },
})

const reqAuthed = (role: string, tenantId?: number | string | null, id = "u1") => ({
  user: {
    id,
    role,
    tenants: tenantId == null ? [] : [{ tenant: tenantId }],
  },
  headers: { get: () => null },
})

const apiKeyField = expectAccessField(Users.fields, "apiKey")
const enableAPIKeyField = expectAccessField(Users.fields, "enableAPIKey")
const apiKeyIndexField = expectAccessField(Users.fields, "apiKeyIndex")
const roleField = expectAccessField(Users.fields, "role")
const tenantsField = expectAccessField(Users.fields, "tenants")

// Walk all three apiKey-related fields with the same args; same verdict.
const callAllApiKey = (op: "create" | "update", args: FieldAccessArgs) => ({
  apiKey: apiKeyField?.access?.[op]?.(args),
  enableAPIKey: enableAPIKeyField?.access?.[op]?.(args),
  apiKeyIndex: apiKeyIndexField?.access?.[op]?.(args),
})

describe("AMD-2 — apiKey/enableAPIKey/apiKeyIndex are super-admin-only on create AND update", () => {
  const orig = process.env.BOOTSTRAP_TOKEN
  afterEach(() => {
    if (orig === undefined) delete process.env.BOOTSTRAP_TOKEN
    else process.env.BOOTSTRAP_TOKEN = orig
  })

  // ---- Structural canary
  it("S1: apiKey, enableAPIKey, apiKeyIndex are declared with explicit create AND update access", () => {
    for (const [label, f] of [
      ["apiKey", apiKeyField],
      ["enableAPIKey", enableAPIKeyField],
      ["apiKeyIndex", apiKeyIndexField],
    ] as const) {
      expect(f, `${label} field must be declared in Users.fields`).toBeDefined()
      expect(typeof f.access?.create, `${label}.access.create must be a function`).toBe("function")
      expect(typeof f.access?.update, `${label}.access.update must be a function`).toBe("function")
    }
  })

  // ---- 8 AMD-2 TDD cases
  it("Case 1: super-admin CAN create with apiKey/enableAPIKey set (positive control)", () => {
    const args = {
      req: reqAuthed("super-admin"),
      data: { email: "n@x", password: "p", role: "editor", tenants: [{ tenant: 42 }], apiKey: "X", enableAPIKey: true },
      siblingData: {},
    }
    const r = callAllApiKey("create", args)
    expect(r.apiKey).toBe(true)
    expect(r.enableAPIKey).toBe(true)
    expect(r.apiKeyIndex).toBe(true)
  })

  it("Case 2: super-admin CAN update with apiKey/enableAPIKey set (positive control)", () => {
    const args = {
      req: reqAuthed("super-admin"),
      data: { apiKey: "Y", enableAPIKey: true },
      siblingData: {},
    }
    const r = callAllApiKey("update", args)
    expect(r.apiKey).toBe(true)
    expect(r.enableAPIKey).toBe(true)
    expect(r.apiKeyIndex).toBe(true)
  })

  it("Case 3: owner CANNOT create with apiKey set (sub-vector A)", () => {
    // Owner attempts the legit AMD-1 invite shape (role/tenants admitted) PLUS
    // mass-assigned apiKey. The apiKey/enableAPIKey/apiKeyIndex field gates
    // must reject regardless of how the role/tenants gate decided.
    const args = {
      req: reqAuthed("owner", 42),
      data: { email: "n@x", password: "p", role: "editor", tenants: [{ tenant: 42 }], apiKey: "X", enableAPIKey: true },
      siblingData: {},
    }
    const r = callAllApiKey("create", args)
    expect(r.apiKey).toBe(false)
    expect(r.enableAPIKey).toBe(false)
    expect(r.apiKeyIndex).toBe(false)
  })

  it("Case 4: owner CANNOT update tenant-member with apiKey set (sub-vector C — audit-trail forgery)", () => {
    const args = {
      req: reqAuthed("owner", 42),
      data: { apiKey: "victim-known-key", enableAPIKey: true },
      siblingData: {},
      // Note: collection-level access (canManageUsers) admits owner→tenant-member
      // via the where-filter path; the field gate is the only thing closing
      // the apiKey write surface on that PATCH.
    }
    const r = callAllApiKey("update", args)
    expect(r.apiKey).toBe(false)
    expect(r.enableAPIKey).toBe(false)
    expect(r.apiKeyIndex).toBe(false)
  })

  it("Case 5: owner CANNOT update self with apiKey set", () => {
    const args = {
      req: reqAuthed("owner", 42, "self"),
      data: { apiKey: "self-known-key", enableAPIKey: true },
      siblingData: {},
    }
    const r = callAllApiKey("update", args)
    expect(r.apiKey).toBe(false)
    expect(r.enableAPIKey).toBe(false)
    expect(r.apiKeyIndex).toBe(false)
  })

  it("Case 6: editor CANNOT update self with apiKey set (sub-vector B — persistence past credential rotation)", () => {
    const args = {
      req: reqAuthed("editor", 42, "self"),
      data: { apiKey: "persist-after-pw-rotation", enableAPIKey: true },
      siblingData: {},
    }
    const r = callAllApiKey("update", args)
    expect(r.apiKey).toBe(false)
    expect(r.enableAPIKey).toBe(false)
    expect(r.apiKeyIndex).toBe(false)
  })

  it("Case 7: viewer CANNOT update self with apiKey set", () => {
    const args = {
      req: reqAuthed("viewer", 42, "self"),
      data: { apiKey: "viewer-key", enableAPIKey: true },
      siblingData: {},
    }
    const r = callAllApiKey("update", args)
    expect(r.apiKey).toBe(false)
    expect(r.enableAPIKey).toBe(false)
    expect(r.apiKeyIndex).toBe(false)
  })

  it("Case 8: anonymous + valid BOOTSTRAP_TOKEN — apiKey writes are locked (operator rotates post-seed via super-admin path)", () => {
    // AMD-2 §"TDD coverage" Case 8 documents this as an acceptable outcome:
    // implementation locks bootstrap from setting apiKey, operator rotates
    // post-seed. There is no UI for self-rotation, so this is internally
    // consistent with the rest of the apiKey lock posture.
    process.env.BOOTSTRAP_TOKEN = "secret-1234"
    const args = {
      req: reqAnon({ bootstrapHeader: "secret-1234" }),
      data: { email: "seed@x", password: "p", role: "super-admin", tenants: [], apiKey: "seed-key", enableAPIKey: true },
      siblingData: {},
    }
    const r = callAllApiKey("create", args)
    expect(r.apiKey).toBe(false)
    expect(r.enableAPIKey).toBe(false)
    expect(r.apiKeyIndex).toBe(false)
  })

  // ---- Re-arm guards (binding)
  it("R1: AMD-1 owner-invite path still works (sans apiKey) — role/tenants admitted for owner→editor/viewer/own-tenant", () => {
    // Mirrors Cases 1-2 of audit-amendment-1-owner-invite.test.ts. AMD-2's
    // changes must not affect the role/tenants field gates.
    const editorArgs = {
      req: reqAuthed("owner", 42),
      data: { email: "new@x", role: "editor", tenants: [{ tenant: 42 }] },
      siblingData: {},
    }
    expect(roleField.access.create(editorArgs)).toBe(true)
    expect(tenantsField.access.create(editorArgs)).toBe(true)

    const viewerArgs = {
      req: reqAuthed("owner", 42),
      data: { email: "new@x", role: "viewer", tenants: [{ tenant: 42 }] },
      siblingData: {},
    }
    expect(roleField.access.create(viewerArgs)).toBe(true)
    expect(tenantsField.access.create(viewerArgs)).toBe(true)
  })

  it("R2: P0 #2/#3 still closed — role/tenants UPDATE access still rejects owner/editor/viewer/anon", () => {
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

  it("R3: P1 #6 still closed — anon+token can ONLY mint super-admin role via canCreateUserField; editor/viewer/owner rejected", () => {
    process.env.BOOTSTRAP_TOKEN = "secret-1234"
    for (const role of ["editor", "viewer", "owner"] as const) {
      const args = {
        req: reqAnon({ bootstrapHeader: "secret-1234" }),
        data: { email: "n@x", role, tenants: [{ tenant: 42 }] },
        siblingData: {},
      }
      expect(roleField.access.create(args), `anon+token role=${role}`).toBe(false)
      expect(tenantsField.access.create(args), `anon+token role=${role}`).toBe(false)
    }
    // Positive sub-control: anon + token + role=super-admin still permitted
    // (AMD-2 must not regress the bootstrap super-admin admit).
    const ok = {
      req: reqAnon({ bootstrapHeader: "secret-1234" }),
      data: { email: "seed@x", role: "super-admin", tenants: [] },
      siblingData: {},
    }
    expect(roleField.access.create(ok)).toBe(true)
    expect(tenantsField.access.create(ok)).toBe(true)
  })
})
