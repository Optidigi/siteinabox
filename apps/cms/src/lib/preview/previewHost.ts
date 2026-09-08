import { headers } from "next/headers"
import {
  canonicalRequestAuthority,
  isPreviewRequestAuthority,
} from "@/lib/requestAuthority"

/** Legacy public preview hostname. Still accepted; new links use the admin host. */
export const PREVIEW_HOST = "preview.siteinabox.nl"
export const PLATFORM_ADMIN_HOST = "admin.siteinabox.nl"
export const PUBLIC_PREVIEW_HOST = PLATFORM_ADMIN_HOST
export const PUBLIC_PREVIEW_ORIGIN = `https://${PUBLIC_PREVIEW_HOST}`

export const isPublicPreviewHostname = (hostname: string): boolean =>
  hostname === PLATFORM_ADMIN_HOST || hostname === PREVIEW_HOST

export async function isPreviewHost(): Promise<boolean> {
  const headerStore = await headers()
  return isPreviewRequestAuthority(headerStore)
}

export async function previewRequestOrigin(): Promise<string> {
  const headerStore = await headers()
  const authority = canonicalRequestAuthority(headerStore)
  if (!authority || !isPreviewRequestAuthority(headerStore)) {
    throw new Error("Preview request authority is invalid.")
  }
  return authority.origin
}

/** Better Auth header host for preview sessions: the public request host when allowed. */
export function previewAuthHeaderHost(source: Headers, env: NodeJS.ProcessEnv = process.env): string {
  const authority = canonicalRequestAuthority(source, env)
  if (authority && isPreviewRequestAuthority(source, env)) {
    if (authority.developmentLoopback) return authority.host
    return authority.hostname
  }
  return PUBLIC_PREVIEW_HOST
}

export function previewAuthRequestHeaders(source: Headers, env: NodeJS.ProcessEnv = process.env): Headers {
  const next = new Headers(source)
  const authority = canonicalRequestAuthority(source, env)
  const host = previewAuthHeaderHost(source, env)
  next.set("host", host)
  next.set("x-forwarded-host", host)
  next.set("x-forwarded-proto", authority?.developmentLoopback ? "http" : "https")
  return next
}

export function publicCheckoutReturnUrl(clientSlug: string): string {
  return `${PUBLIC_PREVIEW_ORIGIN}/${encodeURIComponent(clientSlug)}/checkout?payment=return`
}
