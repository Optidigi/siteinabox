import { readFile, stat } from "node:fs/promises"
import type { APIRoute } from "astro"
import { loadPublishedSnapshot } from "../../../lib/snapshot"
import { cmsRendererMediaEndpoint, mediaContentType, safeTenantMediaFilePath } from "../../../lib/media"
import { publicHostFromProtectedRequest } from "../../../lib/origin-protection"
import { readRuntimeSecret } from "../../../lib/runtime-secret"

function notFound(): Response {
  return new Response(null, {
    status: 404,
    headers: {
      "cache-control": "no-store",
    },
  })
}

async function fetchCmsMediaFallback({
  tenantId,
  mediaPath,
  includeBody,
}: {
  tenantId: string
  mediaPath: string
  includeBody: boolean
}): Promise<Response | null> {
  const endpoint = cmsRendererMediaEndpoint(tenantId, mediaPath)
  if (!endpoint) return null

  const headers: HeadersInit = {}
  const token = readRuntimeSecret(
    process.env.SIAB_RENDERER_API_TOKEN,
    process.env.SIAB_RENDERER_API_TOKEN_FILE,
  )
  if (token) headers.authorization = `Bearer ${token}`

  const response = await fetch(endpoint, {
    method: includeBody ? "GET" : "HEAD",
    headers,
    cache: "no-store",
  })
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`CMS media lookup failed with ${response.status}`)
  }

  const proxyHeaders = new Headers()
  for (const header of [
    "cache-control",
    "content-length",
    "content-security-policy",
    "content-type",
    "etag",
    "last-modified",
    "x-content-type-options",
  ]) {
    const value = response.headers.get(header)
    if (value) proxyHeaders.set(header, value)
  }
  if (!proxyHeaders.has("cache-control")) proxyHeaders.set("cache-control", "public, max-age=3600")

  return new Response(includeBody ? response.body : null, {
    status: 200,
    headers: proxyHeaders,
  })
}

async function resolveMediaResponse({ params, request, includeBody }: Parameters<APIRoute>[0] & { includeBody: boolean }) {
  const tenantId = params.tenantId
  const mediaPath = params.path
  if (!tenantId || !mediaPath) return notFound()

  const host = publicHostFromProtectedRequest(request)
  const snapshot = await loadPublishedSnapshot(host)
  if (!snapshot || snapshot.tenantId !== tenantId) return notFound()

  const filePath = safeTenantMediaFilePath({ tenantId, mediaPath })
  if (!filePath) return notFound()

  try {
    const fileStat = await stat(filePath)
    if (!fileStat.isFile()) return notFound()
    const contentType = mediaContentType(filePath)
    const headers: Record<string, string> = {
      "cache-control": "public, max-age=3600",
      "content-length": String(fileStat.size),
      "content-type": contentType,
      "x-content-type-options": "nosniff",
    }
    if (contentType === "image/svg+xml") {
      headers["content-security-policy"] =
        "default-src 'none'; script-src 'none'; sandbox"
    }
    if (!includeBody) return new Response(null, { status: 200, headers })
    return new Response(await readFile(filePath), { status: 200, headers })
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return (await fetchCmsMediaFallback({ tenantId, mediaPath, includeBody })) ?? notFound()
    }
    throw error
  }
}

export const GET: APIRoute = (context) => resolveMediaResponse({ ...context, includeBody: true })
export const HEAD: APIRoute = (context) => resolveMediaResponse({ ...context, includeBody: false })
