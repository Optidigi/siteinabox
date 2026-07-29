import { timingSafeEqual } from "node:crypto"
import { normalizePublicDomainHost } from "@siteinabox/contracts/renderer-routing"
import { readRuntimeSecret } from "./runtime-secret"

export const RENDERER_ORIGIN_VERIFICATION_HEADER = "x-siab-origin-verify"
const MINIMUM_ORIGIN_SECRET_LENGTH = 32

type OriginProtectionEnvironment = {
  NODE_ENV?: string
  SIAB_RENDERER_ORIGIN_TRUST_MODE?: string
  SIAB_RENDERER_ORIGIN_SECRET?: string
  SIAB_RENDERER_ORIGIN_SECRET_FILE?: string
}

const CLOUDFLARE_TUNNEL_TRUST_MODE = "cloudflare_tunnel"

function secretsMatch(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual)
  const expectedBytes = Buffer.from(expected)
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes)
}

function unprotectedDevelopmentHost(request: Request): string | null {
  const source = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  const publicHost = normalizePublicDomainHost(source)
  if (publicHost) return publicHost

  const localHost = (source ?? "").trim().toLowerCase().replace(/:\d+$/, "")
  return localHost === "localhost" || localHost === "127.0.0.1" ? localHost : null
}

function publicHostFromTrustedProxy(request: Request): string | null {
  if (request.headers.get("x-forwarded-proto")?.trim().toLowerCase() !== "https") return null

  const proxyHost = normalizePublicDomainHost(request.headers.get("host"))
  if (!proxyHost) return null

  const forwardedHostHeader = request.headers.get("x-forwarded-host")
  if (forwardedHostHeader) {
    const forwardedHost = normalizePublicDomainHost(forwardedHostHeader)
    if (!forwardedHost || forwardedHost !== proxyHost) return null
  }
  return proxyHost
}

export function publicHostFromProtectedRequest(
  request: Request,
  environment: OriginProtectionEnvironment = process.env,
): string | null {
  const trustMode = environment.SIAB_RENDERER_ORIGIN_TRUST_MODE?.trim()
  const expectedSecret = readRuntimeSecret(
    environment.SIAB_RENDERER_ORIGIN_SECRET,
    environment.SIAB_RENDERER_ORIGIN_SECRET_FILE,
  )
  if (trustMode === CLOUDFLARE_TUNNEL_TRUST_MODE) {
    // In this mode the renderer has no published port and shares a private
    // bridge only with its outbound cloudflared connector. Reject ambiguous
    // mixed-mode configuration so the network boundary remains explicit.
    if (expectedSecret.length > 0) return null
    return publicHostFromTrustedProxy(request)
  }
  if (trustMode) return null

  const protectionRequired = environment.NODE_ENV === "production" || expectedSecret.length > 0
  if (!protectionRequired) return unprotectedDevelopmentHost(request)
  if (expectedSecret.length < MINIMUM_ORIGIN_SECRET_LENGTH) return null

  const actualSecret = request.headers.get(RENDERER_ORIGIN_VERIFICATION_HEADER) ?? ""
  if (!secretsMatch(actualSecret, expectedSecret)) return null
  return publicHostFromTrustedProxy(request)
}

export function neutralOriginNotFound(): Response {
  return new Response("Page not found", {
    status: 404,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  })
}
