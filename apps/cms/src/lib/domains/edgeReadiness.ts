import "server-only"

import { normalizePublicDomainHost } from "@siteinabox/contracts/renderer-routing"
import type { Payload } from "payload"
import type { ManagedDomain, Tenant } from "@/payload-types"
import { managedDomainIsEdgeEligible } from "@/lib/domains/edgeRouting"
import { relationshipId } from "@/lib/relationshipId"

export type EdgeReadinessIdentity = {
  domain: string
  tenantId: string
}

export function canonicalEdgeRequestHost(headers: Pick<Headers, "get">): string | null {
  const host = normalizePublicDomainHost(headers.get("host"))
  const forwardedHeader = headers.get("x-forwarded-host")
  const forwarded = forwardedHeader
    ? normalizePublicDomainHost(forwardedHeader)
    : host
  return host && forwarded === host ? host : null
}

export async function resolveManagedDomainEdgeIdentity(
  payload: Payload,
  rawHost: string | null,
  surface: "renderer" | "cms",
): Promise<EdgeReadinessIdentity | null> {
  const host = normalizePublicDomainHost(rawHost)
  if (!host) return null
  const domain = surface === "cms"
    ? host.startsWith("admin.") ? host.slice("admin.".length) : ""
    : host.startsWith("www.") ? host.slice("www.".length) : host
  if (
    !domain ||
    host !== (surface === "cms" ? `admin.${domain}` : host.startsWith("www.") ? `www.${domain}` : domain)
  ) {
    return null
  }

  const domains = await payload.find({
    collection: "managed-domains",
    where: {
      and: [
        { domainNameAscii: { equals: domain } },
        { cloudflareZoneId: { exists: true } },
        { custodyStatus: { not_in: ["transferred_out"] } },
        {
          state: {
            in: [
              "registration_pending",
              "transfer_pending",
              "active",
              "renewal_pending",
              "provider_hold",
            ],
          },
        },
      ],
    },
    limit: 2,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  if (domains.docs.length !== 1) return null
  const managedDomain = domains.docs[0] as ManagedDomain
  if (normalizePublicDomainHost(managedDomain.domainNameAscii) !== domain) return null
  if (!(await managedDomainIsEdgeEligible(payload, managedDomain))) return null

  const tenantId = relationshipId(managedDomain.tenant)
  if (!tenantId) return null
  const tenant = await payload.findByID({
    collection: "tenants",
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  }) as Tenant
  if (
    tenant.status === "suspended" ||
    tenant.status === "archived"
  ) {
    return null
  }
  return { domain, tenantId: String(tenant.id) }
}
