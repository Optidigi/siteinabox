import { getPayload } from "payload"
import config from "@/payload.config"
import { isSuperAdminDomain, stripAdminPrefix } from "@/lib/hostToTenant"

const splitList = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)

const normalizeHost = (value: string | null): string => {
  const host = (value ?? "").split(",")[0]?.trim().toLowerCase() ?? ""
  if (host.startsWith("[")) return host
  return host.split(":")[0] ?? host
}

const requestHost = (request: Request): string =>
  normalizeHost(request.headers.get("x-forwarded-host") || request.headers.get("host"))

const requestProtocol = (request: Request): "http" | "https" => {
  const forwardedProto = request.headers.get("x-forwarded-proto")
  if (forwardedProto === "http" || forwardedProto === "https") return forwardedProto
  try {
    const protocol = new URL(request.url).protocol
    return protocol === "http:" ? "http" : "https"
  } catch {
    return "https"
  }
}

const isLoopbackHost = (host: string): boolean =>
  host === "localhost" || host.endsWith(".localhost") || host.startsWith("127.")

const isExtraAllowedHost = (host: string): boolean =>
  splitList(process.env.BETTER_AUTH_ALLOWED_HOSTS).includes(host)

const cleanOrigin = (value: string | undefined): string | undefined => {
  const origin = value?.trim()
  if (!origin) return undefined
  try {
    const url = new URL(origin)
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined
    url.pathname = ""
    url.search = ""
    url.hash = ""
    return url.toString().replace(/\/$/, "")
  } catch {
    return undefined
  }
}

export const getConfiguredBetterAuthOrigin = (): string | undefined =>
  cleanOrigin(process.env.BETTER_AUTH_URL) ?? cleanOrigin(process.env.SITE_URL)

const getDefaultSuperAdminOrigin = (): string => {
  const domain = process.env.NEXT_PUBLIC_SUPER_ADMIN_DOMAIN?.trim() || "siteinabox.nl"
  return `https://admin.${domain}`
}

export const getCmsAuthFallbackOrigin = (): string | undefined =>
  getConfiguredBetterAuthOrigin() ??
  (process.env.NODE_ENV === "production" ? getDefaultSuperAdminOrigin() : undefined)

export const isInternalAuthHost = (host: string): boolean =>
  host === "0.0.0.0" ||
  host === "localhost" ||
  host.endsWith(".localhost") ||
  host.startsWith("127.") ||
  host === "::1" ||
  host === "[::1]"

const cleanHeaderHost = (value: string | null): string => normalizeHost(value)

export function buildCmsAuthHeaders(source: Headers): Headers {
  const next = new Headers(source)
  const forwardedHost = cleanHeaderHost(source.get("x-forwarded-host"))
  const host = cleanHeaderHost(source.get("host"))
  const tenantDomain = cleanHeaderHost(source.get("x-siab-host"))
  const fallbackOrigin = getCmsAuthFallbackOrigin()
  const fallbackHost = fallbackOrigin ? cleanHeaderHost(new URL(fallbackOrigin).host) : ""
  const publicHost = forwardedHost && !isInternalAuthHost(forwardedHost)
    ? forwardedHost
    : host && !isInternalAuthHost(host)
      ? host
      : tenantDomain
        ? `admin.${tenantDomain}`
        : fallbackHost

  if (publicHost) {
    next.set("host", publicHost)
    next.set("x-forwarded-host", publicHost)
  }
  next.set("x-forwarded-proto", "https")
  return next
}

export function buildCmsAuthRequest(request: Request): Request {
  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers: buildCmsAuthHeaders(request.headers),
    body: request.body,
    redirect: request.redirect,
    signal: request.signal,
  }
  if (request.body) init.duplex = "half"
  return new Request(request.url, init)
}

export function getBetterAuthBaseURL() {
  const allowedHosts = [
    "admin.*",
    ...splitList(process.env.BETTER_AUTH_ALLOWED_HOSTS),
  ]
  if (process.env.NODE_ENV === "development") {
    allowedHosts.push("localhost:*", "127.0.0.1:*")
  }

  const fallback = getCmsAuthFallbackOrigin()

  return {
    allowedHosts: Array.from(new Set(allowedHosts)),
    protocol: process.env.NODE_ENV === "development" ? "http" : "https",
    ...(fallback ? { fallback } : {}),
  } as const
}

export async function isAllowedSocialAuthHost(request: Request): Promise<boolean> {
  const host = requestHost(request)
  if (!host) return false

  if (process.env.NODE_ENV === "development" && isLoopbackHost(host)) return true
  if (isExtraAllowedHost(host)) return true

  const domain = stripAdminPrefix(host)
  if (isSuperAdminDomain(domain, process.env.NEXT_PUBLIC_SUPER_ADMIN_DOMAIN)) return true

  if (!host.startsWith("admin.")) return false

  const payload = await getPayload({ config })
  const tenants = await payload.find({
    collection: "tenants",
    where: { domain: { equals: domain } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const tenant = tenants.docs[0]
  return Boolean(tenant && tenant.status !== "suspended" && tenant.status !== "archived")
}

export async function getTrustedSocialAuthOrigins(request?: Request): Promise<string[]> {
  const fallback = getCmsAuthFallbackOrigin()
  if (!request) return fallback ? [fallback] : []
  if (!(await isAllowedSocialAuthHost(request))) return []
  const origins = [`${requestProtocol(request)}://${requestHost(request)}`, fallback].filter(
    (origin): origin is string => Boolean(origin),
  )
  return Array.from(new Set(origins))
}
