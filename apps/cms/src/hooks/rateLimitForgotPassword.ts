import { APIError, type CollectionBeforeOperationHook } from "payload"

const FORGOT_PASSWORD_POINTS = 3
const FORGOT_PASSWORD_DURATION_SECONDS = 60 * 60
const FORGOT_PASSWORD_DURATION_MS = FORGOT_PASSWORD_DURATION_SECONDS * 1000

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

const normaliseTargetEmail = (data: unknown): string | null => {
  if (!data || typeof data !== "object") return null
  const email = (data as { email?: unknown }).email
  if (typeof email !== "string") return null
  const normalised = email.trim().toLowerCase()
  return normalised.length > 0 ? normalised : null
}

export const __resetForgotPasswordLimiterForTests = () => {
  buckets.clear()
}

/**
 * OBS-5 — rate-limit reset emails by target mailbox after Payload auth.
 *
 * Middleware limits anonymous callers by IP. This hook covers the residual
 * authenticated-abuse shape: a valid user repeatedly calling forgot-password
 * for the same victim email. Target-email keying also protects the mailbox
 * from distributed callers and keeps legitimate API-key client bursts to
 * different invitees working.
 */
export const rateLimitForgotPasswordByTargetEmail: CollectionBeforeOperationHook = async ({
  args,
  operation,
}) => {
  if (operation !== "forgotPassword") return args
  const email = normaliseTargetEmail(args?.data)
  if (!email) return args

  const key = `forgot-password:${email}`
  const now = Date.now()
  const current = buckets.get(key)
  const bucket = current && current.resetAt > now
    ? current
    : { count: 0, resetAt: now + FORGOT_PASSWORD_DURATION_MS }

  bucket.count += 1
  buckets.set(key, bucket)

  if (bucket.count > FORGOT_PASSWORD_POINTS) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))

    throw new APIError(
      `Too many password reset attempts for this email. Try again in ${retryAfterSeconds} seconds.`,
      429,
      { retryAfterSeconds },
      true,
    )
  }

  return args
}
