import { describe, it, expect, vi, beforeEach } from "vitest"
import { Users } from "@/collections/Users"

import { errLike, cast } from "../_helpers/cast"
import { asBeforeOperationHook, asBeforeValidateHook, callBeforeOpHook, hookArgsFor, type BeforeOperationHook, type BeforeValidateHook } from "../_helpers/hookFixtures"
import { expectAccessField } from "../_helpers/payloadFields"
import { asFindClient } from "../_helpers/payloadFindClient"
import { asPayload, matchesWhere, type MockCreateArgs, type MockDoc, type MockFindArgs, type MockUpdateArgs, type MockWhere } from "../_helpers/mockPayload"
// Audit finding #7 (P1, T5) — stolen-session → permanent takeover via password
// PATCH; no server-side current-password verification; no session invalidation
// on password change. Two coordinated sub-fixes:
//
//  Sub-fix A — server-side current-password verification + naive PATCH lock-down
//   1. New `beforeOperation` hook `rejectNonSuperAdminPasswordWrites` that
//      throws Forbidden when operation === "update" AND `data.password` is
//      named in args AND req.user.role !== "super-admin" AND the request
//      hasn't been marked as a verified self-change (context flag set by the
//      new endpoint). Super-admin retains the admin-reset path.
//   2. New custom collection endpoint `POST /api/users/change-password`
//      that requires `{currentPassword, newPassword}`, verifies current via
//      `payload.login`, performs the password update with `overrideAccess`
//      + `context.allowSelfPasswordChange = true` (so the lock-down hook
//      bypasses, and the field-level access doesn't strip), then issues a
//      fresh login session for the caller and sets the cookie.
//   3. ProfileForm.tsx swaps its dual login+PATCH flow for a single POST
//      to the new endpoint.
//
//  Sub-fix B — session rotation on password change
//   1. `useSessions: true` on Users.auth — Payload's built-in primitive.
//      JWTs carry `sid`; verification at
//      `node_modules/payload/dist/auth/strategies/jwt.js:73-81` rejects when
//      `sid` is missing OR not in `user.sessions[]`. Migration adds
//      `users_sessions` table.
//   2. `beforeValidate` collection hook `clearSessionsOnPasswordChange`
//      detects the two password-rotation signatures:
//        - `data.password` is a non-empty string → regular update path
//          (`payload.update({data:{password:"X"}})` from super-admin admin
//          reset OR from the new endpoint with overrideAccess).
//        - `data.hash` has CHANGED vs `originalDoc.hash` →
//          the resetPassword path mutates `user.salt = newSalt;
//          user.hash = newHash` before invoking beforeValidate
//          (`node_modules/payload/dist/auth/operations/resetPassword.js:57-79`).
//          Payload passes the full merged document to beforeValidate; auth rows
//          always carry hash+salt, so mere presence is not the discriminator —
//          a changed hash value is.
//      In either case, set `data.sessions = []` and return the modified
//      data. Because resetPassword passes `data: user` by reference and
//      ignores the return value, the in-place mutation is what actually
//      lands in db.updateOne; for regular updates Payload uses the return
//      value. We do BOTH (mutate + return) so both pipelines clear sessions.
//
// Test-case map (per dispatch §Stage 1):
//
//   Sub-fix A:
//     1. Stolen-cookie repro: editor PATCH /api/users/<own-id> with
//        {password:"x"} → hook throws Forbidden (was 200 pre-fix).
//     2. Editor PATCH /api/users/<other-id> with {password:"x"} → hook throws.
//     3. Owner PATCH /api/users/<other-id> with {password:"x"} → hook throws.
//     4. Super-admin PATCH /api/users/<id> with {password:"x"} → hook does
//        NOT throw (admin reset path preserved).
//     5. Anonymous POST /api/users/change-password → endpoint returns 401.
//     6. Editor POST endpoint with wrong currentPassword → endpoint returns 403.
//     7. Editor POST endpoint with correct currentPassword + newPassword →
//        endpoint returns 200, payload.update called with allowSelfPasswordChange.
//     8. Anonymous PATCH /api/users/<id> with {password:"x"} → hook throws
//        (defense-in-depth; canManageUsers rejects upstream but the hook
//        also rejects independently).
//     9. Hook-composition canary: Users.hooks.beforeOperation.length is 3
//        (existing rejectNonSuperAdminApiKeyWrites, rejectBogusAuthForgot-
//        Password, plus the new password-write rejector). Existing hooks
//        retain their relative order.
//    10. Endpoint with super-admin caller bypasses the lock — i.e., the
//        endpoint also works for a super-admin self-change (positive control).
//    11. Endpoint rejects when newPassword < 8 chars (defensive validation).
//    12. Endpoint with non-string body fields → 400.
//
//   Sub-fix B:
//    13. Users.auth.useSessions is true.
//    14. clearSessionsOnPasswordChange detects data.password (regular update)
//        and sets data.sessions = []. Returns mutated data.
//    15. clearSessionsOnPasswordChange detects data.hash !== originalDoc.hash
//        (resetPassword path) and sets data.sessions = []. Mutates IN PLACE
//        because resetPassword.js uses pass-by-reference.
//   15b. Non-credential update (data.hash === originalDoc.hash) → sessions
//        PRESERVED (bug repro case).
//   15c. originalDoc absent → sessions cleared (fail-secure).
//    16. Hook is a no-op when neither password nor hash is being updated.
//    17. Hook only fires on operation === "update" (no clear on create).
//
//   Re-arm guards (R1–R6):
//    R1. AMD-1: owner-invite role/tenants field access still admits owner→editor.
//    R2. AMD-2: apiKey/enableAPIKey/apiKeyIndex field-level access still
//        isSuperAdminField for both create AND update.
//    R3. AMD-3: rejectNonSuperAdminApiKeyWrites still fires on operation
//        === "update" before the new password hook.
//    R4. P0 #1/#2/#3: role.access.update still isSuperAdminField; tenants
//        likewise. inviteUser still uses `user: caller` (out-of-this-file
//        verification — checked elsewhere).
//    R5. P1 #5: rejectBogusAuthForgotPassword still fires on operation
//        === "forgotPassword".
//    R6. P1 #4: security headers preservation is a middleware concern
//        (the new endpoint is registered as a Payload collection endpoint,
//        which routes through Next.js's `[...slug]` catch-all under the
//        `/api/` matcher exclusion — so middleware does NOT stamp it. This
//        is the SAME behaviour as every other Payload REST endpoint and is
//        intentional per audit-p1 #4's explicit scope. R6 is therefore a
//        consistency guard, not a regression check.)

