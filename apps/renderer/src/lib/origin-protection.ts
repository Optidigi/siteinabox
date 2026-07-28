import { timingSafeEqual } from "node:crypto"
import { normalizePublicDomainHost } from "@siteinabox/contracts/renderer-routing"
import { readRuntimeSecret } from "./runtime-secret"

export const RENDERER_ORIGIN_VERIFICATION_HEADER = "x-siab-origin-verify"
const MINIMUM_ORIGIN_SECRET_LENGTH = 32

type OriginProtectionEnvironment = {
  NODE_ENV?: string
  SIAB_RENDERER_ORIGIN_SECRET?: string
  SIAB_RENDERER_ORIGIN_SECRET_FILE?: string
}

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

export function publicHostFromProtectedRequest(
  request: Request,
  environment: OriginProtectionEnvironment = process.env,
): string | null {
  const expectedSecret = readRuntimeSecret(
    environment.SIAB_RENDERER_ORIGIN_SECRET,
    environment.SIAB_RENDERER_ORIGIN_SECRET_FILE,
  )
  const protectionRequired = environment.NODE_ENV === "production" || expectedSecret.length > 0
  if (!protectionRequired) return unprotectedDevelopmentHost(request)
  if (expectedSecret.length < MINIMUM_ORIGIN_SECRET_LENGTH) return null

  const actualSecret = request.headers.get(RENDERER_ORIGIN_VERIFICATION_HEADER) ?? ""
  if (!secretsMatch(actualSecret, expectedSecret)) return null
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
