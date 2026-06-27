import { existsSync } from "node:fs"
import { readFile, stat } from "node:fs/promises"
import { extname, join, normalize, resolve, sep } from "node:path"
import { AMICARE_LEGACY_DOCUMENTS } from "./html.ts"

const DEFAULT_HOSTS = ["amicare.optidigi.nl"]
const AMICARE_ROBOTS_TXT = "User-agent: *\nAllow: /\n\nSitemap: https://ami-care.nl/sitemap-index.xml\n"

const CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".woff2", "font/woff2"],
  [".xml", "application/xml; charset=utf-8"],
])

function configuredHosts() {
  const hosts = process.env.AMICARE_LEGACY_HOSTS
  if (!hosts) return DEFAULT_HOSTS
  return hosts
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean)
}

export function isAmicareLegacyHost(host: string) {
  return configuredHosts().includes(host)
}

function candidateClientDirs() {
  const configured = process.env.AMICARE_LEGACY_CLIENT_DIR
  const cwd = process.cwd()
  return [
    configured,
    "/app/legacy-tenants/amicare/client",
    resolve(cwd, "sites/ami-care/dist/client"),
    resolve(cwd, "../../sites/ami-care/dist/client"),
  ].filter((dir): dir is string => Boolean(dir))
}

function candidateMediaDirs() {
  const configured = process.env.AMICARE_LEGACY_MEDIA_DIR
  const cwd = process.cwd()
  return [
    configured,
    "/app/legacy-tenants/amicare/media",
    resolve(cwd, "sites/ami-care/src/assets"),
    resolve(cwd, "../../sites/ami-care/src/assets"),
  ].filter((dir): dir is string => Boolean(dir))
}

function firstExistingDir(candidates: string[]) {
  return candidates.find((dir) => existsSync(dir)) ?? null
}

function normalizePathname(pathname: string) {
  return (pathname.split(/[?#]/, 1)[0] || "/").replace(/\/+$/, "") || "/"
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

function safeRelativePath(pathname: string, prefix = "") {
  const withoutPrefix = prefix && pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname
  const decodedPathname = safeDecodeURIComponent(withoutPrefix)
  if (!decodedPathname) return null
  const relativePath = normalize(decodedPathname.replace(/^\/+/, ""))
  if (!relativePath || relativePath.startsWith("..") || relativePath.includes(`${sep}..${sep}`)) return null
  return relativePath
}

async function resolveFile(rootDir: string | null, relativePath: string | null) {
  if (!rootDir || !relativePath) return null

  const absolutePath = resolve(join(rootDir, relativePath))
  const resolvedRootDir = resolve(rootDir)
  if (absolutePath !== resolvedRootDir && !absolutePath.startsWith(`${resolvedRootDir}${sep}`)) return null

  try {
    const fileStat = await stat(absolutePath)
    return fileStat.isFile() ? absolutePath : null
  } catch {
    return null
  }
}

async function responseForFile(filePath: string, statusCode = 200) {
  const body = await readFile(filePath)
  const extension = extname(filePath)
  const headers = new Headers({
    "content-type": CONTENT_TYPES.get(extension) ?? "application/octet-stream",
    ...legacySecurityHeaders(),
  })

  headers.set("cache-control", "public, max-age=31536000, immutable")

  return new Response(body, { headers, status: statusCode })
}

function htmlResponse(html: string, statusCode = 200) {
  return new Response(html, {
    status: statusCode,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "x-siab-legacy-tenant": "amicare",
      ...legacySecurityHeaders(),
    },
  })
}

function textResponse(body: string) {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "x-siab-legacy-tenant": "amicare",
      ...legacySecurityHeaders(),
    },
  })
}

function legacySecurityHeaders() {
  return {
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "interest-cohort=(), camera=(), microphone=(), geolocation=(), payment=()",
    "strict-transport-security": "max-age=31536000; includeSubDomains",
    "x-frame-options": "SAMEORIGIN",
    "content-security-policy":
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://r.siteinabox.nl https://eu-assets.i.posthog.com; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self' https://r.siteinabox.nl https://eu.posthog.com https://eu-assets.i.posthog.com; base-uri 'self'; frame-ancestors 'none'; form-action 'none'",
  }
}

export async function createAmicareLegacyResponse(pathname: string) {
  const cleanPath = normalizePathname(pathname)
  if (cleanPath === "/") return htmlResponse(AMICARE_LEGACY_DOCUMENTS.index)
  if (cleanPath === "/robots.txt") return textResponse(AMICARE_ROBOTS_TXT)

  if (cleanPath.startsWith("/media/")) {
    const filePath = await resolveFile(firstExistingDir(candidateMediaDirs()), safeRelativePath(cleanPath, "/media/"))
    return filePath ? responseForFile(filePath) : null
  }

  if (cleanPath.startsWith("/api/tenant-media/7/")) {
    const filePath = await resolveFile(
      firstExistingDir(candidateMediaDirs()),
      safeRelativePath(cleanPath, "/api/tenant-media/7/"),
    )
    return filePath ? responseForFile(filePath) : null
  }

  const filePath = await resolveFile(firstExistingDir(candidateClientDirs()), safeRelativePath(cleanPath))
  return filePath ? responseForFile(filePath) : null
}

export function createAmicareLegacyNotFoundResponse() {
  return htmlResponse(AMICARE_LEGACY_DOCUMENTS["404"], 404)
}

export async function createAmicareLegacyResponseOrNotFound(pathname: string) {
  return (await createAmicareLegacyResponse(pathname)) ?? createAmicareLegacyNotFoundResponse()
}
