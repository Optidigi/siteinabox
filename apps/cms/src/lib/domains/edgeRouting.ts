import "server-only"

import type { Payload } from "payload"
import type { ManagedDomain, Order, Tenant } from "@/payload-types"
import {
  buildCloudflareEdgeDnsRecordRequests,
  assertCloudflareEdgeDnsRecordsReconciliable,
  CloudflareApiError,
  CloudflareDnsRecordConflictError,
  getCloudflareHostnameCertificate,
  reconcileOwnedCloudflareDnsRecord,
} from "@/lib/domains/cloudflare"
import {
  CloudflareTunnelApiError,
  CloudflareTunnelConfigurationError,
  reconcileCloudflareTunnel,
  type CloudflareTunnelReconciliation,
} from "@/lib/domains/cloudflareTunnels"
import { verifyHttpsEndpoint } from "@/lib/domains/verification"
import { commerceProviderWritesAllowed } from "@/lib/commerce/releaseGateCore"
import { resolveLegacyEdgeAdoption } from "@/lib/domains/legacyEdgeAdoption"
import { relationshipId } from "@/lib/relationshipId"

const MAX_MANAGED_TUNNEL_HOSTNAMES = 900

type EdgeRoutingDependencies = {
  providerWritesAllowed: () => boolean
  now: () => string
  reconcileTunnel: typeof reconcileCloudflareTunnel
  buildDnsRecords: typeof buildCloudflareEdgeDnsRecordRequests
  assertDnsRecordsReconciliable: typeof assertCloudflareEdgeDnsRecordsReconciliable
  reconcileDnsRecord: typeof reconcileOwnedCloudflareDnsRecord
  getHostnameCertificate: typeof getCloudflareHostnameCertificate
  verifyHttps: typeof verifyHttpsEndpoint
}

const defaultDependencies: EdgeRoutingDependencies = {
  providerWritesAllowed: commerceProviderWritesAllowed,
  now: () => new Date().toISOString(),
  reconcileTunnel: reconcileCloudflareTunnel,
  buildDnsRecords: buildCloudflareEdgeDnsRecordRequests,
  assertDnsRecordsReconciliable: assertCloudflareEdgeDnsRecordsReconciliable,
  reconcileDnsRecord: reconcileOwnedCloudflareDnsRecord,
  getHostnameCertificate: getCloudflareHostnameCertificate,
  verifyHttps: verifyHttpsEndpoint,
}

const stringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string =>
        typeof entry === "string" && entry.trim().length > 0)
    : []

const domainHosts = (domain: string) => ({
  apex: domain,
  www: `www.${domain}`,
  admin: `admin.${domain}`,
})

export type CommerceEdgeRoutingInventory = {
  managedDomains: ManagedDomain[]
  rendererHosts: string[]
  cmsHosts: string[]
  zoneDomains: string[]
}

export const managedDomainIsEdgeEligible = async (
  payload: Payload,
  domain: ManagedDomain,
): Promise<boolean> => {
  if (domain.custodyStatus === "transferred_out") return false
  if (["expired"].includes(domain.state)) return false
  if (domain.state === "active" || domain.state === "renewal_pending") return true
  const orderId = relationshipId(domain.originatingOrder)
  if (!orderId) return false
  const order = await payload.findByID({
    collection: "orders",
    id: orderId,
    depth: 0,
    overrideAccess: true,
  }) as Order
  return order.paymentStatus === "paid" &&
    ["fulfillment_pending", "fulfilled", "exception"].includes(order.state ?? "")
}

const uniqueSorted = (values: string[]): string[] =>
  [...new Set(values)].sort()

/**
 * One inventory authority for both Tunnel reconciliation and its read-only
 * production preflight. The legacy bridge is explicit and disappears as soon
 * as any managed-domain record owns the hostname.
 */
