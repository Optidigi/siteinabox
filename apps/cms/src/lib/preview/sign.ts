import "server-only"
import crypto from "node:crypto"

export type PreviewClaims = {
  tenantId: number | string
  pageId: number | string
}

export type SignedToken = {
  token: string
  exp: number  // unix seconds
}

const TTL_SECONDS = 30 * 60  // 30 minutes per spec

/**
 * Sign a preview HMAC token. Caller-supplied claims plus an `exp` baked
 * at sign time. Trim secret on read to defend against .env trailing
 * whitespace.
 */
export function signPreviewToken(
  claims: PreviewClaims,
  secret: string | undefined,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): SignedToken {
  if (!secret) {
    throw new Error("signPreviewToken: PREVIEW_HMAC_SECRET is required")
  }
  const trimmedSecret = secret.trim()
  if (!trimmedSecret) {
    throw new Error("signPreviewToken: PREVIEW_HMAC_SECRET is empty after trim")
  }
  const exp = nowSeconds + TTL_SECONDS

  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")
  const payload = Buffer.from(JSON.stringify({ ...claims, exp })).toString("base64url")
  const sig = crypto
    .createHmac("sha256", trimmedSecret)
    .update(`${header}.${payload}`)
    .digest("base64url")

  return { token: `${header}.${payload}.${sig}`, exp }
}

const decodeJsonSegment = (segment: string): unknown => {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf-8"))
  } catch {
    throw new Error("Invalid preview token payload")
  }
}

const timingSafeEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

export function verifyPreviewToken(
  token: string,
  secret: string | undefined,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): PreviewClaims & { exp: number } {
  if (!secret) {
    throw new Error("verifyPreviewToken: PREVIEW_HMAC_SECRET is required")
  }
  const trimmedSecret = secret.trim()
  if (!trimmedSecret) {
    throw new Error("verifyPreviewToken: PREVIEW_HMAC_SECRET is empty after trim")
  }

  const parts = token.split(".")
  if (parts.length !== 3) {
    throw new Error("Invalid preview token")
  }
  const [header, payload, sig] = parts as [string, string, string]
  const expected = crypto
    .createHmac("sha256", trimmedSecret)
    .update(`${header}.${payload}`)
    .digest("base64url")
  if (!timingSafeEqual(sig, expected)) {
    throw new Error("Invalid preview token signature")
  }

  const claims = decodeJsonSegment(payload) as Partial<PreviewClaims> & { exp?: unknown }
  if (
    (typeof claims.tenantId !== "string" && typeof claims.tenantId !== "number") ||
    (typeof claims.pageId !== "string" && typeof claims.pageId !== "number") ||
    typeof claims.exp !== "number"
  ) {
    throw new Error("Invalid preview token claims")
  }
  if (claims.exp <= nowSeconds) {
    throw new Error("Preview token expired")
  }
  return {
    tenantId: claims.tenantId,
    pageId: claims.pageId,
    exp: claims.exp,
  }
}
