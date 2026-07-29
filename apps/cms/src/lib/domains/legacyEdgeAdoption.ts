import {
  isLegacyRendererDomainAdoptionHost,
  normalizePublicDomainHost,
} from "@siteinabox/contracts"
import type { Payload, Where } from "payload"
import type { SiteSetting, Tenant } from "@/payload-types"
import { relationshipId } from "@/lib/relationshipId"

export type LegacyEdgeAdoption = {
  domain: string
  tenantId: string
  rendererApexReady: boolean
  rendererWwwReady: boolean
  cmsAdminReady: boolean
}

/**
 * Evaluates the temporary, explicit adoption bridge for sites that predate
 * managed-domain commerce records. Runtime routing and release inventory both
 * consume this result so the deployment gate cannot be weaker than routing.
 */
export async function resolveLegacyEdgeAdoption(
  payload: Payload,
  rawDomain: string,
): Promise<LegacyEdgeAdoption | null> {
  const domain = normalizePublicDomainHost(rawDomain)
  if (!domain || !isLegacyRendererDomainAdoptionHost(domain)) return null

  const tenants = await payload.find({
    collection: "tenants",
    where: { domain: { equals: domain } },
    limit: 2,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  if (tenants.docs.length !== 1) return null
  const tenant = tenants.docs[0] as Tenant
  const tenantId = String(tenant.id)
  if (
    normalizePublicDomainHost(tenant.domain) !== domain ||
    tenant.domainVerification?.status !== "verified" ||
    tenant.status === "archived"
  ) {
    return null
  }

  let activeSnapshot = false
  const activeSnapshotId = relationshipId(tenant.activeSnapshot)
  if (activeSnapshotId) {
    const snapshot = await payload.findByID({
      collection: "published-site-snapshots",
      id: activeSnapshotId,
      depth: 0,
      overrideAccess: true,
    })
    activeSnapshot =
      snapshot.status === "active" &&
      relationshipId(snapshot.tenant) === tenantId &&
      normalizePublicDomainHost(snapshot.domain) === domain
  }

  const wwwHost = `www.${domain}`
  const settings = await payload.find({
    collection: "site-settings",
    where: {
      "aliases.host": { equals: wwwHost },
    } as unknown as Where,
    limit: 2,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  const matchingSettings = (settings.docs as SiteSetting[]).filter((doc) =>
    (doc.aliases ?? []).some(
      (alias) => normalizePublicDomainHost(alias.host) === wwwHost,
    ))
  const aliasTenantIds = [...new Set(matchingSettings
    .map((doc) => relationshipId(doc.tenant))
    .filter((id): id is string => id !== null)
    .map(String))]
  const explicitWwwAliases = matchingSettings
    .flatMap((doc) => doc.aliases ?? [])
    .filter((alias) => normalizePublicDomainHost(alias.host) === wwwHost)
  const canonicalWwwOwners = await payload.find({
    collection: "tenants",
    where: { domain: { equals: wwwHost } },
    limit: 2,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  const explicitUniqueWww =
    canonicalWwwOwners.docs.length === 0 &&
    matchingSettings.length === 1 &&
    aliasTenantIds.length === 1 &&
    aliasTenantIds[0] === tenantId &&
    explicitWwwAliases.length === 1

  return {
    domain,
    tenantId,
    rendererApexReady: tenant.status === "active" && activeSnapshot,
    rendererWwwReady:
      tenant.status === "active" && activeSnapshot && explicitUniqueWww,
    cmsAdminReady:
      tenant.status === "active" || tenant.status === "suspended",
  }
}