export async function resolveCommerceEdgeRoutingInventory(
  payload: Payload,
): Promise<CommerceEdgeRoutingInventory> {
  const candidates = await payload.find({
    collection: "managed-domains",
    where: {
      and: [
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
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  const managedDomains: ManagedDomain[] = []
  for (const domain of candidates.docs as ManagedDomain[]) {
    if (await managedDomainIsEdgeEligible(payload, domain)) {
      managedDomains.push(domain)
    }
  }

  const rendererHosts = managedDomains.flatMap((domain) => {
    const hosts = domainHosts(domain.domainNameAscii)
    return [hosts.apex, hosts.www]
  })
  const cmsHosts = managedDomains.map((domain) =>
    domainHosts(domain.domainNameAscii).admin)

  const activeTenants = await payload.find({
    collection: "tenants",
    where: { status: { equals: "active" } },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  const zoneDomains: string[] = []
  for (const tenant of activeTenants.docs as Tenant[]) {
    const domain = tenant.domain?.trim().toLowerCase().replace(/\.$/, "")
    if (!domain) continue
    zoneDomains.push(domain)
    const anyManagedDomain = await payload.find({
      collection: "managed-domains",
      where: { domainNameAscii: { equals: domain } },
      limit: 1,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })
    if (anyManagedDomain.docs.length > 0) continue
    const adoption = await resolveLegacyEdgeAdoption(payload, domain)
    if (!adoption || adoption.tenantId !== String(tenant.id)) continue
    if (adoption.rendererApexReady) rendererHosts.push(domain)
    if (adoption.rendererWwwReady) rendererHosts.push(`www.${domain}`)
    if (adoption.cmsAdminReady) cmsHosts.push(`admin.${domain}`)
  }

  return {
    managedDomains,
    rendererHosts: uniqueSorted(rendererHosts),
    cmsHosts: uniqueSorted(cmsHosts),
    zoneDomains: uniqueSorted(zoneDomains),
  }
}

const updateDomain = async (
  payload: Payload,
  domain: ManagedDomain,
  data: Record<string, unknown>,
): Promise<ManagedDomain> => payload.update({
  collection: "managed-domains",
  id: domain.id,
  data,
  depth: 0,
  overrideAccess: true,
  context: { managedDomainLifecycleMutation: true },
}) as Promise<ManagedDomain>

const tunnelEvidence = (result: CloudflareTunnelReconciliation) => ({
  id: result.tunnel.id,
  name: result.tunnel.name,
  status: result.tunnel.status,
  connected: result.connected,
  configurationVersion: result.configurationVersion,
  ingressCount: result.ingress.length,
})

const permanentEdgeFailure = (error: unknown): boolean =>
  error instanceof CloudflareTunnelConfigurationError ||
  (error instanceof CloudflareTunnelApiError && error.permanent) ||
  (error instanceof CloudflareApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 408 &&
    error.status !== 429)

export type EdgeRoutingReconciliationResult = {
  examined: number
  active: number
  pending: number
  failed: number
}

export async function reconcileCommerceEdgeRouting(
  payload: Payload,
  dependencyOverrides: Partial<EdgeRoutingDependencies> = {},
): Promise<EdgeRoutingReconciliationResult> {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides }
  if (!dependencies.providerWritesAllowed()) {
    throw new Error(
      "Commerce release stage does not allow Cloudflare edge provider writes.",
    )
  }
  const inventory = await resolveCommerceEdgeRoutingInventory(payload)
  const eligible = inventory.managedDomains
  const rendererHosts = inventory.rendererHosts
  const cmsHosts = inventory.cmsHosts
  if (rendererHosts.length + cmsHosts.length > MAX_MANAGED_TUNNEL_HOSTNAMES) {
    const checkedAt = dependencies.now()
    for (const domain of eligible) {
      await updateDomain(payload, domain, {
        edgeRoutingStatus: "failed",
        edgeRoutingCheckedAt: checkedAt,
        edgeRoutingEvidence: {
          checkedAt,
          error: "cloudflare_tunnel_capacity_exhausted",
        },
        reconciliationRequired: true,
      })
    }
    return {
      examined: eligible.length,
      active: 0,
      pending: 0,
      failed: eligible.length,
    }
  }

  let rendererTunnel: CloudflareTunnelReconciliation
  let cmsTunnel: CloudflareTunnelReconciliation
  try {
    [rendererTunnel, cmsTunnel] = await Promise.all([
      dependencies.reconcileTunnel("renderer", rendererHosts),
      dependencies.reconcileTunnel("cms", cmsHosts),
    ])
  } catch (error) {
    const checkedAt = dependencies.now()
    const failed = permanentEdgeFailure(error)
    for (const domain of eligible) {
      await updateDomain(payload, domain, {
        edgeRoutingStatus: failed ? "failed" : "pending",
        edgeRoutingCheckedAt: checkedAt,
        edgeRoutingEvidence: {
          checkedAt,
          error: error instanceof Error ? error.name : "unknown_error",
        },
        reconciliationRequired: true,
      })
    }
    return {
      examined: eligible.length,
      active: 0,
      pending: failed ? 0 : eligible.length,
      failed: failed ? eligible.length : 0,
    }
  }
  const tunnelsConnected = rendererTunnel.connected && cmsTunnel.connected
  const result: EdgeRoutingReconciliationResult = {
    examined: eligible.length,
    active: 0,
    pending: 0,
    failed: 0,
  }

  if (!tunnelsConnected) {
    const checkedAt = dependencies.now()
    for (const domain of eligible) {
      await updateDomain(payload, domain, {
        edgeRoutingStatus: "pending",
        edgeRoutingCheckedAt: checkedAt,
        edgeRoutingEvidence: {
          checkedAt,
          rendererTunnel: tunnelEvidence(rendererTunnel),
          cmsTunnel: tunnelEvidence(cmsTunnel),
          error: "cloudflare_tunnel_disconnected",
        },
        reconciliationRequired: true,
      })
    }
    return {
      examined: eligible.length,
      active: 0,
      pending: eligible.length,
      failed: 0,
    }
  }

  for (const originalDomain of eligible) {
    let domain = originalDomain
    const checkedAt = dependencies.now()
    const zoneId = domain.cloudflareZoneId?.trim()
    if (!zoneId) continue
    const desiredRecords = dependencies.buildDnsRecords(domain.domainNameAscii)
    const ownedIds = stringArray(domain.cloudflareDnsRecordIds)
    try {
      await dependencies.assertDnsRecordsReconciliable(
        zoneId,
        desiredRecords,
        ownedIds,
      )
      const records = []
      for (const desired of desiredRecords) {
        records.push(await dependencies.reconcileDnsRecord(
          zoneId,
          desired,
          ownedIds,
        ))
      }
      const hosts = domainHosts(domain.domainNameAscii)
      const [apexCertificate, wwwCertificate, adminCertificate] = await Promise.all([
        dependencies.getHostnameCertificate(zoneId, hosts.apex),
        dependencies.getHostnameCertificate(zoneId, hosts.www),
        dependencies.getHostnameCertificate(zoneId, hosts.admin),
      ])
      const certificatesReady =
        apexCertificate.covered &&
        wwwCertificate.covered &&
        adminCertificate.covered
      const [apexHttps, wwwHttps, adminHttps] =
        tunnelsConnected && certificatesReady
          ? await Promise.all([
              dependencies.verifyHttps(hosts.apex, {
                service: "renderer",
                expectedDomain: domain.domainNameAscii,
              }),
              dependencies.verifyHttps(hosts.www, {
                service: "renderer",
                expectedDomain: domain.domainNameAscii,
              }),
              dependencies.verifyHttps(hosts.admin, {
                service: "cms",
                expectedDomain: domain.domainNameAscii,
              }),
            ])
          : [
              {
                status: "pending" as const,
                httpStatus: null,
                reason: "edge_tunnel_or_certificate_pending",
              },
              {
                status: "pending" as const,
                httpStatus: null,
                reason: "edge_tunnel_or_certificate_pending",
              },
              {
                status: "pending" as const,
                httpStatus: null,
                reason: "edge_tunnel_or_certificate_pending",
              },
            ]
      const publicHttpsReady =
        apexHttps.status === "verified" &&
        wwwHttps.status === "verified"
      const adminHttpsReady = adminHttps.status === "verified"
      const edgeActive = tunnelsConnected &&
        certificatesReady &&
        publicHttpsReady &&
        adminHttpsReady
      domain = await updateDomain(payload, domain, {
        cloudflareDnsRecordIds: [...new Set([
          ...ownedIds,
          ...records
            .filter((record) =>
              record.ownershipDisposition !== "unowned_reused")
            .map((record) => record.id)
            .filter((id): id is string => typeof id === "string"),
        ])],
        edgeRoutingStatus: edgeActive ? "active" : "configured",
        edgeRoutingCheckedAt: checkedAt,
        edgeRoutingEvidence: {
          checkedAt,
          rendererTunnel: tunnelEvidence(rendererTunnel),
          cmsTunnel: tunnelEvidence(cmsTunnel),
          records: records.map((record) => ({
            id: record.id,
            name: record.name,
            type: record.type,
            content: record.content,
            proxied: record.proxied,
          })),
          certificates: {
            apex: {
              covered: apexCertificate.covered,
              statuses: apexCertificate.certificateStatuses,
            },
            www: {
              covered: wwwCertificate.covered,
              statuses: wwwCertificate.certificateStatuses,
            },
            admin: {
              covered: adminCertificate.covered,
              statuses: adminCertificate.certificateStatuses,
            },
          },
          probes: { apex: apexHttps, www: wwwHttps, admin: adminHttps },
        },
        httpsStatus: publicHttpsReady ? "verified" : "pending",
        httpsCheckedAt: checkedAt,
        httpsEvidence: { apex: apexHttps, www: wwwHttps },
        adminHttpsStatus: adminHttpsReady ? "verified" : "pending",
        adminHttpsCheckedAt: checkedAt,
        adminHttpsEvidence: { admin: adminHttps },
        reconciliationRequired: !edgeActive,
      })
      if (edgeActive) result.active += 1
      else result.pending += 1
    } catch (error) {
      const conflict =
        error instanceof CloudflareDnsRecordConflictError ||
        permanentEdgeFailure(error)
      await updateDomain(payload, domain, {
        edgeRoutingStatus: conflict ? "failed" : "pending",
        edgeRoutingCheckedAt: checkedAt,
        edgeRoutingEvidence: {
          checkedAt,
          error: error instanceof Error ? error.name : "unknown_error",
        },
        reconciliationRequired: true,
      })
      if (conflict) result.failed += 1
      else result.pending += 1
    }
  }
  return result
}
