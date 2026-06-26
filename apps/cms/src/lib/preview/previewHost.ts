import { headers } from "next/headers"

const normalizeHost = (value: string | null): string => {
  const host = (value ?? "").split(",")[0]?.trim().toLowerCase() ?? ""
  if (host.startsWith("[")) return host
  return host.split(":")[0] ?? host
}

export const PREVIEW_HOST = "preview.siteinabox.nl"

export async function isPreviewHost(): Promise<boolean> {
  const headerStore = await headers()
  const host = normalizeHost(headerStore.get("x-forwarded-host") || headerStore.get("host"))
  if (host === PREVIEW_HOST) return true
  return process.env.NODE_ENV === "development" && (host === "localhost" || host === "127.0.0.1")
}

export async function previewRequestOrigin(): Promise<string> {
  const headerStore = await headers()
  const host = normalizeHost(headerStore.get("x-forwarded-host") || headerStore.get("host")) || PREVIEW_HOST
  const proto = headerStore.get("x-forwarded-proto") || (process.env.NODE_ENV === "development" ? "http" : "https")
  return `${proto}://${host}`
}