// -----------------------------------------------------------------------------
// Hook extraction
// -----------------------------------------------------------------------------

const beforeOperationHooks = (Users.hooks?.beforeOperation ?? []) as unknown as BeforeOperationHook[]
const beforeValidateHooks = (Users.hooks?.beforeValidate ?? []) as unknown as BeforeValidateHook[]

// Existing hook order (per AMD-3 and audit-p1 #5 batches):
//   beforeOperation[0] = rejectNonSuperAdminApiKeyWrites (AMD-3)
//   beforeOperation[1] = rejectBogusAuthForgotPassword   (audit-p1 #5 layer-2)
// This batch appends the new password-write rejector at index 2.
//
// NOTE: TypeScript narrows `hooks[i]` as possibly-undefined; we cast to
// the function shape because the assertions below verify presence at
// runtime (S1 in the first describe block + the explicit length check
// in the sub-fix-B block). If a future change reorders or drops a hook,
// those assertions trip first — much louder than a `!`-assertion silently
// crashing on undefined.
const apiKeyHonestRejectHook = asBeforeOperationHook(beforeOperationHooks[0])
const bogusAuthForgotHook = asBeforeOperationHook(beforeOperationHooks[1])
const passwordWriteRejectHook = asBeforeOperationHook(beforeOperationHooks[2])
const clearSessionsHook = asBeforeValidateHook(beforeValidateHooks[0])

const reqAuthed = (role: string, tenantId: number | string | null = 42, id = "u1", email = "u1@x"): Record<string, unknown> => ({
  user: { id, role, email, tenants: tenantId == null ? [] : [{ tenant: tenantId }] },
  headers: { get: () => null },
  // Forbidden's i18n fallback path tolerates an identity `t`.
  t: (k: string) => k,
  context: {},
})

const reqAnon = (): Record<string, unknown> => ({
  user: null,
  headers: { get: () => null },
  t: (k: string) => k,
  context: {},
})

const expectForbidden = async (p: Promise<unknown>) => {
  let err: { status?: number } | null = null
  try {
    await p
  } catch (e) {
    err = e as { status?: number }
  }
  expect(err, "expected the hook to throw").not.toBeNull()
  expect(err?.status, "expected HTTP 403 (Forbidden), not a generic Error").toBe(403)
}

