import "server-only"
import { headers } from "next/headers"
import { analyticsEnvironment } from "./config"
import { captureAnalyticsEvent, identifyPostHogTenantGroup } from "./posthogClient"
import type { AnalyticsBaseProperties, AnalyticsEventProperties, CmsEventName } from "./events"
import { tenantAnalyticsProperties, type AnalyticsTenantIdentity } from "./identity"
import type { SiabContext } from "@/lib/context"
import type { User } from "@/payload-types"

const requestHost = async (): Promise<string | null> => {
  const requestHeaders = await headers()
  const raw = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host")
  if (!raw) return null
  const host = raw.split(",", 1)[0]?.trim().toLowerCase().replace(/:\d+$/, "")
  return host || null
}

export const captureCmsUsageEvent = async ({
  event,
  user,
  ctx,
  surface,
  action,
  properties,
  managedTenant,
}: {
  event: CmsEventName
  user: User
  ctx: SiabContext
  surface: string
  action?: string
  properties?: AnalyticsEventProperties
  managedTenant?: AnalyticsTenantIdentity | null
}): Promise<void> => {
  const contextTenant = ctx.mode === "tenant" ? ctx.tenant : managedTenant
  const tenantIdentity = tenantAnalyticsProperties(contextTenant)
  const base: AnalyticsBaseProperties = {
    schema_version: 1,
    analytics_surface: "cms",
    site_kind: contextTenant ? "tenant" : "platform",
    environment: analyticsEnvironment(),
    admin_host: await requestHost(),
    tenant_id: tenantIdentity.tenant_id ?? null,
    tenant_slug: tenantIdentity.tenant_slug ?? null,
    tenant_name: tenantIdentity.tenant_name ?? null,
    site_id: tenantIdentity.site_id ?? null,
    site_domain: tenantIdentity.site_domain ?? null,
    page_id: null,
    page_slug: null,
    page_path: null,
    theme_id: null,
    site_build_id: null,
    manifest_version: null,
  }

  try {
    if (contextTenant) {
      await identifyPostHogTenantGroup({
        id: String(contextTenant.id),
        name: contextTenant.name,
        slug: contextTenant.slug,
        domain: contextTenant.domain,
      })
    }
    await captureAnalyticsEvent({
      event,
      distinctId: `cms:${user.id}`,
      properties: {
        ...properties,
        ...tenantIdentity,
        ...base,
        cms_surface: surface,
        ...(action ? { cms_action: action } : {}),
        cms_mode: ctx.mode,
        cms_tenant_context: ctx.mode === "tenant" ? "host" : managedTenant ? "managed" : "none",
        user_role: user.role,
      },
    })
  } catch (err) {
    console.warn("[analytics] CMS usage capture failed", err)
  }
}
