import { generatePayloadCookie } from "payload"
import type { PayloadHandler } from "payload"

// Audit-p1 #7 sub-fix A — POST /api/users/change-password
//
// Self-service password rotation for any authenticated user. The endpoint
// re-verifies the caller's CURRENT password (server-side) before accepting
// a new one — closing the audit-#7 stolen-cookie repro where any authed
// PATCH /api/users/<self> with `{password:"X"}` permanently rotated the
// password without re-asserting identity.
//
// Flow:
//   1. Reject anonymous (req.user == null) → 401.
//   2. Validate body shape: both fields are required non-empty strings;
//      newPassword has a minimum length of 8 characters (defensive — the
//      audit doesn't mandate a specific length, 8 is the conventional floor
//      and matches the Zod resolver in ProfileForm.tsx).
//   3. Verify currentPassword by calling `payload.login`. If the local-
//      strategy authenticate fails, payload.login throws AuthenticationError
//      → 403. (Note: this attempt also adds a session entry to user.sessions,
//      which the password-update step then clears via the beforeValidate
//      hook — net effect after this endpoint completes is that ONLY the
//      freshly-issued post-rotation session remains valid.)
//   4. Update password with `overrideAccess: true` AND
//      `context: { allowSelfPasswordChange: true }`. The overrideAccess
//      flag bypasses the field-level access strip on auth fields; the
//      context flag tells the `rejectNonSuperAdminPasswordWrites` hook
//      that this is a verified self-change and should be admitted.
//      Per Payload's `createLocalReq` (`node_modules/payload/dist/utilities/
//      createLocalReq.js:7-19`), the `context` arg is merged into
//      `req.context`, which the hook reads from the args.req.context
//      field passed by `buildBeforeOperation` (`buildBeforeOperation.js:14`).
//   5. Issue a fresh login session via `payload.login` with newPassword.
//      With `useSessions: true`, this adds a brand-new sid to the user's
//      sessions array (which the password-update step just emptied), so
//      the caller has exactly one valid session token going forward.
//   6. Set the payload-token cookie on the response — the caller's browser
//      receives the new token and stays logged in across the rotation.
//      All other JWTs for this user (including any stolen pre-rotation
//      cookie) carry an old `sid` not in the user's sessions[] anymore →
//      the JWT verification at `node_modules/payload/dist/auth/strategies/
//      jwt.js:73-81` returns null user.
//
// Caveat — the verify-currentPassword step is the brute-force amplification
// surface flagged in the dispatch's "Rate-limiting consideration" note. It
// IS gated by Payload's auth.maxLoginAttempts when configured; siab-payload
// does NOT currently configure that. Out-of-batch observation per dispatch.
//
// NOTE on cookie generation: we import `generatePayloadCookie` from
// `payload`'s public exports (`node_modules/payload/dist/exports/shared.d.ts:1`).
// The cookie shape (HttpOnly, SameSite, Path, Domain, Secure, Max-Age) is
// derived from `collection.config.auth.cookies` + `tokenExpiration` exactly
// as Payload's own `loginHandler` does (`node_modules/payload/dist/auth/
// endpoints/login.js:25-29`), so the new cookie matches the prefix/flags
// any Payload-issued cookie would.

const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.length > 0

const errorBody = (message: string) => JSON.stringify({ message })

export const changePasswordHandler: PayloadHandler = async (req) => {
  // 1. Auth gate.
  if (!req.user) {
    return new Response(errorBody("Unauthorized"), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  // 2. Body parse + validation. Payload pre-parses POST bodies into req.data
  // for endpoints (mirroring loginHandler at auth/endpoints/login.js:11-18).
  const data = (req).data as { currentPassword?: unknown; newPassword?: unknown } | undefined
  const currentPassword = data?.currentPassword
  const newPassword = data?.newPassword

  if (!isNonEmptyString(currentPassword) || !isNonEmptyString(newPassword)) {
    return new Response(errorBody("currentPassword and newPassword are required strings"), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }
  if (newPassword.length < 8) {
    return new Response(errorBody("newPassword must be at least 8 characters"), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const userEmail = (req.user as { email?: string }).email
  const userId = (req.user as { id: string | number }).id
  if (!userEmail || userId == null) {
    return new Response(errorBody("Caller is missing email or id"), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  // 3. Verify currentPassword.
  try {
    await req.payload.login({
      collection: "users",
      data: { email: userEmail, password: currentPassword },
      req,
    })
  } catch {
    return new Response(errorBody("Current password is incorrect"), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })
  }

  // 4. Update password. overrideAccess + context flag jointly admit the
  // verified self-change past both the field-level access strip and the
  // beforeOperation lock-down hook. The beforeValidate hook
  // (`clearSessionsOnPasswordChange`) then sets data.sessions = [] so every
  // pre-rotation JWT is invalidated.
  try {
    await req.payload.update({
      collection: "users",
      id: userId,
      data: { password: newPassword },
      overrideAccess: true,
      context: { allowSelfPasswordChange: true },
      req,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Password update failed"
    return new Response(errorBody(msg), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  // 5. Issue a fresh login session for the caller (post-rotation). This
  // creates a new `sid` in user.sessions[] and signs a JWT carrying it.
  let token: string
  try {
    const result = await req.payload.login({
      collection: "users",
      data: { email: userEmail, password: newPassword },
      req,
    })
    token = result.token as string
  } catch (e) {
    // Should be unreachable in practice — we just successfully wrote the
    // new password. If it does happen, the caller's existing cookie is
    // already invalid (sessions cleared); they'll need to log in again.
    const msg = e instanceof Error ? e.message : "Failed to issue new session"
    return new Response(errorBody(msg), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  // 6. Set the payload-token cookie. We pull the cookie config from the
  // resolved Users collection on the live payload instance — same source
  // Payload's own loginHandler uses.
  const usersCollection = req.payload.collections?.users
  const cookie = generatePayloadCookie({
    collectionAuthConfig: usersCollection?.config?.auth,
    cookiePrefix: req.payload.config.cookiePrefix ?? "payload",
    token,
  })

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookie as string,
    },
  })
}
