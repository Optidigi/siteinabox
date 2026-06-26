// src/lib/preview/verify.ts
import crypto from "node:crypto"

export type PreviewClaims = {
  tenantId: number | string
  pageId: number | string  // numeric for saved pages, "draft-<uuid>" for unsaved
  exp: number  // unix seconds
}

/**
 * Verify a preview HMAC token. Returns the parsed claims on success,
 * or null on any failure (bad format, bad signature, expired). Constant-
 * time signature comparison; trim secret on read to defend against .env
 * trailing whitespace.
 */
export function verifyPreviewToken(
  token: string | null | undefined,
  secret: string | undefined,
): PreviewClaims | null {
  if (!token || !secret) return null
  const trimmedSecret = secret.trim()
  if (!trimmedSecret) return null

  const parts = token.split(".")
  if (parts.length !== 3) return null
  const [headerB64, payloadB64, sigB64] = parts

  const expectedSig = crypto
    .createHmac("sha256", trimmedSecret)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url")

  // Constant-time compare.
  let sigA: Buffer
  let sigB: Buffer
  try {
    sigA = Buffer.from(sigB64, "base64url")
    sigB = Buffer.from(expectedSig, "base64url")
  } catch {
    return null
  }
  if (sigA.length !== sigB.length) return null
  if (!crypto.timingSafeEqual(sigA, sigB)) return null

  let claims: PreviewClaims
  try {
    const json = Buffer.from(payloadB64, "base64url").toString("utf-8")
    claims = JSON.parse(json) as PreviewClaims
  } catch {
    return null
  }

  if (typeof claims.exp !== "number") return null
  if (Math.floor(Date.now() / 1000) >= claims.exp) return null
  if (claims.tenantId == null || claims.pageId == null) return null

  return claims
}