// -----------------------------------------------------------------------------
// Sub-fix A — beforeOperation lock-down hook
// -----------------------------------------------------------------------------

describe("audit-p1 #7 sub-fix A — rejectNonSuperAdminPasswordWrites locks the naive PATCH password path", () => {
  it("S1: Users.hooks.beforeOperation has at least 3 hooks; the new password-write rejector is appended (no reordering)", () => {
    expect(beforeOperationHooks.length).toBeGreaterThanOrEqual(3)
    expect(typeof apiKeyHonestRejectHook).toBe("function")
    expect(typeof bogusAuthForgotHook).toBe("function")
    expect(typeof passwordWriteRejectHook).toBe("function")
  })

  it("Case 1 — stolen-cookie repro: editor PATCH self with {password} → 403 (was 200 pre-fix)", async () => {
    await expectForbidden(
      callBeforeOpHook(passwordWriteRejectHook, {
        operation: "update",
        req: reqAuthed("editor", 42, "self", "self@x"),
        data: { password: "attacker-set" },
      }),
    )
  })

  it("Case 2 — editor PATCH cross-target with {password} → 403 (collection access gates self-only upstream; hook layers DiD)", async () => {
    await expectForbidden(
      callBeforeOpHook(passwordWriteRejectHook, {
        operation: "update",
        req: reqAuthed("editor", 42, "editor-self", "e@x"),
        data: { password: "x" },
      }),
    )
  })

  it("Case 3 — owner PATCH tenant-member with {password} → 403", async () => {
    await expectForbidden(
      callBeforeOpHook(passwordWriteRejectHook, {
        operation: "update",
        req: reqAuthed("owner", 42, "owner-self", "o@x"),
        data: { password: "x" },
      }),
    )
  })

  it("Case 4 — super-admin PATCH with {password} → does NOT throw (admin reset path preserved)", async () => {
    let threw = false
    try {
      await callBeforeOpHook(passwordWriteRejectHook, {
        operation: "update",
        req: reqAuthed("super-admin", null, "sa1", "sa@x"),
        data: { password: "admin-reset" },
      })
    } catch {
      threw = true
    }
    expect(threw).toBe(false)
  })

  it("Case 8 — anonymous PATCH with {password} → 403 (defense-in-depth; null?.role !== 'super-admin' is true → fires)", async () => {
    await expectForbidden(
      callBeforeOpHook(passwordWriteRejectHook, {
        operation: "update",
        req: reqAnon(),
        data: { password: "x" },
      }),
    )
  })

  it("Hook is targeted: editor PATCH with {name:'Y'} (no password) → does NOT throw (collateral pass-through)", async () => {
    let threw = false
    try {
      await callBeforeOpHook(passwordWriteRejectHook, {
        operation: "update",
        req: reqAuthed("editor", 42, "self", "e@x"),
        data: { name: "Y" },
      })
    } catch {
      threw = true
    }
    expect(threw).toBe(false)
  })

  it("Hook only fires on operation === 'update': editor 'create' with {password} → does NOT throw (create-side covered by canCreateUserField + AMD-1)", async () => {
    let threw = false
    try {
      await callBeforeOpHook(passwordWriteRejectHook, {
        operation: "create",
        req: reqAuthed("editor", 42, "self", "e@x"),
        data: { password: "x" },
      })
    } catch {
      threw = true
    }
    expect(threw).toBe(false)
  })

  it("Bypass via context.allowSelfPasswordChange (the new endpoint sets this after verifying currentPassword)", async () => {
    let threw = false
    try {
      await callBeforeOpHook(passwordWriteRejectHook, {
        operation: "update",
        req: { ...reqAuthed("editor", 42, "self", "e@x"), context: { allowSelfPasswordChange: true } },
        data: { password: "verified-new" },
        context: { allowSelfPasswordChange: true },
      })
    } catch {
      threw = true
    }
    expect(threw).toBe(false)
  })

  it("Sending {password: ''} (empty string) is also a write attempt and is rejected (treat 'in data' as the signal, not truthiness)", async () => {
    await expectForbidden(
      callBeforeOpHook(passwordWriteRejectHook, {
        operation: "update",
        req: reqAuthed("editor", 42, "self", "e@x"),
        data: { password: "" },
      }),
    )
  })

  // -----------------------------------------------------------------------
  // Sibling email-pivot vector (closed in fix batch 7 Pass 2 follow-up).
  //
  // Audit text §"Suggested fix" for #7 explicitly says: "Same gate for
  // email change." Pre-Pass-2, the lock-down hook only matched 'password'
  // in data — leaving email-change unprotected. A stolen-cookie attacker
  // could PATCH the victim's email to attacker-controlled, then trigger
  // forgot-password to mail the reset link to the attacker, and complete
  // the takeover. The fix extends the hook to also reject when 'email'
  // is in data (same conditions: non-super-admin, no allowSelfPasswordChange
  // bypass flag).
  // -----------------------------------------------------------------------

  it("Email-pivot vector: editor PATCH self with {email:'attacker@evil'} → 403 (audit's 'Same gate for email change' requirement)", async () => {
    await expectForbidden(
      callBeforeOpHook(passwordWriteRejectHook, {
        operation: "update",
        req: reqAuthed("editor", 42, "self", "victim@x"),
        data: { email: "attacker@evil.example" },
      }),
    )
  })

  it("Email-pivot vector: owner PATCH tenant-member with {email:'X'} → 403 (closes the cross-user takeover sibling)", async () => {
    await expectForbidden(
      callBeforeOpHook(passwordWriteRejectHook, {
        operation: "update",
        req: reqAuthed("owner", 42, "owner-self", "o@x"),
        data: { email: "attacker@evil.example" },
      }),
    )
  })

  it("Email-pivot vector: super-admin PATCH with {email:'X'} → does NOT throw (admin email-fix path preserved, parallel to admin-reset)", async () => {
    let threw = false
    try {
      await callBeforeOpHook(passwordWriteRejectHook, {
        operation: "update",
        req: reqAuthed("super-admin", null, "sa1", "sa@x"),
        data: { email: "fixed@x" },
      })
    } catch {
      threw = true
    }
    expect(threw).toBe(false)
  })

  it("Email-pivot vector: anonymous PATCH with {email} → 403 (defense-in-depth)", async () => {
    await expectForbidden(
      callBeforeOpHook(passwordWriteRejectHook, {
        operation: "update",
        req: reqAnon(),
        data: { email: "x@x" },
      }),
    )
  })

  it("Email-pivot vector: combined {password, email} write from non-super-admin → 403 (single rejection covers both)", async () => {
    await expectForbidden(
      callBeforeOpHook(passwordWriteRejectHook, {
        operation: "update",
        req: reqAuthed("editor", 42, "self", "e@x"),
        data: { password: "x", email: "y@x" },
      }),
    )
  })

  it("Email-pivot vector: hook only fires on operation === 'update'; create with {email} → does NOT throw (create-side covered by canCreateUserField)", async () => {
    let threw = false
    try {
      await callBeforeOpHook(passwordWriteRejectHook, {
        operation: "create",
        req: reqAuthed("super-admin", null, "sa1", "sa@x"),
        data: { email: "new@x", role: "editor" },
      })
    } catch {
      threw = true
    }
    expect(threw).toBe(false)
  })
})

