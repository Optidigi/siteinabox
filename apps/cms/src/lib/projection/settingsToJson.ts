import {
  settingsToJsonWithoutAnalytics,
  type SettingsProjectionContext as SettingsProjectionCoreContext,
} from "@/lib/projection/settingsToJsonCore"
import type { NavPage } from "@/lib/projection/resolveNav"
import { resolvePublicAnalyticsConfig, type PublicAnalyticsConfigInput } from "@/lib/analytics/config"

export type SettingsAnalyticsProjectionContext = {
  tenantId?: string | number | null
  tenantSlug?: string | null
  tenantName?: string | null
  siteDomain?: string | null
  themeId?: string | null
  siteBuildId?: string | null
  manifestVersion?: string | number | null
  analytics?: PublicAnalyticsConfigInput | null
  analyticsConsent?: Record<string, unknown> | null
}

export type SettingsProjectionContext = SettingsProjectionCoreContext & {
  analytics?: boolean
}

export { settingsToJsonWithoutAnalytics }

/**
 * Serialise a SiteSettings doc to its `site.json` shape.
 *
 * `publishedPages` is needed for nav resolution — `page` / `section` entries
 * resolve their href + label from the published page set. Callers fetch it
 * once and pass it in, keeping this function pure + unit-testable. An empty
 * array is valid: page/section entries simply resolve to nothing.
 */
export function settingsToJson(
  doc: any,
  publishedPages: NavPage[] = [],
  analyticsContext: SettingsAnalyticsProjectionContext = {},
  projectionContext: SettingsProjectionContext = {},
) {
  const projected = settingsToJsonWithoutAnalytics(doc, publishedPages, projectionContext)
  const includeAnalytics = projectionContext.analytics ?? true

  return {
    ...projected,
    analytics: includeAnalytics ? {
      ...resolvePublicAnalyticsConfig(analyticsContext.analytics),
      schemaVersion: 1,
      tenantId: analyticsContext.tenantId != null ? String(analyticsContext.tenantId) : null,
      tenantSlug: analyticsContext.tenantSlug ?? null,
      tenantName: analyticsContext.tenantName ?? null,
      siteKind: analyticsContext.tenantId != null ? "tenant" : "platform",
      siteId: analyticsContext.tenantId != null ? String(analyticsContext.tenantId) : null,
      siteDomain: analyticsContext.siteDomain ?? null,
      themeId: analyticsContext.themeId ?? null,
      siteBuildId: analyticsContext.siteBuildId ?? null,
      manifestVersion: analyticsContext.manifestVersion ?? null,
    } : undefined,
    analyticsConsent: includeAnalytics ? analyticsContext.analyticsConsent ?? undefined : undefined,
  }
}
