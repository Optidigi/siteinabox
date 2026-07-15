import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { Users } from "@/collections/Users"

// Audit AMENDMENT AMD-3 (T2 secondary) — `ApiKeyManager` UI silently no-ops
// for non-super-admin (regression introduced by AMD-2 commit f6957af).
//
// Background: AMD-2's field-level access (`isSuperAdminField`) on apiKey /
// enableAPIKey / apiKeyIndex correctly strips those fields from any non-super-
// admin write. But Payload's strip cascade returns HTTP 200 with the offending
// fields silently removed — not a 403. The self-rotation UI at
// `src/components/forms/ApiKeyManager.tsx` PATCHes /api/users/<self> with
// {apiKey, enableAPIKey} and reads the 200 as success, displaying a key that
// was never persisted. Two coordinated fixes:
//
//  1. Server-side honest rejection — collection-level hook that throws
//     `Forbidden` (HTTP 403) when a non-super-admin update names any of
//     apiKey / enableAPIKey / apiKeyIndex in `data`. AMD-2's field-level
//     access stays untouched as defense-in-depth — both layers active.
//
//  2. Client-side UI gating — the `/api-key` page renders a friendly
//     placeholder for non-super-admin instead of mounting `ApiKeyManager`.
//
// Hook ordering (Payload v3.84.1 source verbatim):
//   `node_modules/payload/dist/collections/operations/utilities/update.js:13-24`
//   documents the order: beforeOperation (collection) → beforeValidate (fields,
//   where AMD-2 strip happens) → beforeValidate (collection) → beforeChange
//   (collection) → beforeChange (fields). The AMD-3 hook MUST run BEFORE the
//   field-strip — both `beforeChange` and `beforeValidate` collection hooks
//   run AFTER the strip, by which time `data.apiKey` has already been deleted
//   and the hook cannot detect the attempt. Only `beforeOperation` fires
//   early enough; see `node_modules/payload/dist/collections/operations/
//   utilities/buildBeforeOperation.js:6-22` and `updateByID.js:25-30`.
//
// Cases (10 from AMD-3 §"TDD coverage required" + 3 re-arm guards):
//
//   1. (server, +) super-admin PATCH self with apiKey   → permitted
//   2. (UI,     +) /api-key with role=super-admin       → ApiKeyManager mounts
//   3. (server, -) editor PATCH self with apiKey        → 403 (sub-vector B)
//   4. (server, -) owner PATCH tenant-member w/ apiKey  → 403 (sub-vector C)
//   5. (server, -) viewer PATCH self with apiKey        → 403
//   6. (server, -) owner PATCH self enableAPIKey:false  → 403 (any write rejected)
//   7. (server, +) owner PATCH self with name only      → permitted (collateral)
//   8. (UI,     -) /api-key with role=owner             → placeholder
//   9. (UI,     -) /api-key with role=editor            → placeholder
//  10. (UI,     -) /api-key with role=viewer            → placeholder
//
// Re-arm guards:
//   R1. AMD-1: owner-invite path still works (role/tenants admit unchanged)
//   R2. AMD-2 field-level access on apiKey/enableAPIKey/apiKeyIndex unchanged
//   R3. AMD-2 sub-vector A: super-admin can STILL create user with apiKey
//       (the new hook fires only on operation === "update", not "create").

// -----------------------------------------------------------------------------
// Server-side hook extraction
// -----------------------------------------------------------------------------

const beforeOperationHooks = (Users.hooks?.beforeOperation ?? []) as Array<
  (args: any) => any
>
// AMD-3 fix adds the FIRST (and currently ONLY) beforeOperation hook on Users.
// If a future change appends more hooks, this index assumption needs revisiting
// — guarded by the structural canary S1 below.
const apiKeyHonestRejectHook = beforeOperationHooks[0]

// Synthetic req factory mirroring the AMD-2 test's reqAuthed/reqAnon shapes.
const reqAuthed = (role: string, tenantId?: number | string | null, id = "u1") => ({
  user: {
    id,
    role,
    tenants: tenantId == null ? [] : [{ tenant: tenantId }],
  },
  headers: { get: () => null },
  // Payload's Forbidden constructor reads req.t for i18n; a no-op identity
  // suffices for unit tests (en-fallback path inside Forbidden.js).
  t: (key: string) => key,
})

