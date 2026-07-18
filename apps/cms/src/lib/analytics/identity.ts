import type { Tenant } from "@/payload-types"
import type { AnalyticsEventProperties } from "./events"

export const POSTHOG_TENANT_GROUP_TYPE = "tenant" as const

export type AnalyticsTenantIdentity = Pick<Tenant, "id" | "name" | "slug" | "domain">

export const tenantAnalyticsProperties = (
  tenant: AnalyticsTenantIdentity | null | undefined,
): AnalyticsEventProperties => {
  if (!tenant) {
    return {
      site_kind: "platform",
      tenant_id: null,
      tenant_slug: null,
      tenant_name: null,
      site_id: null,
      site_domain: null,
    }
  }

  const tenantId = String(tenant.id)
  return {
    site_kind: "tenant",
    tenant_id: tenantId,
    tenant_slug: String(tenant.slug || "") || null,
    tenant_name: String(tenant.name || "") || null,
    site_id: tenantId,
    site_domain: String(tenant.domain || "") || null,
    $groups: { [POSTHOG_TENANT_GROUP_TYPE]: tenantId },
  }
}
