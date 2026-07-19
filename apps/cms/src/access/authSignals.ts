// Detect raw "auth was attempted" signals on a request, post-Payload-auth.
//
// This composes with the audit-p1 #5 (T4) middleware rate-limit at
// `src/proxy.ts`. The middleware's anonymous-detector treats EITHER
// a non-empty `Authorization` header OR a non-empty `payload-token` cookie
// value as "this caller is authed" → bypass the limiter. That's the
// machine-client bypass required by tenant provisioning flows that
// authenticate via `Authorization: users API-Key ...` and may burst
// /api/users/forgot-password.
//
// The middleware bypass is presence-only — it does NOT cryptographically
// validate the credential. An attacker presenting a bogus header (e.g.
// `Authorization: x` or `Cookie: payload-token=garbage`) can therefore
// bypass the middleware rate-limit on /api/forms and /api/users/forgot-
// password. Adversarial review of fix batch 6 (Pass 1) confirmed this
// vector lands at Payload's anonymous-create admit path.
//
// Layer-2 closure: at the Payload collection level (where `req.user` has
// been validated by the auth strategies), reject any caller whose request
// PRESENTS auth signals BUT whose auth FAILED to populate req.user. That
// caller is by construction trying to spoof past the middleware bypass.
// Real anonymous (no signals) and real authed (req.user set) flow through.
//
// Polarity invariant (binding): this helper must be the SAME shape as
// middleware's `isAnonymousCaller` polarity-inverted. If middleware skips
// the limiter on signal X, this helper must report X as a signal. Drift
// between the two opens new bypasses.

const PAYLOAD_TOKEN_COOKIE_RX = /(?:^|;)\s*payload-token=[^;\s]+/

export const hasPayloadSessionCookie = (req: any): boolean => {
  const cookieHeader: unknown = req?.headers?.get?.("cookie")
  return typeof cookieHeader === "string" && PAYLOAD_TOKEN_COOKIE_RX.test(cookieHeader)
}

export const hasUnvalidatedAuthSignal = (req: any): boolean => {
  const auth: unknown = req?.headers?.get?.("authorization")
  if (typeof auth === "string" && auth.length > 0) return true
  if (hasPayloadSessionCookie(req)) return true
  return false
}