// Hook invocation helper. The Payload v3.84.1 beforeOperation hook signature
// (per node_modules/payload/dist/collections/operations/utilities/buildBeforeOperation.js:11-18):
//   ({ args, collection, context, operation, overrideAccess, req }) => args
// We pass minimal stubs for fields we don't depend on. Wrap the call in an
// `async` IIFE so a synchronous throw (e.g. when the hook isn't installed
// yet, in the TDD-red baseline) surfaces as a promise rejection that
// `expect(...).rejects.toThrow()` can match.
const callHook = async (opts: { operation: "update" | "create"; req: any; data: any }) =>
  (apiKeyHonestRejectHook as (a: any) => any)({
    args: { data: opts.data, req: opts.req },
    collection: {} as any,
    context: {},
    operation: opts.operation,
    overrideAccess: false,
    req: opts.req,
  })

// Stronger assertion for "Forbidden was thrown": Payload's Forbidden class
// (node_modules/payload/dist/errors/Forbidden.js) extends APIError with
// httpStatus.FORBIDDEN === 403. Asserting status === 403 is more specific
// than `.rejects.toThrow()` (which would also match a generic TypeError in
// the TDD-red baseline before the hook exists).
const expectForbidden = async (promise: Promise<any>) => {
  let err: any = null
  try {
    await promise
  } catch (e) {
    err = e
  }
  expect(err, "expected the hook to throw").not.toBeNull()
  expect(err?.status, "expected a 403 Forbidden, not a generic Error").toBe(403)
}

// -----------------------------------------------------------------------------
// Server-side hook tests
// -----------------------------------------------------------------------------

describe("AMD-3 — beforeOperation hook honestly rejects non-super-admin apiKey writes (HTTP 403, not silent strip)", () => {
  it("S1: Users.hooks.beforeOperation has at least one hook, and the AMD-3 honest-rejection hook is at index 0 (preserved across audit-p1 #5 layer-2 hook addition)", () => {
    // The "exactly one" structural assumption was relaxed when audit-p1 #5
    // sub-fix 1 layer-2 added a second beforeOperation hook
    // (`rejectBogusAuthForgotPassword`). The AMD-3 hook
    // (`rejectNonSuperAdminApiKeyWrites`) is registered first and remains
    // at index 0; the new hook only fires on `operation === "forgotPassword"`
    // so it cannot mask AMD-3's update-path coverage.
    expect(beforeOperationHooks.length).toBeGreaterThanOrEqual(1)
    expect(typeof apiKeyHonestRejectHook).toBe("function")
  })

  it("Case 1: super-admin PATCH self with {apiKey, enableAPIKey, apiKeyIndex} → does NOT throw (positive control; rotation flow preserved)", async () => {
    let threw = false
    try {
      await callHook({
        operation: "update",
        req: reqAuthed("super-admin", null, "sa1"),
        data: { apiKey: "X", enableAPIKey: true, apiKeyIndex: "Y" },
      })
    } catch {
      threw = true
    }
    expect(threw).toBe(false)
  })

  it("Case 3: editor PATCH self with {apiKey} → throws Forbidden (HTTP 403; sub-vector B honest rejection)", async () => {
    await expectForbidden(
      callHook({
        operation: "update",
        req: reqAuthed("editor", 42, "self"),
        data: { apiKey: "persist-after-pw-rotation" },
      })
    )
  })

  it("Case 4: owner PATCH tenant-member with {apiKey} → throws Forbidden (HTTP 403; sub-vector C honest rejection)", async () => {
    await expectForbidden(
      callHook({
        operation: "update",
        req: reqAuthed("owner", 42, "owner-self"),
        data: { apiKey: "victim-known-key", enableAPIKey: true },
      })
    )
  })

  it("Case 5: viewer PATCH self with {apiKey} → throws Forbidden (HTTP 403)", async () => {
    await expectForbidden(
      callHook({
        operation: "update",
        req: reqAuthed("viewer", 42, "self"),
        data: { apiKey: "viewer-key" },
      })
    )
  })

  it("Case 6: owner PATCH self with {enableAPIKey: false} → throws Forbidden (sending the key at all is the user's intent — `in` check, not truthiness)", async () => {
    // Per AMD-3 §"Hook condition shape": "Use `in` checks rather than truthiness
    // checks — sending `apiKey: null` or `enableAPIKey: false` is a write attempt
    // and should also reject."
    await expectForbidden(
      callHook({
        operation: "update",
        req: reqAuthed("owner", 42, "self"),
        data: { enableAPIKey: false },
      })
    )
    // Same check for explicit-null apiKey — `apiKey: null` is also a write attempt.
    await expectForbidden(
      callHook({
        operation: "update",
        req: reqAuthed("owner", 42, "self"),
        data: { apiKey: null },
      })
    )
    // And for apiKeyIndex (defense-in-depth on the third field).
    await expectForbidden(
      callHook({
        operation: "update",
        req: reqAuthed("owner", 42, "self"),
        data: { apiKeyIndex: "X" },
      })
    )
  })

  it("Case 7: owner PATCH self with {name:'Y'} only (no apiKey-related field) → does NOT throw (collateral check; hook is targeted)", async () => {
    let threw = false
    try {
      await callHook({
        operation: "update",
        req: reqAuthed("owner", 42, "self"),
        data: { name: "Y" },
      })
    } catch {
      threw = true
    }
    expect(threw).toBe(false)
  })

  it("Anonymous PATCH (req.user == null) with {apiKey} → still throws Forbidden (defense-in-depth; collection-level update access rejects null user upstream, but the hook also rejects on its own)", async () => {
    // The hook's branch on `req.user?.role !== "super-admin"` is reachable for
    // anonymous callers too: `null?.role !== "super-admin"` evaluates to `true`
    // (undefined !== "super-admin"). Walked verbatim per AMD-3 adversarial
    // verification item 4. Anonymous PATCH should be unreachable in practice
    // (Users.access.update = canManageUsers rejects req.user == null), but
    // testing the hook's standalone correctness is part of belt-and-braces.
    const reqAnon = {
      user: null,
      headers: { get: () => null },
      t: (k: string) => k,
    }
    await expectForbidden(
      callHook({ operation: "update", req: reqAnon, data: { apiKey: "X" } })
    )
  })
})

