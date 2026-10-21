import "server-only"
import { getPayload, type Payload } from "payload"
import config from "@/payload.config"
import type { Page, PreviewAccessGrant, SiteGenerationRun, Tenant } from "@/payload-types"
import { relationshipId, sameRelationshipId } from "@/lib/relationshipId"
import { slugify } from "@/lib/slugify"
import { assertCustomerAccess, withCustomerWorkspace, type CustomerAuthority } from "@/lib/auth/customerWorkspace"
import { CustomerIdentityError } from "@/lib/auth/verifiedCustomer"

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
  customerAuthority?: CustomerAuthority
  intent?: "read" | "write" | "purchase"
  renewExpired?: boolean
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

const payloadRelationIds = (items: unknown): number[] =>
  Array.isArray(items)
    ? items
      .map((item) => {
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
  const account = request.customerAuthority ? await assertCustomerAccess(payload, request.customerAuthority,
    { intent: request.intent ?? "read" }) : null
  if (account && account.email !== customerEmail) throw new CustomerIdentityError("E_CUSTOMER_IDENTITY_CONFLICT")

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
  let grant = (grants.docs as PreviewAccessGrant[]).find((entry) => grantIsActive(entry, now) ||
    (request.renewExpired === true && request.customerAuthority && !entry.revokedAt && Number.isFinite(Date.parse(entry.expiresAt))))
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

  if (account && request.customerAuthority) {
    if (!relationshipId(account.tenant)) {
      // A first verified recipient may have a pre-existing site-ready grant.
      // Only one unambiguous stored tenant can establish the permanent binding;
      // a caller's slug cannot choose between historical workspaces.
      const historical = await payload.find({ collection: "preview-access-grants",
        where: { customerEmail: { equals: customerEmail } }, limit: 101, depth: 0, overrideAccess: true })
      const tenants = new Set(historical.docs.map(entry => relationshipId(entry.tenant)))
      if (historical.totalDocs > 100 || tenants.size !== 1 || !tenants.has(String(tenant.id))) {
        throw new CustomerIdentityError("E_CUSTOMER_WORKSPACE_CONFLICT")
      }
      await withCustomerWorkspace(payload, request.customerAuthority, async bound => {
        if (bound && String(bound.id) !== String(tenant.id)) throw new CustomerIdentityError("E_CUSTOMER_WORKSPACE_CONFLICT")
        return { doc: bound ?? tenant, operation: "updated" }
      })
    }
    await assertCustomerAccess(payload, request.customerAuthority, { intent: request.intent ?? "read", tenantId: tenant.id })
    if (!grantIsActive(grant, now)) {
      const expired = grant
      let renewed: PreviewAccessGrant | null = null
      await withCustomerWorkspace(payload, request.customerAuthority, async (bound, req) => {
        if (!bound || String(bound.id) !== String(tenant.id)) throw new CustomerIdentityError("E_CUSTOMER_WORKSPACE_CONFLICT")
        const current = await payload.findByID({ collection: "preview-access-grants", id: expired.id,
          overrideAccess: true, depth: 0, req })
        if (current.revokedAt || normalizeEmail(current.customerEmail) !== customerEmail ||
            !sameRelationshipId(current.tenant, tenant.id) || !sameRelationshipId(current.generationRun, run.id)) {
          throw new CustomerIdentityError("E_CUSTOMER_WORKSPACE_UNAVAILABLE")
        }
        renewed = await payload.update({ collection: "preview-access-grants", id: current.id,
          data: { expiresAt: defaultGrantExpiry() }, overrideAccess: true, depth: 0, req })
        return { doc: bound, operation: "updated" }
      }, "read")
      if (!renewed) throw new CustomerIdentityError("E_CUSTOMER_WORKSPACE_UNAVAILABLE")
      grant = renewed
    }
  }

  return { grant, payload, tenant, run, customerEmail, clientSlug }
}

/** Renewable grant lookup for an actual verified account, never an email hint. */
export async function loadVerifiedCustomerGrant(input: {
  payload: Payload
  email: string
  authority: CustomerAuthority
  clientSlug?: string
}): Promise<PreviewGrantAuthority | null> {
  if (input.clientSlug) return loadPreviewGrantAuthority({ email: input.email, clientSlug: input.clientSlug,
    customerAuthority: input.authority, renewExpired: true })
  const account = await assertCustomerAccess(input.payload, input.authority, { intent: "read" })
  const tenantId = relationshipId(account.tenant)
  const results = await input.payload.find({ collection: "preview-access-grants",
    where: { and: [{ customerEmail: { equals: account.email } }, ...(tenantId ? [{ tenant: { equals: tenantId } }] : [])] },
    sort: "-updatedAt", limit: 101, depth: 0, overrideAccess: true })
  if (results.totalDocs > 100) throw new CustomerIdentityError("E_CUSTOMER_WORKSPACE_CONFLICT")
  const grant = results.docs.find(entry => !entry.revokedAt)
  if (!grant) {
    if (results.docs.length) throw new CustomerIdentityError("E_CUSTOMER_WORKSPACE_UNAVAILABLE")
    return null
  }
  return loadPreviewGrantAuthority({ email: account.email, clientSlug: grant.clientSlug,
    customerAuthority: input.authority, renewExpired: true })
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
    : run.tenant != null
      ? await payload.findByID({
          collection: "tenants",
          id: run.tenant,
          depth: 0,
          overrideAccess: true,
        }) as Tenant
      : null
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
  const pageIds = payloadRelationIds(run.pages)
  const now = new Date().toISOString()
  const current = existing.docs[0] as PreviewAccessGrant | undefined
  if (current) {
    await payload.update({
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
      },
      overrideAccess: true,
      depth: 0,
    })
    return await payload.findByID({
      collection: "preview-access-grants",
      id: current.id,
      depth: 0,
      overrideAccess: true,
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
    },
    overrideAccess: true,
    depth: 0,
  }) as PreviewAccessGrant
}
