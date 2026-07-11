import "server-only"
import { analyticsEnvironment } from "./config"
import { captureAnalyticsEvent } from "./posthogClient"
import type { AnalyticsBaseProperties } from "./events"

const tenantIdOf = (doc: any): string | null => {
  const tenant = doc?.tenant
  if (tenant == null) return null
  if (typeof tenant === "object") return String(tenant.id)
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
  doc: any
  payload: any
  logger?: { warn?: (input: unknown, message?: string) => void }
}): Promise<void> => {
  const tenantId = tenantIdOf(args.doc)
  if (!tenantId) return

  let tenant: any = null
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
    environment: analyticsEnvironment(),
    admin_host: null,
    tenant_id: tenantId,
    tenant_slug: tenant?.slug ? String(tenant.slug) : null,
    site_id: tenantId,
    site_domain: tenant?.domain ? String(tenant.domain) : null,
    page_id: null,
    page_slug: null,
    page_path: safePathFromUrl(args.doc?.pageUrl),
    theme_id: null,
    site_build_id: null,
    manifest_version: typeof tenant?.siteManifest?.version !== "undefined" ? tenant.siteManifest.version : null,
  }

  const properties = {
    ...base,
    conversion_source: "accepted_form",
  }

  try {
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
