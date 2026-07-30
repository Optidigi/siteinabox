import {
  commerceReleaseStageSchema,
  evaluateCommerceReleaseGate,
  type CommerceReleaseGateDecision,
} from "@siteinabox/contracts/commerce"
import { productionTldCapabilitiesAt } from "@siteinabox/contracts/tld-capabilities"
import type { Payload } from "payload"
import type { Tenant } from "@/payload-types"
import { resolvePreCommerceRoutingAdoption } from "@/lib/domains/preCommerceRoutingAdoption"

const clean = (value: string | undefined): string | null => {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

const apiKeyMode = (
  value: string | null,
): "test" | "live" | "unknown" | "missing" => {
  if (!value) return "missing"
  if (value.startsWith("test_")) return "test"
  if (value.startsWith("live_")) return "live"
  return "unknown"
}

const validMigrationEncryptionKey = (value: string | undefined): boolean => {
  try {
    return Boolean(value?.trim()) &&
      Buffer.from(value!.trim(), "base64").byteLength === 32
  } catch {
    return false
  }
}

const cloudflareSourceOAuthConfigured = (
  env: NodeJS.ProcessEnv,
): boolean => {
  if (
    clean(env.COMMERCE_EXISTING_DOMAIN_MIGRATION_ENABLED) !== "1" ||
    clean(env.COMMERCE_MIGRATION_SOURCE_CLOUDFLARE_ENABLED) !== "1"
  ) {
    return true
  }
  return (
    clean(env.COMMERCE_MIGRATION_SOURCE_CLOUDFLARE_OAUTH_ENABLED) === "1" &&
    Boolean(clean(env.CLOUDFLARE_SOURCE_OAUTH_CLIENT_ID)) &&
    Boolean(clean(env.CLOUDFLARE_SOURCE_OAUTH_CLIENT_SECRET)) &&
    clean(env.CLOUDFLARE_SOURCE_OAUTH_REDIRECT_URI) ===
      "https://preview.siteinabox.nl/api/domain-migration-source/cloudflare/callback"
  )
}

const existingMigrationRouteBlockers = (
  env: NodeJS.ProcessEnv,
): string[] => {
  if (clean(env.COMMERCE_EXISTING_DOMAIN_MIGRATION_ENABLED) !== "1") return []
  const completeSourceEnabled =
    clean(env.COMMERCE_MIGRATION_SOURCE_CLOUDFLARE_ENABLED) === "1" ||
    clean(env.COMMERCE_MIGRATION_SOURCE_AXFR_ENABLED) === "1"
  return [
    ...(!completeSourceEnabled
      ? ["existing_domain_migration_has_no_complete_source"]
      : []),
    ...(productionTldCapabilitiesAt("incoming_transfer").length === 0
      ? ["existing_domain_migration_has_no_enabled_transfer_tld"]
      : []),
  ]
}

export function commerceReleaseGate(
  env: NodeJS.ProcessEnv = process.env,
): CommerceReleaseGateDecision {
  const stage = commerceReleaseStageSchema.catch("disabled").parse(
    clean(env.COMMERCE_RELEASE_STAGE),
  )
  return evaluateCommerceReleaseGate({
    stage,
    evidenceVersion: clean(env.COMMERCE_RELEASE_EVIDENCE_VERSION),
    providerWritesAcknowledged:
      clean(env.COMMERCE_PROVIDER_WRITES_ACKNOWLEDGED) === "1",
    nodeEnvironment: clean(env.NODE_ENV),
    mollieApiKeyMode: apiKeyMode(clean(env.MOLLIE_API_KEY)),
    openproviderApiBaseUrl:
      clean(env.OPENPROVIDER_API_BASE_URL) ??
      "https://api.openprovider.eu/v1beta",
    cloudflareApiBaseUrl:
      clean(env.CLOUDFLARE_API_BASE_URL) ??
      "https://api.cloudflare.com/client/v4",
    productionSecretsConfigured: Boolean(
      clean(env.OPENPROVIDER_USERNAME) &&
      clean(env.OPENPROVIDER_PASSWORD) &&
      clean(env.CLOUDFLARE_API_TOKEN) &&
      clean(env.CLOUDFLARE_ACCOUNT_ID) &&
      validMigrationEncryptionKey(env.DOMAIN_MIGRATION_ENCRYPTION_KEY),
    ),
    originIsolationVerified:
      clean(env.COMMERCE_ORIGIN_ISOLATION_VERIFIED) === "1",
  })
}

export async function commerceProductionReadinessBlockers(
  payload: Payload,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string[]> {
  const decision = commerceReleaseGate(env)
  const blockers = [...decision.blockers]
  blockers.push(...existingMigrationRouteBlockers(env))
  if (!cloudflareSourceOAuthConfigured(env)) {
    blockers.push("cloudflare_source_oauth_configuration_incomplete")
  }
  if (commerceReleaseStageSchema.catch("disabled").parse(
    clean(env.COMMERCE_RELEASE_STAGE),
  ) !== "production") {
    blockers.push("production_preflight_requires_production_stage")
  }
  const criticalAlerts = await payload.find({
    collection: "operational-alerts",
    where: {
      and: [
        { status: { equals: "open" } },
        { severity: { equals: "critical" } },
        { source: { in: ["payments", "domains"] } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (criticalAlerts.totalDocs > 0 || criticalAlerts.docs.length > 0) {
    blockers.push("production_has_open_critical_commerce_alerts")
  }
  blockers.push(...await commerceEdgeInventoryBlockers(payload, true))
  return [...new Set(blockers)]
}

export async function commerceEdgeInventoryBlockers(
  payload: Payload,
  requireActiveRouting = false,
): Promise<string[]> {
  const blockers: string[] = []
  const liveTenants = await payload.find({
    collection: "tenants",
    where: { status: { equals: "active" } },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  for (const tenant of liveTenants.docs as Tenant[]) {
    const domain = tenant.domain?.trim().toLowerCase().replace(/\.$/, "")
    if (!domain) {
      blockers.push("active_tenant_missing_canonical_domain")
      continue
    }
    const managedDomains = await payload.find({
      collection: "managed-domains",
      where: {
        and: [
          { tenant: { equals: tenant.id } },
          { domainNameAscii: { equals: domain } },
          { state: { equals: "active" } },
          { cloudflareZoneId: { exists: true } },
          ...(requireActiveRouting
            ? [
                { edgeRoutingStatus: { equals: "active" } },
                { adminHttpsStatus: { equals: "verified" } },
                { httpsStatus: { equals: "verified" } },
              ]
            : []),
        ],
      },
      limit: 2,
      depth: 0,
      overrideAccess: true,
    })
    if (managedDomains.docs.length !== 1) {
      const anyManagedDomain = await payload.find({
        collection: "managed-domains",
        where: { domainNameAscii: { equals: domain } },
        limit: 2,
        pagination: false,
        depth: 0,
        overrideAccess: true,
      })
      const adoption = anyManagedDomain.docs.length === 0
        ? await resolvePreCommerceRoutingAdoption(payload, domain)
        : null
      const auditedPreCommerceAdoption =
        adoption?.tenantId === String(tenant.id) &&
        adoption.rendererApexReady &&
        adoption.rendererWwwReady &&
        adoption.cmsAdminReady
      if (auditedPreCommerceAdoption) continue
      blockers.push(
        requireActiveRouting
          ? `active_tenant_edge_routing_unready:${tenant.id}`
          : `active_tenant_managed_domain_inventory_invalid:${tenant.id}`,
      )
    }
  }
  return blockers
}

export function commerceProviderReadsAllowed(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return commerceReleaseGate(env).providerReadsAllowed
}

export function commerceProviderWritesAllowed(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return commerceReleaseGate(env).providerWritesAllowed
}

/**
 * Narrow bootstrap gate for the one operation that establishes the
 * Cloudflare-to-origin path whose live proof is required by the global
 * production gate. It accepts only the origin-isolation blocker; every other
 * production prerequisite and the explicit write acknowledgement must pass.
 */
export function commerceEdgeBootstrapWritesAllowed(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (clean(env.COMMERCE_RELEASE_STAGE) !== "production") return false
  const blockers = commerceReleaseGate(env).blockers
  return blockers.length === 1 &&
    blockers[0] === "production_origin_isolation_not_verified"
}

export async function commerceEdgeBootstrapBlockers(
  payload: Payload,
): Promise<string[]> {
  const blockers = await commerceEdgeInventoryBlockers(payload, false)
  const criticalAlerts = await payload.find({
    collection: "operational-alerts",
    where: {
      and: [
        { status: { equals: "open" } },
        { severity: { equals: "critical" } },
        { source: { in: ["payments", "domains"] } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (criticalAlerts.totalDocs > 0 || criticalAlerts.docs.length > 0) {
    blockers.push("edge_bootstrap_has_open_critical_commerce_alerts")
  }
  return [...new Set(blockers)]
}

export function requireCommerceProviderWritesAllowed(
  operation: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const decision = commerceReleaseGate(env)
  if (decision.providerWritesAllowed) return
  throw new Error(
    `${operation} is blocked by the staged commerce release gate (${decision.blockers.join(", ")}).`,
  )
}
