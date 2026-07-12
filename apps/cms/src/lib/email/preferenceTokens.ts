import "server-only"

import crypto from "node:crypto"

export const emailPreferenceTokenActions = ["unsubscribe_marketing", "manage_preferences"] as const
export type EmailPreferenceTokenAction = (typeof emailPreferenceTokenActions)[number]

export type EmailPreferenceTokenClaims = {
  version: 1
  purpose: "email-preferences"
  subjectKey: string
  tenantId?: string | number
  allowedAction: EmailPreferenceTokenAction
  issuedAt: number
  expiresAt: number
  nonce: string
}

const DEFAULT_TTL_SECONDS = 90 * 24 * 60 * 60

function requireSecret(secret: string | undefined) {
  const value = secret?.trim()
  if (!value || (value.startsWith("<") && value.endsWith(">"))) {
    throw new Error("SIAB_EMAIL_PREFERENCE_SECRET is missing or invalid")
  }
  return value
}

function signature(value: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url")
}

export function signEmailPreferenceToken(input: {
  subjectKey: string
  allowedAction: EmailPreferenceTokenAction
  tenantId?: string | number
  secret?: string
  nowSeconds?: number
  ttlSeconds?: number
  nonce?: string
}) {
  const secret = requireSecret(input.secret ?? process.env.SIAB_EMAIL_PREFERENCE_SECRET)
  const issuedAt = input.nowSeconds ?? Math.floor(Date.now() / 1000)
  const ttl = input.ttlSeconds ?? DEFAULT_TTL_SECONDS
  if (!input.subjectKey.startsWith("email:") || !Number.isSafeInteger(ttl) || ttl <= 0) {
    throw new Error("Invalid email preference token input")
  }
  const claims: EmailPreferenceTokenClaims = {
    version: 1,
    purpose: "email-preferences",
    subjectKey: input.subjectKey,
    ...(input.tenantId != null ? { tenantId: input.tenantId } : {}),
    allowedAction: input.allowedAction,
    issuedAt,
    expiresAt: issuedAt + ttl,
    nonce: input.nonce ?? crypto.randomBytes(18).toString("base64url"),
  }
  const encoded = Buffer.from(JSON.stringify(claims)).toString("base64url")
  return `${encoded}.${signature(encoded, secret)}`
}

export function verifyEmailPreferenceToken(
  token: string,
  options: { secret?: string; nowSeconds?: number; requiredAction?: EmailPreferenceTokenAction } = {},
): EmailPreferenceTokenClaims {
  const secret = requireSecret(options.secret ?? process.env.SIAB_EMAIL_PREFERENCE_SECRET)
  const [encoded, providedSignature, extra] = token.split(".")
  if (!encoded || !providedSignature || extra) throw new Error("Invalid email preference token")
  const expected = signature(encoded, secret)
  const left = Buffer.from(providedSignature)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    throw new Error("Invalid email preference token signature")
  }
  let claims: Partial<EmailPreferenceTokenClaims>
  try {
    claims = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"))
  } catch {
    throw new Error("Invalid email preference token payload")
  }
  const validAction = emailPreferenceTokenActions.includes(claims.allowedAction as EmailPreferenceTokenAction)
  if (
    claims.version !== 1 || claims.purpose !== "email-preferences" ||
    typeof claims.subjectKey !== "string" || !claims.subjectKey.startsWith("email:") ||
    !validAction || typeof claims.issuedAt !== "number" || typeof claims.expiresAt !== "number" ||
    typeof claims.nonce !== "string" || !claims.nonce
  ) throw new Error("Invalid email preference token claims")
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000)
  if (claims.issuedAt > now + 300 || claims.expiresAt <= now) throw new Error("Email preference token expired")
  if (options.requiredAction && claims.allowedAction !== options.requiredAction) {
    throw new Error("Email preference token action is not allowed")
  }
  return claims as EmailPreferenceTokenClaims
}

export function createEmailPreferenceLinks(input: {
  origin: string
  subjectKey: string
  tenantId?: string | number
  secret?: string
  nowSeconds?: number
}) {
  const origin = new URL(input.origin)
  if (origin.protocol !== "https:") throw new Error("Email preference origin must use HTTPS")
  const shared = { subjectKey: input.subjectKey, tenantId: input.tenantId, secret: input.secret, nowSeconds: input.nowSeconds }
  const unsubscribeToken = signEmailPreferenceToken({ ...shared, allowedAction: "unsubscribe_marketing" })
  const manageToken = signEmailPreferenceToken({ ...shared, allowedAction: "manage_preferences" })
  const oneClickUrl = new URL("/api/email/unsubscribe", origin)
  oneClickUrl.searchParams.set("token", unsubscribeToken)
  const preferencesUrl = new URL("/email/preferences", origin)
  preferencesUrl.searchParams.set("token", manageToken)
  return {
    unsubscribeUrl: preferencesUrl.toString(),
    preferencesUrl: preferencesUrl.toString(),
    oneClickUrl: oneClickUrl.toString(),
  }
}
