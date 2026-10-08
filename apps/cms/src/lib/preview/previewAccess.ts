import "server-only"
import { getPayload, type Payload, type PayloadRequest } from "payload"
import config from "@/payload.config"
import type { Page, PreviewAccessGrant, SiteGenerationRun, Tenant } from "@/payload-types"
import { relationshipValue, relationshipId, sameRelationshipId } from "@/lib/relationshipId"
import { assertLiveBuilderTransaction } from "@/lib/builder/quotaTransaction"
import { slugify } from "@/lib/slugify"

export type PreviewGrantContext = {
  grant: PreviewAccessGrant
  payload: Payload
  tenant: Tenant
  run: SiteGenerationRun
  pages: Page[]
  customerEmail: string
  clientSlug: string
}

/**
 * The authority needed by non-page preview operations.  Keep this deliberately
 * smaller than PreviewGrantContext: autocomplete and other checkout reads must
 * not materialize the preview page collection.
 */
export type PreviewGrantAuthority = Omit<PreviewGrantContext, "pages">

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
    ? items.map((item: unknown) => relationshipId(relationshipValue(item))).filter((id): id is string => Boolean(id))
    : []

const payloadRelationIds = (items: unknown): number[] =>
  Array.isArray(items)
    ? items
      .map((item: unknown) => {
        const id = item && typeof item === "object" && "id" in item
          ? (item as { id?: string | number | null }).id
          : item
        if (typeof id === "number" && Number.isFinite(id)) return id
        if (typeof id === "string" && id.trim()) {
          const numeric = Number(id)
          return Number.isFinite(numeric) ? numeric : null
        }
        return null
      })
      .filter((id): id is number => id != null)
    : []

export const grantIsActive = (grant: PreviewAccessGrant, now: Date): boolean => {
  if (grant.revokedAt || grant.inactiveExpiredAt) return false
  // Inactivity expiry requires the owning worker's committed delivered-notice
  // decision. A disabled policy cannot expire previews through another clock.
  if (grant.expiryPolicy === "inactivity") return true
  if (grant.expiryPolicy && grant.expiryPolicy !== "fixed") return false
  // Legacy grants remain fixed: never infer that an old deadline was automatic.
  const expiresAt = typeof grant.expiresAt === "string" ? Date.parse(grant.expiresAt) : NaN
  return Number.isFinite(expiresAt) && expiresAt > now.getTime()
}

