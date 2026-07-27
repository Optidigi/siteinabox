import type { Page } from "@siteinabox/contracts"
import { isRendererProductionHost } from "@siteinabox/contracts/deploy-targets"
import {
  formatContractValidationIssues,
  schemaForPublishedSiteSnapshot,
  type PublishedSiteSnapshot,
} from "@siteinabox/contracts/generation"
import {
  normalizePublicDomainHost,
  rendererSnapshotEnvelopeSchema,
  type RendererActiveDomainRouting,
} from "@siteinabox/contracts/renderer-routing"
import { fixturePublishedSiteSnapshot } from "../fixtures/published-site"
import { pathnameToSlug } from "./pathname.js"

type SnapshotPage = PublishedSiteSnapshot["pages"][number]

export type ResolvedPublishedPage = {
  snapshot: PublishedSiteSnapshot
  page: Page
  pathname: string
}

type SnapshotApiResponse = {
  routing?: RendererActiveDomainRouting
  tenant?: {
    id: string | number
    slug: string
    domain: string
    status: "active"
  }
  snapshotId?: string | number
  snapshot?: PublishedSiteSnapshot
}

export function normalizeRequestHost(host: string | null | undefined): string {
  const publicHost = normalizePublicDomainHost(host)
  if (publicHost) return publicHost

  const localHost = (host ?? "").trim().toLowerCase().replace(/:\d+$/, "")
  if (process.env.NODE_ENV !== "production" && (localHost === "localhost" || localHost === "127.0.0.1")) {
    return localHost
  }
  return ""
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

function fixtureHostAllowed(host: string): boolean {
  return isRendererProductionHost(host) || host === "localhost" || host === "127.0.0.1" || host === ""
}

function legacyActiveHosts(snapshot: PublishedSiteSnapshot): string[] {
  const aliases = (snapshot.settings.aliases ?? [])
    .map((alias) => normalizePublicDomainHost(alias.host))
    .filter((host): host is string => Boolean(host))
  const canonicalHost = normalizePublicDomainHost(snapshot.domain)
  return [...new Set([canonicalHost, ...aliases].filter((host): host is string => Boolean(host)))]
}

function snapshotMatchesLegacyActiveHosts(snapshot: PublishedSiteSnapshot, requestedHost: string): boolean {
  return legacyActiveHosts(snapshot).includes(requestedHost)
}

export async function loadPublishedSnapshot(host?: string | null): Promise<PublishedSiteSnapshot | null> {
  const normalizedHost = normalizeRequestHost(host)
  if (!normalizedHost) return null

  const endpoint = cmsSnapshotEndpoint(normalizedHost)
  if (!endpoint) {
    if (fixtureModeEnabled()) {
      return fixtureHostAllowed(normalizedHost)
        ? schemaForPublishedSiteSnapshot(fixturePublishedSiteSnapshot).parse(fixturePublishedSiteSnapshot)
        : null
    }
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
  const parsed = schemaForPublishedSiteSnapshot(data.snapshot).safeParse(data.snapshot)
  if (!parsed.success) {
    throw new Error(`CMS snapshot response failed contract validation: ${formatContractValidationIssues(parsed.error)}`)
  }

  if (data.routing || data.tenant || data.snapshotId != null) {
    const envelope = rendererSnapshotEnvelopeSchema.safeParse(data)
    if (!envelope.success) {
      throw new Error(`CMS routing response failed contract validation: ${formatContractValidationIssues(envelope.error)}`)
    }
    if (envelope.data.routing.requestedHost !== normalizedHost) return null
    return envelope.data.snapshot
  }

  // Rolling-deploy compatibility for the pre-routing-envelope CMS response.
  // Its published snapshot still supplies a bounded canonical host/alias list.
  return snapshotMatchesLegacyActiveHosts(parsed.data, normalizedHost) ? parsed.data : null
}

export function pagePath(page: Page): string {
  return page.slug === "index" || page.slug === "/" ? "/" : `/${page.slug.replace(/^\/+/, "")}`
}

function isRenderablePublishedPage(page: SnapshotPage): page is SnapshotPage & Page {
  return page.status !== "draft" && typeof page.updatedAt === "string"
}

export function findPublishedPage(snapshot: PublishedSiteSnapshot, pathname: string): Page | null {
  const slug = pathnameToSlug(pathname)
  if (!slug) return null
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