// -----------------------------------------------------------------------------
// Re-arm guard tests
// -----------------------------------------------------------------------------

describe("AMD-3 — re-arm guards (AMD-1 / AMD-2 must remain closed)", () => {
  const orig = process.env.BOOTSTRAP_TOKEN
  afterEach(() => {
    if (orig === undefined) delete process.env.BOOTSTRAP_TOKEN
    else process.env.BOOTSTRAP_TOKEN = orig
  })

  const fields = Users.fields as any[]
  const apiKeyField = fields.find((f) => f.name === "apiKey")
  const enableAPIKeyField = fields.find((f) => f.name === "enableAPIKey")
  const apiKeyIndexField = fields.find((f) => f.name === "apiKeyIndex")
  const roleField = fields.find((f) => f.name === "role")
  const tenantsField = fields.find((f) => f.name === "tenants")

  it("R1 (AMD-1): owner can still invite editor/viewer into own tenant — role.access.create + tenants.access.create unchanged", () => {
    // Mirrors AMD-1 Case 1/2. AMD-3's changes must not regress these.
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

  it("R2 (AMD-2): apiKey / enableAPIKey / apiKeyIndex field-level access UNCHANGED — still isSuperAdminField for create AND update (defense-in-depth layer not relaxed)", () => {
    // The whole point of AMD-3 is that the field-level access STAYS — the new
    // hook stacks on top, providing honest rejection. Relaxing the field
    // access for any "self-rotation" use case re-arms AMD-2 sub-vector B.
    for (const [label, f] of [
      ["apiKey", apiKeyField],
      ["enableAPIKey", enableAPIKeyField],
      ["apiKeyIndex", apiKeyIndexField],
    ] as const) {
      // Super-admin → true for both ops
      expect(f.access.create({ req: reqAuthed("super-admin") }), `${label}.create sa`).toBe(true)
      expect(f.access.update({ req: reqAuthed("super-admin") }), `${label}.update sa`).toBe(true)
      // Owner / editor / viewer / anon → false for both ops
      for (const role of ["owner", "editor", "viewer"]) {
        expect(f.access.create({ req: reqAuthed(role, 42) }), `${label}.create ${role}`).toBe(false)
        expect(f.access.update({ req: reqAuthed(role, 42) }), `${label}.update ${role}`).toBe(false)
      }
      const anon = { req: { user: null, headers: { get: () => null } } }
      expect(f.access.create(anon), `${label}.create anon`).toBe(false)
      expect(f.access.update(anon), `${label}.update anon`).toBe(false)
    }
  })

  it("R3 (AMD-2 sub-vector A): super-admin can STILL create user with {apiKey, enableAPIKey} — new hook does NOT fire on operation==='create'", async () => {
    // Sub-vector A closure said: super-admin's legitimate seed-with-apiKey
    // shape must continue to work. The hook must guard `operation === "update"`
    // and skip `create`. If a future refactor accidentally drops the operation
    // check, this test trips.
    let threw = false
    try {
      await callHook({
        operation: "create",
        req: reqAuthed("super-admin", null, "sa1"),
        data: { email: "n@x", role: "super-admin", apiKey: "seed-key", enableAPIKey: true },
      })
    } catch {
      threw = true
    }
    expect(threw).toBe(false)

    // And — bonus tightness — the hook also doesn't fire on create for
    // non-super-admin (the create surface is governed by AMD-2's field-level
    // access, which strips apiKey for owner; no need to double-throw).
    let threwOwnerCreate = false
    try {
      await callHook({
        operation: "create",
        req: reqAuthed("owner", 42, "owner1"),
        data: { email: "n@x", role: "editor", tenants: [{ tenant: 42 }], apiKey: "X" },
      })
    } catch {
      threwOwnerCreate = true
    }
    expect(threwOwnerCreate).toBe(false)
  })
})

// -----------------------------------------------------------------------------
// UI gating tests (Cases 2, 8, 9, 10)
// -----------------------------------------------------------------------------

// Mock the page's dependencies. The page is a Server Component; we replace
// requireAuth (and the legacy requireRole the existing page calls) with a
// stub returning a synthetic { user, ctx } per test. We also stub the
// non-essential UI children so we can identify them by their function
// reference in the rendered React tree.
vi.mock("@/lib/authGate", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}))
vi.mock("@/components/page-header", () => ({
  PageHeader: function PageHeaderMock() {
    return null
  },
}))
vi.mock("@/components/forms/ApiKeyManager", () => ({
  ApiKeyManager: function ApiKeyManagerMock() {
    return null
  },
}))
// next/navigation's redirect is called by requireRole on mismatch in the
// existing page. Stub so it doesn't crash if hit (it shouldn't, post-fix).
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect called: ${path}`)
  }),
}))
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}))

// Walk a React element tree and report whether any node has `type === target`.
const treeContains = (node: any, target: any): boolean => {
  if (node == null || typeof node !== "object") return false
  if (Array.isArray(node)) return node.some((n) => treeContains(n, target))
  if (node.type === target) return true
  return treeContains(node.props?.children, target)
}

describe("AMD-3 — /api-key page renders ApiKeyManager only for super-admin; non-super-admin sees a placeholder (no silent fake-success UI)", () => {
  let ApiKeyPage: any
  let ApiKeyManagerMock: any
  let requireAuthMock: any
  let requireRoleMock: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const auth = await import("@/lib/authGate")
    requireAuthMock = auth.requireAuth as any
    requireRoleMock = auth.requireRole as any
    const apiKeyManagerModule = await import("@/components/forms/ApiKeyManager")
    ApiKeyManagerMock = apiKeyManagerModule.ApiKeyManager
    const pageModule = await import("@/app/(frontend)/(admin)/api-key/page")
    ApiKeyPage = pageModule.default
  })

  const synthCtx = { tenant: null, host: "admin.test" } as any

  // Helper: stub BOTH requireAuth (post-fix call) and requireRole (legacy
  // pre-fix call) with the same return shape, so the test asserts the
  // role-branching outcome regardless of which gate the page currently uses.
  // Pre-fix the page calls requireRole and renders ApiKeyManager unconditionally
  // (the test for non-super-admin then fails — TDD red); post-fix the page
  // calls requireAuth and branches (test passes — TDD green).
  const stubGate = (user: { id: string; role: string; tenants: any[] }) => {
    const result = { user, ctx: synthCtx }
    requireAuthMock.mockResolvedValue(result)
    requireRoleMock.mockResolvedValue(result)
  }

  it("Case 2: super-admin → ApiKeyManager IS in the rendered tree (positive UI control; rotation flow preserved)", async () => {
    stubGate({ id: "sa1", role: "super-admin", tenants: [] })
    const tree = await ApiKeyPage()
    expect(treeContains(tree, ApiKeyManagerMock)).toBe(true)
  })

  it("Case 8: owner → ApiKeyManager NOT in the rendered tree (placeholder rendered instead)", async () => {
    stubGate({ id: "o1", role: "owner", tenants: [{ tenant: 42 }] })
    const tree = await ApiKeyPage()
    expect(treeContains(tree, ApiKeyManagerMock)).toBe(false)
  })

  it("Case 9: editor → ApiKeyManager NOT in the rendered tree (placeholder rendered instead)", async () => {
    stubGate({ id: "e1", role: "editor", tenants: [{ tenant: 42 }] })
    const tree = await ApiKeyPage()
    expect(treeContains(tree, ApiKeyManagerMock)).toBe(false)
  })

  it("Case 10: viewer → ApiKeyManager NOT in the rendered tree (placeholder rendered instead)", async () => {
    stubGate({ id: "v1", role: "viewer", tenants: [{ tenant: 42 }] })
    const tree = await ApiKeyPage()
    expect(treeContains(tree, ApiKeyManagerMock)).toBe(false)
  })
})
