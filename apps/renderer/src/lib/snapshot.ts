import type { Page } from "@siteinabox/contracts"
import {
  formatContractValidationIssues,
  PublishedSiteSnapshotSchema,
  type PublishedSiteSnapshot,
} from "@siteinabox/contracts/generation"
import { fixturePublishedSiteSnapshot } from "../fixtures/published-site"

type SnapshotPage = PublishedSiteSnapshot["pages"][number]

export type ResolvedPublishedPage = {
  snapshot: PublishedSiteSnapshot
  page: Page
  pathname: string
}

type SnapshotApiResponse = {
  snapshot?: PublishedSiteSnapshot
}

export function normalizeRequestHost(host: string | null | undefined): string {
  return (host ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
}

function cmsSnapshotEndpoint(host: string): URL | null {
  const baseUrl = process.env.SIAB_CMS_URL
  if (!baseUrl) return null
  const url = new URL("/api/renderer/snapshot", baseUrl)
  url.searchParams.set("host", host)
  return url
}

function fixtureModeEnabled(): boolean {
  return process.env.SIAB_RENDERER_FIXTURE_MODE === "1" && process.env.NODE_ENV !== "production"
}

export async function loadPublishedSnapshot(host?: string | null): Promise<PublishedSiteSnapshot | null> {
  const normalizedHost = normalizeRequestHost(host)
  if (!normalizedHost) return null

  const endpoint = cmsSnapshotEndpoint(normalizedHost)
  if (!endpoint) {
    if (fixtureModeEnabled()) return PublishedSiteSnapshotSchema.parse(fixturePublishedSiteSnapshot)
    throw new Error("SIAB_CMS_URL is required unless SIAB_RENDERER_FIXTURE_MODE=1 is set outside production.")
  }

  const headers: HeadersInit = {}
  const token = process.env.SIAB_RENDERER_API_TOKEN
  if (token) headers.authorization = `Bearer ${token}`

  const response = await fetch(endpoint, { headers, cache: "no-store" })
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`CMS snapshot lookup failed with ${response.status}`)
  }

  const data = (await response.json()) as SnapshotApiResponse
  if (!data.snapshot) return null
  const parsed = PublishedSiteSnapshotSchema.safeParse(data.snapshot)
  if (!parsed.success) {
    throw new Error(`CMS snapshot response failed contract validation: ${formatContractValidationIssues(parsed.error)}`)
  }
  return parsed.data
}

export function pathnameToSlug(pathname: string): string {
  const cleanPath = pathname.split(/[?#]/, 1)[0] ?? "/"
  const withoutSlashes = cleanPath.replace(/^\/+|\/+$/g, "")
  return withoutSlashes === "" ? "index" : decodeURIComponent(withoutSlashes)
}

export function pagePath(page: Page): string {
  return page.slug === "index" || page.slug === "/" ? "/" : `/${page.slug.replace(/^\/+/, "")}`
}

function isRenderablePublishedPage(page: SnapshotPage): page is SnapshotPage & Page {
  return page.status !== "draft" && typeof page.updatedAt === "string"
}

export function findPublishedPage(snapshot: PublishedSiteSnapshot, pathname: string): Page | null {
  const slug = pathnameToSlug(pathname)
  for (const page of snapshot.pages) {
    if (isRenderablePublishedPage(page) && page.slug === slug) return page
  }
  return null
}

export async function resolvePublishedPage(pathname: string, host?: string | null): Promise<ResolvedPublishedPage | null> {
  const snapshot = await loadPublishedSnapshot(host)
  if (!snapshot) return null
  const page = findPublishedPage(snapshot, pathname)
  if (!page) return null

  return {
    snapshot,
    page,
    pathname: pagePath(page),
  }
}

export async function listPublishedPaths(host?: string | null): Promise<string[]> {
  const snapshot = await loadPublishedSnapshot(host)
  if (!snapshot) return []
  return snapshot.pages.filter(isRenderablePublishedPage).map(pagePath)
}