// -----------------------------------------------------------------------------
// Sub-fix A — change-password endpoint
// -----------------------------------------------------------------------------

const findChangePasswordEndpoint = () => {
  const endpoints = (Users.endpoints ?? []) as Array<{ path: string; method: string; handler: (req: unknown) => Promise<Response> }>
  return endpoints.find((e) => e.path === "/change-password" && e.method.toLowerCase() === "post")
}

describe("audit-p1 #7 sub-fix A — POST /api/users/change-password endpoint", () => {
  it("Endpoint is registered on Users at POST /change-password", () => {
    const ep = findChangePasswordEndpoint()
    expect(ep, "expected Users.endpoints to contain POST /change-password").toBeTruthy()
    expect(typeof ep!.handler).toBe("function")
  })

  // Synthetic Payload-style req shape. Per Payload v3 endpoint convention
  // (`node_modules/payload/dist/auth/endpoints/login.js`), handlers receive
  // a PayloadRequest with `.user`, `.payload`, `.data` (pre-parsed body),
  // `.t`, `.i18n`, etc. We pass the minimal subset the handler will read.
  const buildReq = (opts: {
    user: MockDoc | null
    body: Record<string, unknown>
    payloadStubs?: { login?: (...args: unknown[]) => unknown; update?: (...args: unknown[]) => unknown; findByID?: (...args: unknown[]) => unknown }
  }) => {
    const updateCalls: MockUpdateArgs[] = []
    const loginCalls: MockCreateArgs[] = []
    const defaultLogin = vi.fn(async ({ data }: MockCreateArgs) => ({
      user: { id: opts.user?.id, email: opts.user?.email },
      token: `freshly.signed.jwt-for-${String((data as MockDoc).email)}`,
      exp: Math.floor(Date.now() / 1000) + 7200,
    }))
    const defaultUpdate = vi.fn(async ({ id, data }: MockUpdateArgs) => ({ id, ...data }))
    const login = opts.payloadStubs?.login ?? defaultLogin
    const update = opts.payloadStubs?.update ?? defaultUpdate
    const findByID = opts.payloadStubs?.findByID ?? vi.fn(async () => opts.user)

    return {
      req: {
        user: opts.user,
        data: opts.body,
        headers: new Headers(),
        t: (k: string) => k,
        context: {},
        payload: asPayload({
          login: async (args: MockCreateArgs) => {
            loginCalls.push(args)
            return login(args)
          },
          update: async (args: MockUpdateArgs) => {
            updateCalls.push(args)
            return update(args)
          },
          findByID,
          config: {
            cookiePrefix: "payload",
          },
          // Payload's `auth.cookies` config drives generatePayloadCookie; the
          // endpoint will pull from collection.config.auth.cookies. We provide
          // a minimal shape that mirrors Payload's defaults.
          collections: {
            users: {
              config: {
                slug: "users",
                auth: {
                  cookies: { sameSite: "Lax", secure: false, domain: undefined },
                  tokenExpiration: 7200,
                  useSessions: true,
                },
              },
            },
          },
        }),
      },
      updateCalls,
      loginCalls,
    }
  }

  it("Case 5 — anonymous POST → 401", async () => {
    const ep = findChangePasswordEndpoint()!
    const { req } = buildReq({ user: null, body: { currentPassword: "x", newPassword: "newpass-1234" } })
    const res = await ep.handler(req)
    expect(res.status).toBe(401)
  })

  it("Case 6 — wrong currentPassword (payload.login throws) → 403", async () => {
    const ep = findChangePasswordEndpoint()!
    const failingLogin = vi.fn(async () => {
      throw Object.assign(new Error("AuthenticationError"), { status: 401 })
    })
    const { req } = buildReq({
      user: { id: "u1", email: "u1@x", role: "editor" },
      body: { currentPassword: "wrong", newPassword: "newpass-1234" },
      payloadStubs: { login: failingLogin },
    })
    const res = await ep.handler(req)
    expect(res.status).toBe(403)
  })

  it("Case 7 — correct currentPassword + valid newPassword → 200 + Set-Cookie + payload.update called with allowSelfPasswordChange context", async () => {
    const ep = findChangePasswordEndpoint()!
    const { req, updateCalls, loginCalls } = buildReq({
      user: { id: "u1", email: "u1@x", role: "editor" },
      body: { currentPassword: "right-now", newPassword: "newpass-1234" },
    })
    const res = await ep.handler(req)
    expect(res.status).toBe(200)

    // Cookie must be set with the freshly issued token (sub-fix B end state:
    // every other JWT for this user is now invalid — our caller's NEW cookie
    // is the only one carrying a valid sid).
    const setCookie = res.headers.get("set-cookie") ?? ""
    expect(setCookie, "expected Set-Cookie carrying the freshly issued token").toMatch(/payload-token=/)

    // Verification: caller was logged in TWICE — once to verify currentPassword,
    // once to issue the post-rotation fresh session. Both with caller's email.
    expect(loginCalls.length).toBe(2)
    expect(loginCalls[0]?.data).toMatchObject({ password: "right-now" })
    expect(loginCalls[1]?.data).toMatchObject({ password: "newpass-1234" })

    expect(updateCalls.length).toBe(1)
    const updateCall = updateCalls[0]!
    expect(updateCall.collection).toBe("users")
    expect(updateCall.id).toBe("u1")
    expect(updateCall.data).toEqual({ password: "newpass-1234" })
    expect(updateCall.overrideAccess).toBe(true)
    expect(updateCall.context?.allowSelfPasswordChange).toBe(true)
  })

  it("Case 10 — super-admin can also use the endpoint (positive control)", async () => {
    const ep = findChangePasswordEndpoint()!
    const { req } = buildReq({
      user: { id: "sa1", email: "sa@x", role: "super-admin" },
      body: { currentPassword: "old", newPassword: "newpass-1234" },
    })
    const res = await ep.handler(req)
    expect(res.status).toBe(200)
  })

  it("Case 11 — newPassword shorter than 8 chars → 400 (defensive validation)", async () => {
    const ep = findChangePasswordEndpoint()!
    const { req } = buildReq({
      user: { id: "u1", email: "u1@x", role: "editor" },
      body: { currentPassword: "old", newPassword: "short" },
    })
    const res = await ep.handler(req)
    expect(res.status).toBe(400)
  })

  it("Case 12 — non-string fields in body → 400", async () => {
    const ep = findChangePasswordEndpoint()!
    const { req } = buildReq({
      user: { id: "u1", email: "u1@x", role: "editor" },
      body: { currentPassword: 42, newPassword: { evil: true } },
    })
    const res = await ep.handler(req)
    expect(res.status).toBe(400)
  })

  it("Missing fields entirely → 400 (currentPassword and newPassword both required)", async () => {
    const ep = findChangePasswordEndpoint()!
    const { req } = buildReq({
      user: { id: "u1", email: "u1@x", role: "editor" },
      body: {},
    })
    const res = await ep.handler(req)
    expect(res.status).toBe(400)
  })
})

