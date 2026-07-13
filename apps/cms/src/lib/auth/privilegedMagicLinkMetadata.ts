import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

export type PrivilegedMagicLinkPurpose = "user_invite" | "site_live_handoff"

const SIGNATURE_VERSION = "v1"
const DEFAULT_TTL_SECONDS = 60
const MAX_TTL_SECONDS = 120
const CLOCK_SKEW_SECONDS = 15
const SHA256_BASE64URL = /^[A-Za-z0-9_-]{43}$/

type SigningOptions = {
  now?: Date
  secret?: string
}

const authSecret = (override?: string): string => {
  // This intentionally follows Better Auth's own secret selection. The
  // domain-separated HMAC label below derives an independent protocol key;
  // the raw auth secret is never placed in metadata or compared directly.
  const secret = override?.trim() || process.env.BETTER_AUTH_SECRET?.trim() || process.env.PAYLOAD_SECRET?.trim()
  if (!secret) throw new Error("BETTER_AUTH_SECRET or PAYLOAD_SECRET is required for privileged magic-link metadata")
  return secret
}

const claimsFromMetadata = (metadata: Record<string, unknown>): Record<string, string> | null => {
  const claims: Record<string, string> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (key.startsWith("_siabPrivileged") || key === "intent") continue
    if (typeof value !== "string") return null
    claims[key] = value
  }
  return claims
}

const canonicalPayload = (input: {
  purpose: PrivilegedMagicLinkPurpose
  issuedAt: number
  expiresAt: number
  claims: Record<string, string>
}): string => JSON.stringify({
  version: SIGNATURE_VERSION,
  purpose: input.purpose,
  issuedAt: input.issuedAt,
  expiresAt: input.expiresAt,
  claims: Object.fromEntries(Object.entries(input.claims).sort(([left], [right]) => left.localeCompare(right))),
})

const signatureFor = (payload: string, secret?: string): string =>
  createHmac("sha256", authSecret(secret))
    .update("siteinabox:privileged-magic-link:")
    .update(payload)
    .digest("base64url")

export function signPrivilegedMagicLinkMetadata(
  purpose: PrivilegedMagicLinkPurpose,
  claims: Record<string, string>,
  options: SigningOptions = {},
): Record<string, string | number> {
  const issuedAt = Math.floor((options.now ?? new Date()).getTime() / 1000)
  const expiresAt = issuedAt + DEFAULT_TTL_SECONDS
  const payload = canonicalPayload({ purpose, issuedAt, expiresAt, claims })
  return {
    intent: purpose,
    ...claims,
    _siabPrivilegedVersion: SIGNATURE_VERSION,
    _siabPrivilegedPurpose: purpose,
    _siabPrivilegedIssuedAt: issuedAt,
    _siabPrivilegedExpiresAt: expiresAt,
    _siabPrivilegedSignature: signatureFor(payload, options.secret),
  }
}

export function verifyPrivilegedMagicLinkMetadata(
  metadata: unknown,
  expectedPurpose: PrivilegedMagicLinkPurpose,
  options: SigningOptions = {},
): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false
  const record = metadata as Record<string, unknown>
  if (record.intent !== expectedPurpose || record._siabPrivilegedPurpose !== expectedPurpose) return false
  if (record._siabPrivilegedVersion !== SIGNATURE_VERSION) return false

  const issuedAt = record._siabPrivilegedIssuedAt
  const expiresAt = record._siabPrivilegedExpiresAt
  const suppliedSignature = record._siabPrivilegedSignature
  if (!Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(expiresAt) ||
    typeof suppliedSignature !== "string" || !SHA256_BASE64URL.test(suppliedSignature)) return false

  const now = Math.floor((options.now ?? new Date()).getTime() / 1000)
  if ((issuedAt as number) > now + CLOCK_SKEW_SECONDS || (expiresAt as number) < now) return false
  if ((expiresAt as number) <= (issuedAt as number) || (expiresAt as number) - (issuedAt as number) > MAX_TTL_SECONDS) return false

  const claims = claimsFromMetadata(record)
  if (!claims) return false
  const expectedSignature = signatureFor(canonicalPayload({
    purpose: expectedPurpose,
    issuedAt: issuedAt as number,
    expiresAt: expiresAt as number,
    claims,
  }), options.secret)
  // The envelope is server-internal and expires in 60 seconds. Exact-token
  // replay inside that bounded window is accepted; recipient, purpose, all
  // claims, and admin origin remain cryptographically bound.
  const supplied = Buffer.from(suppliedSignature)
  const expected = Buffer.from(expectedSignature)
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}
