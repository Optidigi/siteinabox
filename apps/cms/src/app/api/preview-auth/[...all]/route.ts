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

const ensureAllowedHost = (request: Request): Response | null => {
  if (isAllowedPreviewAuthHost(request)) return null
  return new Response("Unknown preview auth host", { status: 404 })
}

export async function GET(request: Request) {
  return ensureAllowedHost(request) ?? handlers.GET(request)
}

export async function POST(request: Request) {
  return ensureAllowedHost(request) ?? handlers.POST(request)
}