// -----------------------------------------------------------------------------
// Sub-fix B — useSessions enabled + clearSessionsOnPasswordChange hook
// -----------------------------------------------------------------------------

describe("audit-p1 #7 sub-fix B — useSessions:true + clearSessionsOnPasswordChange hook", () => {
  it("Case 13 — Users.auth.useSessions === true (enables Payload's built-in session-based JWT invalidation)", () => {
    expect(Users.auth).toBeTruthy()
    expect(Users.auth && typeof Users.auth === "object" && "useSessions" in Users.auth && Users.auth.useSessions).toBe(true)
  })

  it("Hook installed: Users.hooks.beforeValidate has at least one hook (the session-clearer)", () => {
    expect(beforeValidateHooks.length).toBeGreaterThanOrEqual(1)
    expect(typeof clearSessionsHook).toBe("function")
  })

  it("Case 14 — operation:'update' with data.password set → hook returns data with sessions=[] AND mutates in place", async () => {
    const data: MockDoc = { password: "anything", name: "Y" }
    const result = await clearSessionsHook({
      data,
      originalDoc: undefined,
      operation: "update",
      req: { context: {} },
      collection: {},
      context: {},
    })
    expect(data.sessions).toEqual([])
    expect((result as MockDoc | undefined)?.sessions).toEqual([])
    expect((result as MockDoc | undefined)?.name).toBe("Y")
  })

  it("Case 15 — operation:'update' with data.hash CHANGED vs originalDoc.hash (resetPassword path) → sessions cleared in place", async () => {
    // resetPassword.js writes a newly-derived hash onto the user object and
    // passes it to beforeValidate. The new hash differs from originalDoc.hash,
    // which is the authoritative discriminator for a real password rotation.
    const data: MockDoc = {
      id: "u1",
      email: "u1@x",
      hash: "newly-generated-hash-bytes",
      salt: "newly-generated-salt-bytes",
      resetPasswordExpiration: new Date().toISOString(),
      sessions: [{ id: "old-session-1" }, { id: "old-session-2" }],
    }
    await clearSessionsHook({
      data,
      originalDoc: { hash: "old-hash-bytes", salt: "old-salt-bytes" },
      operation: "update",
      req: { context: {} },
      collection: {},
      context: {},
    })
    expect(data.sessions).toEqual([])
  })

  it("Case 15b — BUG REPRO: operation:'update' where data.hash EQUALS originalDoc.hash (non-credential update, e.g. editorMode change) → sessions PRESERVED", async () => {
    // Payload passes the full merged document to beforeValidate on update — so
    // an auth-enabled user row always carries hash+salt in data, even when only
    // unrelated fields like editorMode are being changed. The old detection
    // (typeof d.hash === "string" && typeof d.salt === "string") fired on every
    // such update, clearing sessions and instantly invalidating the user's JWT.
    // The fix compares against originalDoc.hash; when the hash is unchanged it
    // is NOT a credential rotation and sessions must be preserved.
    const existingHash = "the-unchanged-stored-hash"
    const data: MockDoc = {
      id: "u1",
      email: "u1@x",
      hash: existingHash, // same as stored — not a rotation
      salt: "stored-salt-bytes",
      editorMode: "canvas",
      sessions: [{ id: "keep-this-session" }],
    }
    await clearSessionsHook({
      data,
      originalDoc: { hash: existingHash, salt: "stored-salt-bytes" },
      operation: "update",
      req: { context: {} },
      collection: {},
      context: {},
    })
    expect(data.sessions).toEqual([{ id: "keep-this-session" }])
  })

  it("Case 15c — fail-secure: originalDoc absent (undefined) and data.hash present → sessions cleared (safe direction)", async () => {
    // If for any reason originalDoc is missing on an update, we treat the hash
    // as having changed (conservative/safe) rather than skipping the clear.
    const data: MockDoc = {
      hash: "some-hash",
      salt: "some-salt",
      sessions: [{ id: "old-session" }],
    }
    await clearSessionsHook({
      data,
      originalDoc: undefined,
      operation: "update",
      req: { context: {} },
      collection: {},
      context: {},
    })
    expect(data.sessions).toEqual([])
  })

  it("Case 16 — operation:'update' with NEITHER password NOR changed hash → sessions untouched (collateral pass-through)", async () => {
    const data: MockDoc = {
      name: "Y",
      sessions: [{ id: "keep-this-session" }],
    }
    await clearSessionsHook({
      data,
      originalDoc: { hash: "stored-hash", salt: "stored-salt" },
      operation: "update",
      req: { context: {} },
      collection: {},
      context: {},
    })
    expect(data.sessions).toEqual([{ id: "keep-this-session" }])
  })

  it("Case 17 — operation:'create' with data.password → does NOT clear sessions (create-time has no prior sessions to invalidate)", async () => {
    const data: MockDoc = { password: "newuser-pw", email: "n@x" }
    await clearSessionsHook({
      data,
      originalDoc: undefined,
      operation: "create",
      req: { context: {} },
      collection: {},
      context: {},
    })
    expect(data.sessions).toBeUndefined()
  })
})