const pageMatchesSlug = (page: Page, slug: string | null | undefined): boolean => {
  if (!slug) return false
  const normalized = slug.replace(/^\/+|\/+$/g, "") || "index"
  return String(page.slug) === normalized
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

export async function loadLatestActivePreviewGrant(
  email: string,
  payloadArg?: Payload,
): Promise<PreviewAccessGrant | null> {
  const payload = payloadArg ?? await getPayload({ config })
  const result = await payload.find({
    collection: "preview-access-grants",
    where: { customerEmail: { equals: normalizeEmail(email) } },
    sort: "-updatedAt",
    limit: 25,
    depth: 0,
    overrideAccess: true,
  })
  const now = new Date()
  return (result.docs as PreviewAccessGrant[]).find((grant) => grantIsActive(grant, now)) ?? null
}

export async function hasActivePreviewGrantForTenant(
  email: string,
  tenantId: string | number,
  payloadArg?: Payload,
): Promise<boolean> {
  const payload = payloadArg ?? await getPayload({ config })
  const result = await payload.find({
    collection: "preview-access-grants",
    where: {
      and: [
        { customerEmail: { equals: normalizeEmail(email) } },
        { tenant: { equals: tenantId } },
      ],
    },
    limit: 10,
    depth: 0,
    overrideAccess: true,
  })
  const now = new Date()
  return (result.docs as PreviewAccessGrant[]).some((grant) => grantIsActive(grant, now))
}

export async function loadPreviewGrantAuthority(request: PreviewAccessRequest): Promise<PreviewGrantAuthority> {
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
    depth: 1,
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

  return { grant, payload, tenant, run, customerEmail, clientSlug }
}

export async function loadPreviewGrantContext(request: PreviewAccessRequest): Promise<PreviewGrantContext> {
  const authority = await loadPreviewGrantAuthority(request)
  const pageResult = await authority.payload.find({
    collection: "pages",
    where: { tenant: { equals: authority.tenant.id } },
    sort: "slug",
    limit: 100,
    depth: 2,
    overrideAccess: true,
  })
  const allTenantPages = pageResult.docs as Page[]
  const runPageIds = new Set(relationIds(authority.run.pages))
  const grantPageIds = relationIds(authority.grant.pages)
  const allowedIds = grantPageIds.length > 0 ? new Set(grantPageIds) : runPageIds
  const pages = allTenantPages.filter((page) => allowedIds.has(String(page.id)))
  if (pages.length === 0) throw new Error("Preview page is not available")
  if (request.pageSlug && !pages.some((page) => pageMatchesSlug(page, request.pageSlug))) {
    throw new Error("Preview page is not available")
  }

  return { ...authority, pages }
}

export async function createOrRefreshPreviewGrant(input: {
  generationRunId: string | number
  customerEmail: string
  expiresAt?: string | null
  sendEmail?: boolean
  req?: Partial<PayloadRequest>
}): Promise<PreviewAccessGrant> {
  const payload = await getPayload({ config })
  const fence = () => { if (input.req) assertLiveBuilderTransaction(payload, input.req) }
  fence()
  const customerEmail = normalizeEmail(input.customerEmail)
  if (!customerEmail) throw new Error("E-mailadres van de klant is verplicht")

  const run = await payload.findByID({
    collection: "site-generation-runs",
    id: input.generationRunId,
    depth: 2,
    overrideAccess: true,
    req: input.req,
  })
  fence()
  if (!run || run.status !== "preview_ready") throw new Error("Generation run is not preview-ready")

  const tenantId = relationshipId(run.tenant)
  if (!tenantId) throw new Error("Preview tenant is not available")
  fence()
  const tenant = await payload.findByID({
    collection: "tenants",
    id: tenantId,
    depth: 0,
    overrideAccess: true,
    req: input.req,
  })
  fence()
  if (!tenant || tenant.status === "archived" || tenant.status === "suspended") {
    throw new Error("Preview tenant is not available")
  }
  const clientSlug = previewClientSlugFromDomain(
    typeof tenant.domain === "string" ? tenant.domain : null,
    String(tenant.slug ?? tenant.name ?? ""),
  )
  if (!clientSlug) throw new Error("Preview client slug is not available")

  const explicitExpiry = input.expiresAt != null
  if (explicitExpiry && !Number.isFinite(Date.parse(input.expiresAt ?? ""))) throw new Error("Invalid preview expiry date")
  fence()
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
    req: input.req,
  })
  fence()
  const pageIds = payloadRelationIds(run.pages)
  const now = new Date().toISOString()
  const current = existing.docs[0]
  if (current) {
    if (!grantIsActive(current, new Date())) throw new Error("Preview access is not available")
    fence()
    await payload.update({
      collection: "preview-access-grants",
      id: current.id,
      data: {
        tenant: tenant.id,
        generationRun: run.id,
        clientSlug,
        pages: pageIds,
        ...(explicitExpiry ? { expiryPolicy: "fixed", expiresAt: input.expiresAt } : {}),
        ...(input.sendEmail ? { lastSentAt: now, sentCount: (current.sentCount ?? 0) + 1 } : {}),
      },
      overrideAccess: true,
      req: input.req,
      depth: 0,
    })
    fence()
    const refreshed = await payload.findByID({
      collection: "preview-access-grants",
      id: current.id,
      depth: 0,
      overrideAccess: true,
      req: input.req,
    })
    fence()
    return refreshed
  }

  fence()
  const created = await payload.create({
    collection: "preview-access-grants",
    data: {
      customerEmail,
      tenant: tenant.id,
      generationRun: run.id,
      clientSlug,
      pages: pageIds,
      expiryPolicy: explicitExpiry ? "fixed" : "inactivity",
      ...(explicitExpiry ? { expiresAt: input.expiresAt } : {}),
      ...(input.sendEmail ? { lastSentAt: now, sentCount: 1 } : {}),
    },
    overrideAccess: true,
    req: input.req,
    depth: 0,
  })
  fence()
  return created
}
