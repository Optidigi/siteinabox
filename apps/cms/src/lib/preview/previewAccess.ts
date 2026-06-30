import "server-only"
import { getPayload, type Payload } from "payload"
import config from "@/payload.config"
import type { Page, PreviewAccessGrant, SiteGenerationRun, Tenant } from "@/payload-types"
import { relationshipId, sameRelationshipId } from "@/lib/relationshipId"
import { slugify } from "@/lib/slugify"

export const DEFAULT_PREVIEW_GRANT_TTL_DAYS = 14

export type PreviewGrantContext = {
  grant: PreviewAccessGrant
  payload: Payload
  tenant: Tenant
  run: SiteGenerationRun
  pages: Page[]
  customerEmail: string
  clientSlug: string
}

export type PreviewAccessRequest = {
  clientSlug: string
  email: string
  pageSlug?: string | null
  now?: Date
}

const normalizeEmail = (value: string): string => value.trim().toLowerCase()

export const normalizePreviewClientSlug = (value: string): string => slugify(value.trim().toLowerCase())

export const previewClientSlugFromDomain = (domain: string | null | undefined, fallback: string): string => {
  const host = (domain ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")
  const withoutWww = host.replace(/^www\./, "")
  const firstLabel = withoutWww.split(".")[0] ?? ""
  return normalizePreviewClientSlug(firstLabel) || normalizePreviewClientSlug(fallback)
}

const relationIds = (items: unknown): string[] =>
  Array.isArray(items)
    ? items.map((item) => relationshipId(item)).filter((id): id is string => Boolean(id))
    : []

const grantIsActive = (grant: PreviewAccessGrant, now: Date): boolean => {
  if (grant.revokedAt) return false
  const expiresAt = new Date(grant.expiresAt)
  return !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() > now.getTime()
}

const pageMatchesSlug = (page: Page, slug: string | null | undefined): boolean => {
  if (!slug) return false
  const normalized = slug.replace(/^\/+|\/+$/g, "") || "index"
  return String(page.slug) === normalized
}

const defaultGrantExpiry = (now = new Date()): string => {
  const expiry = new Date(now)
  expiry.setDate(expiry.getDate() + DEFAULT_PREVIEW_GRANT_TTL_DAYS)
  return expiry.toISOString()
}

export async function hasActivePreviewGrant(email: string, clientSlug: string, payloadArg?: Payload): Promise<boolean> {
  const payload = payloadArg ?? await getPayload({ config })
  const result = await payload.find({
    collection: "preview-access-grants",
    where: {
      and: [
        { customerEmail: { equals: normalizeEmail(email) } },
        { clientSlug: { equals: normalizePreviewClientSlug(clientSlug) } },
      ],
    },
    limit: 10,
    depth: 0,
    overrideAccess: true,
  })
  const now = new Date()
  return (result.docs as PreviewAccessGrant[]).some((grant) => grantIsActive(grant, now))
}

export async function hasAnyActivePreviewGrant(email: string, payloadArg?: Payload): Promise<boolean> {
  const payload = payloadArg ?? await getPayload({ config })
  const result = await payload.find({
    collection: "preview-access-grants",
    where: { customerEmail: { equals: normalizeEmail(email) } },
    limit: 25,
    depth: 0,
    overrideAccess: true,
  })
  const now = new Date()
  return (result.docs as PreviewAccessGrant[]).some((grant) => grantIsActive(grant, now))
}

export async function loadPreviewGrantContext(request: PreviewAccessRequest): Promise<PreviewGrantContext> {
  const payload = await getPayload({ config })
  const customerEmail = normalizeEmail(request.email)
  const clientSlug = normalizePreviewClientSlug(request.clientSlug)
  if (!customerEmail || !clientSlug) throw new Error("Preview access is not available")

  const grants = await payload.find({
    collection: "preview-access-grants",
    where: {
      and: [
        { customerEmail: { equals: customerEmail } },
        { clientSlug: { equals: clientSlug } },
      ],
    },
    sort: "-updatedAt",
    limit: 10,
    depth: 2,
    overrideAccess: true,
  })
  const now = request.now ?? new Date()
  const grant = (grants.docs as PreviewAccessGrant[]).find((entry) => grantIsActive(entry, now))
  if (!grant) throw new Error("Preview access is not available")

  const tenant = typeof grant.tenant === "object" && grant.tenant ? grant.tenant as Tenant : await payload.findByID({
    collection: "tenants",
    id: grant.tenant,
    depth: 0,
    overrideAccess: true,
  }) as Tenant
  if (!tenant || tenant.status === "archived" || tenant.status === "suspended") {
    throw new Error("Preview tenant is not available")
  }
  const expectedClientSlug = previewClientSlugFromDomain(
    typeof tenant.domain === "string" ? tenant.domain : null,
    String(tenant.slug ?? tenant.name ?? ""),
  )
  if (expectedClientSlug !== clientSlug) {
    throw new Error("Preview access is not available")
  }

  const run = typeof grant.generationRun === "object" && grant.generationRun
    ? grant.generationRun as SiteGenerationRun
    : await payload.findByID({
        collection: "site-generation-runs",
        id: grant.generationRun,
        depth: 1,
        overrideAccess: true,
      }) as SiteGenerationRun
  if (!run || run.status !== "preview_ready" || !sameRelationshipId(run.tenant, tenant.id)) {
    throw new Error("Preview run is not available")
  }

  const pageResult = await payload.find({
    collection: "pages",
    where: { tenant: { equals: tenant.id } },
    sort: "slug",
    limit: 100,
    depth: 2,
    overrideAccess: true,
  })
  const allTenantPages = pageResult.docs as Page[]
  const runPageIds = new Set(relationIds(run.pages))
  const grantPageIds = relationIds(grant.pages)
  const allowedIds = grantPageIds.length > 0 ? new Set(grantPageIds) : runPageIds
  const pages = allTenantPages.filter((page) => allowedIds.has(String(page.id)))
  if (pages.length === 0) throw new Error("Preview page is not available")
  if (request.pageSlug && !pages.some((page) => pageMatchesSlug(page, request.pageSlug))) {
    throw new Error("Preview page is not available")
  }

  return { grant, payload, tenant, run, pages, customerEmail, clientSlug }
}

export async function createOrRefreshPreviewGrant(input: {
  generationRunId: string | number
  customerEmail: string
  expiresAt?: string | null
  sendEmail?: boolean
}): Promise<PreviewAccessGrant> {
  const payload = await getPayload({ config })
  const customerEmail = normalizeEmail(input.customerEmail)
  if (!customerEmail) throw new Error("E-mailadres van de klant is verplicht")

  const run = await payload.findByID({
    collection: "site-generation-runs",
    id: input.generationRunId,
    depth: 2,
    overrideAccess: true,
  }) as SiteGenerationRun
  if (!run || run.status !== "preview_ready") throw new Error("Generation run is not preview-ready")

  const tenant = typeof run.tenant === "object" && run.tenant
    ? run.tenant as Tenant
    : await payload.findByID({
        collection: "tenants",
        id: run.tenant as any,
        depth: 0,
        overrideAccess: true,
      }) as Tenant
  if (!tenant || tenant.status === "archived" || tenant.status === "suspended") {
    throw new Error("Preview tenant is not available")
  }
  const clientSlug = previewClientSlugFromDomain(
    typeof tenant.domain === "string" ? tenant.domain : null,
    String(tenant.slug ?? tenant.name ?? ""),
  )
  if (!clientSlug) throw new Error("Preview client slug is not available")

  const expiresAt = input.expiresAt || defaultGrantExpiry()
  const existing = await payload.find({
    collection: "preview-access-grants",
    where: {
      and: [
        { customerEmail: { equals: customerEmail } },
        { generationRun: { equals: run.id } },
        { clientSlug: { equals: clientSlug } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const pageIds = relationIds(run.pages)
  const now = new Date().toISOString()
  const current = existing.docs[0] as PreviewAccessGrant | undefined
  if (current) {
    return await payload.update({
      collection: "preview-access-grants",
      id: current.id,
      data: {
        tenant: tenant.id,
        generationRun: run.id,
        clientSlug,
        pages: pageIds,
        expiresAt,
        revokedAt: null,
        ...(input.sendEmail ? { lastSentAt: now, sentCount: (current.sentCount ?? 0) + 1 } : {}),
      } as any,
      overrideAccess: true,
      depth: 0,
    }) as PreviewAccessGrant
  }

  return await payload.create({
    collection: "preview-access-grants",
    data: {
      customerEmail,
      tenant: tenant.id,
      generationRun: run.id,
      clientSlug,
      pages: pageIds,
      expiresAt,
      ...(input.sendEmail ? { lastSentAt: now, sentCount: 1 } : {}),
    } as any,
    overrideAccess: true,
    depth: 0,
  }) as PreviewAccessGrant
}