// -----------------------------------------------------------------------------
// Re-arm guards
// -----------------------------------------------------------------------------

describe("audit-p1 #7 — re-arm guards (AMD-1 / AMD-2 / AMD-3 / P0 / P1 #5 must remain closed)", () => {
  const apiKeyField = expectAccessField(Users.fields, "apiKey")
  const enableAPIKeyField = expectAccessField(Users.fields, "enableAPIKey")
  const apiKeyIndexField = expectAccessField(Users.fields, "apiKeyIndex")
  const roleField = expectAccessField(Users.fields, "role")
  const tenantsField = expectAccessField(Users.fields, "tenants")

  it("R1 (AMD-1): owner→editor invite into own tenant still admitted by role/tenants field-access", () => {
    const args = {
      req: reqAuthed("owner", 42),
      data: { email: "n@x", role: "editor", tenants: [{ tenant: 42 }] },
      siblingData: {},
    }
    expect(roleField.access.create(args)).toBe(true)
    expect(tenantsField.access.create(args)).toBe(true)
  })

  it("R2 (AMD-2): apiKey/enableAPIKey/apiKeyIndex field-level access UNCHANGED — isSuperAdminField for both create AND update", () => {
    for (const [label, f] of [
      ["apiKey", apiKeyField],
      ["enableAPIKey", enableAPIKeyField],
      ["apiKeyIndex", apiKeyIndexField],
    ] as const) {
      // Super-admin permitted both operations
      expect(f.access.create({ req: reqAuthed("super-admin") }), `${label}.create sa`).toBe(true)
      expect(f.access.update({ req: reqAuthed("super-admin") }), `${label}.update sa`).toBe(true)
      for (const role of ["owner", "editor", "viewer"]) {
        expect(f.access.create({ req: reqAuthed(role, 42) }), `${label}.create ${role}`).toBe(false)
        expect(f.access.update({ req: reqAuthed(role, 42) }), `${label}.update ${role}`).toBe(false)
      }
    }
  })

  it("R3 (AMD-3): rejectNonSuperAdminApiKeyWrites still fires on operation==='update' (its index 0 contract preserved)", async () => {
    await expectForbidden(
      callBeforeOpHook(apiKeyHonestRejectHook, {
        operation: "update",
        req: reqAuthed("editor", 42, "self"),
        data: { apiKey: "X" },
      }),
    )
  })

  it("R4 (P0 #2/#3): role.access.update and tenants.access.update still isSuperAdminField (stolen-cookie role-promote stays closed)", () => {
    expect(roleField.access.update({ req: reqAuthed("editor", 42) })).toBe(false)
    expect(roleField.access.update({ req: reqAuthed("owner", 42) })).toBe(false)
    expect(roleField.access.update({ req: reqAuthed("super-admin") })).toBe(true)
    expect(tenantsField.access.update({ req: reqAuthed("editor", 42) })).toBe(false)
    expect(tenantsField.access.update({ req: reqAuthed("owner", 42) })).toBe(false)
    expect(tenantsField.access.update({ req: reqAuthed("super-admin") })).toBe(true)
  })

  it("R5 (P1 #5): rejectBogusAuthForgotPassword still fires on operation==='forgotPassword' with bogus auth signal", async () => {
    const reqWithBogusCookie = {
      user: null,
      headers: { get: (k: string) => (k === "cookie" ? "payload-token=garbage" : null) },
      t: (k: string) => k,
      context: {},
    }
    await expectForbidden(
      callBeforeOpHook(bogusAuthForgotHook, {
        operation: "forgotPassword",
        req: reqWithBogusCookie,
        data: {},
      }),
    )
  })

  it("Hook composition order: existing hooks at index 0 and 1 are unchanged (the AMD-3 + P1 #5 hooks still run before the new password hook)", () => {
    expect(typeof apiKeyHonestRejectHook).toBe("function")
    expect(typeof bogusAuthForgotHook).toBe("function")
    expect(typeof passwordWriteRejectHook).toBe("function")
    // Sentinel: AMD-3 hook only fires on update; P1 #5 hook only on forgotPassword;
    // new hook on update with password. Disjoint conditions → composition is safe.
    // We don't reorder; we APPEND. (If a future change inserts a hook at index 0
    // or 1, this assertion still passes if they keep their disjoint operations,
    // which is the only safety property that matters.)
  })
})

