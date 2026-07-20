import "server-only"
import type { Payload } from "payload"
import type { Tenant } from "@/payload-types"
import { analyticsEnvironment } from "./config"
import { captureAnalyticsEvent, identifyPostHogTenantGroup } from "./posthogClient"
import type { AnalyticsBaseProperties } from "./events"
import { POSTHOG_TENANT_GROUP_TYPE, tenantAnalyticsProperties } from "./identity"

import { asRecord } from "@/lib/record"

const tenantIdOf = (doc: { tenant?: unknown }): string | null => {
  const tenant = doc?.tenant
  if (tenant == null) return null
  if (typeof tenant === "object" && tenant !== null && "id" in tenant) return String((tenant as { id: unknown }).id)
  return String(tenant)
}

const safePathFromUrl = (raw: unknown): string | null => {
  if (typeof raw !== "string" || raw.trim() === "") return null
  try {
    const parsed = new URL(raw, "https://example.invalid")
    return `${parsed.pathname}${parsed.hash}`
  } catch {
    return raw.startsWith("/") ? raw.split("?")[0] ?? raw : null
  }
}

export const captureAcceptedFormAnalytics = async (args: {
  doc: Record<string, unknown>
  payload: Payload
  logger?: { warn?: (input: unknown, message?: string) => void }
}): Promise<void> => {
  const tenantId = tenantIdOf(args.doc)
  if (!tenantId) return

  let tenant: Tenant | null = null
  try {
    tenant = await args.payload.findByID({
      collection: "tenants",
      id: tenantId,
      depth: 0,
      overrideAccess: true,
    })
  } catch {
    tenant = null
  }

  const base: AnalyticsBaseProperties = {
    schema_version: 1,
    analytics_surface: "site",
    site_kind: "tenant",
    environment: analyticsEnvironment(),
    admin_host: null,
    tenant_id: tenantId,
    tenant_slug: tenant?.slug ? String(tenant.slug) : null,
    tenant_name: tenant?.name ? String(tenant.name) : null,
    site_id: tenantId,
    site_domain: tenant?.domain ? String(tenant.domain) : null,
    page_id: null,
    page_slug: null,
    page_path: safePathFromUrl(args.doc?.pageUrl),
    theme_id: null,
    site_build_id: null,
    manifest_version: (() => {
      const manifest = asRecord(tenant?.siteManifest)
      const version = manifest?.version
      return typeof version === "string" || typeof version === "number" ? version : null
    })(),
  }

  const properties = {
    ...tenantAnalyticsProperties(tenant),
    $groups: { [POSTHOG_TENANT_GROUP_TYPE]: tenantId },
    ...base,
    conversion_source: "accepted_form",
  }

  try {
    await identifyPostHogTenantGroup({
      id: tenantId,
      name: tenant?.name ? String(tenant.name) : null,
      slug: tenant?.slug ? String(tenant.slug) : null,
      domain: tenant?.domain ? String(tenant.domain) : null,
    })
    await captureAnalyticsEvent({
      event: "site_form_accepted",
      distinctId: `site:${tenantId}:server-conversions`,
      properties,
    })
    await captureAnalyticsEvent({
      event: "site_conversion_completed",
      distinctId: `site:${tenantId}:server-conversions`,
      properties,
    })
  } catch (err) {
    args.logger?.warn?.({ err, tenantId, formId: args.doc?.id }, "[analytics] accepted form capture failed")
  }
}
