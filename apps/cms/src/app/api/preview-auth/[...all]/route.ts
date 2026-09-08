import { previewAuth } from "@/lib/preview/betterAuth"
import { isPublicPreviewHostname } from "@/lib/preview/previewHost"
import { toNextJsHandler } from "better-auth/next-js"

const handlers = toNextJsHandler(previewAuth)

const requestHostHeader = (request: Request): string =>
  (request.headers.get("x-forwarded-host") || request.headers.get("host") || "")
    .split(",")[0]
    ?.trim()
    .toLowerCase() ?? ""

const hostnameOf = (host: string): string => {
  if (host.startsWith("[")) return host
  return host.split(":")[0] ?? host
}

const isAllowedPreviewAuthHost = (request: Request): boolean => {
  const host = hostnameOf(requestHostHeader(request))
  if (isPublicPreviewHostname(host)) return true
  return process.env.NODE_ENV === "development" && (host === "localhost" || host === "127.0.0.1")
}

const buildPreviewAuthRequest = (request: Request): Request => {
  const host = requestHostHeader(request)
  const hostname = hostnameOf(host)
  const developmentLoopback =
    process.env.NODE_ENV === "development" && (hostname === "localhost" || hostname === "127.0.0.1")
  const headers = new Headers(request.headers)
  headers.set("host", host)
  headers.set("x-forwarded-host", host)
  headers.set("x-forwarded-proto", developmentLoopback ? "http" : "https")
  const url = new URL(request.url)
  url.protocol = developmentLoopback ? "http:" : "https:"
  url.host = host
  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    body: request.body,
    redirect: request.redirect,
    signal: request.signal,
  }
  if (request.body) init.duplex = "half"
  return new Request(url, init)
}

const ensureAllowedHost = (request: Request): Response | null => {
  if (isAllowedPreviewAuthHost(request)) return null
  return new Response("Unknown preview auth host", { status: 404 })
}

export async function GET(request: Request) {
  const denied = ensureAllowedHost(request)
  if (denied) return denied
  const authRequest = buildPreviewAuthRequest(request)
  return handlers.GET(authRequest)
}

export async function POST(request: Request) {
  const denied = ensureAllowedHost(request)
  if (denied) return denied
  const authRequest = buildPreviewAuthRequest(request)
  return handlers.POST(authRequest)
}