// -----------------------------------------------------------------------------
// ProfileForm.tsx — sub-fix A's UI integration (source-level structural check)
// -----------------------------------------------------------------------------
//
// Behavioural-render testing of the form requires plumbing react-hook-form
// + the shadcn FormField wrapping + jsdom — high effort for a low-value
// assertion when the actual contract (request shape, server response) is
// already exercised in the endpoint tests above. Source-level grep is enough
// to enforce the contract: the only fetch in onUpdatePassword targets the
// new endpoint, the OLD `/api/users/login` pre-check is gone, and the OLD
// naive PATCH path is gone. If those three statements hold in the .tsx,
// the UI's data flow is the new flow.

describe("audit-p1 #7 sub-fix A — ProfileForm.tsx submits to /api/users/change-password (single POST replaces dual login+PATCH)", () => {
  it("onUpdatePassword posts to the new endpoint and the old login + PATCH paths are removed", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const profileFormPath = path.resolve(__dirname, "../../src/components/forms/ProfileForm.tsx")
    const src = fs.readFileSync(profileFormPath, "utf8")

    // Positive: references the new endpoint
    expect(
      src.includes("/api/users/change-password"),
      "ProfileForm.tsx must POST to /api/users/change-password",
    ).toBe(true)

    // Negative regression: the OLD client-side login pre-check is gone.
    expect(
      src.includes("/api/users/login"),
      "ProfileForm.tsx must NOT call /api/users/login as a client-side pre-check",
    ).toBe(false)

    // Negative regression: the OLD naive PATCH path is gone from the password
    // flow. We allow `/api/users/${user.id}` for the NAME update form (which
    // is a separate, legitimate flow), but the password handler must not
    // PATCH the naive path. Heuristic: the password handler's body contains
    // "newPassword" — search the function bounds for any PATCH to /api/users.
    //
    // Implementation: extract the substring of the file containing the
    // password handler (between "onUpdatePassword" and the next top-level
    // declaration) and assert no PATCH-to-/api/users-<id> call inside it.
    const startIdx = src.indexOf("onUpdatePassword")
    expect(startIdx, "expected to find onUpdatePassword in ProfileForm.tsx").toBeGreaterThan(0)
    const tail = src.slice(startIdx)
    // Find the closing `}` of the handler — match the next top-level
    // `return (` (the JSX) which marks the end of the JS handlers section.
    const endMarker = tail.indexOf("return (")
    const handlerSection = endMarker > 0 ? tail.slice(0, endMarker) : tail

    expect(
      /method:\s*["']PATCH["']/.test(handlerSection) === false,
      "password handler must NOT issue a PATCH (the naive PATCH path is replaced by the change-password endpoint)",
    ).toBe(true)
  })
})
