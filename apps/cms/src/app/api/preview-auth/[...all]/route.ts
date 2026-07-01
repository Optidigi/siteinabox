import { previewAuth } from "@/lib/preview/betterAuth"
import { PREVIEW_HOST } from "@/lib/preview/previewHost"
import { toNextJsHandler } from "better-auth/next-js"

const handlers = toNextJsHandler(previewAuth)

const normalizeHost = (value: string | null): string => {
  const host = (value ?? "").split(",")[0]?.trim().toLowerCase() ?? ""
  if (host.startsWith("[")) return host
  return host.split(":")[0] ?? host
}

const isAllowedPreviewAuthHost = (request: Request): boolean => {
  const host = normalizeHost(request.headers.get("x-forwarded-host") || request.headers.get("host"))
  if (host === PREVIEW_HOST) return true
  return process.env.NODE_ENV === "development" && (host === "localhost" || host === "127.0.0.1")
}

const buildPreviewAuthRequest = (request: Request): Request => {
  const headers = new Headers(request.headers)
  headers.set("host", PREVIEW_HOST)
  headers.set("x-forwarded-host", PREVIEW_HOST)
  headers.set("x-forwarded-proto", "https")
  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    body: request.body,
    redirect: request.redirect,
    signal: request.signal,
  }
  if (request.body) init.duplex = "half"
  return new Request(request.url, init)
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
