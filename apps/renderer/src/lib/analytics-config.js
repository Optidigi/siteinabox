import { matchesApprovedPublicAnalyticsConsent } from "@siteinabox/legal-content/consent-approval"

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringValue(value) {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function booleanValue(value, fallback = true) {
  return typeof value === "boolean" ? value : fallback
}

function firstString(...values) {
  for (const value of values) {
    const next = stringValue(value)
    if (next) return next
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return null
}

export function buildAnalyticsConfig({ snapshot, page, pathname }) {
  const analytics = snapshot?.settings?.analytics
  if (!isRecord(analytics)) return null

  const consent = isRecord(snapshot?.settings?.analyticsConsent) ? snapshot.settings.analyticsConsent : null
  if (!matchesApprovedPublicAnalyticsConsent(consent)) return null
  const pageAnalytics = isRecord(page?.analytics) ? page.analytics : null
  const provider = firstString(analytics.provider, consent?.provider) ?? "posthog"
  if (provider !== "posthog") return null
  const posthogProjectToken = firstString(
    analytics.posthogProjectToken,
    analytics.projectToken,
    analytics.token,
    analytics.publicKey,
  )
  const posthogHost = firstString(analytics.posthogHost, analytics.apiHost, analytics.host)
  if (!posthogProjectToken || !posthogHost) return null

  return {
    enabled: booleanValue(analytics.enabled, true),
    provider: "posthog",
    consentMode: "required",
    consentStorageKey: stringValue(consent.consentStorageKey),
    consentVersion: stringValue(consent.consentVersion),
    posthogHost,
    posthogUiHost: firstString(analytics.posthogUiHost, analytics.uiHost),
    posthogProjectToken,
    schemaVersion: 1,
    tenantId: firstString(pageAnalytics?.tenantId, analytics.tenantId, snapshot.tenantId),
    tenantSlug: firstString(pageAnalytics?.tenantSlug, analytics.tenantSlug, snapshot.tenantSlug),
    siteId: firstString(pageAnalytics?.siteId, analytics.siteId, snapshot.tenantId),
    siteDomain: firstString(pageAnalytics?.siteDomain, analytics.siteDomain, snapshot.domain),
    pageId: firstString(pageAnalytics?.pageId, analytics.pageId, page?.id),
    pageSlug: firstString(pageAnalytics?.pageSlug, analytics.pageSlug, page?.slug),
    pagePath: firstString(pageAnalytics?.pagePath, analytics.pagePath, pathname),
    themeId: firstString(pageAnalytics?.themeId, analytics.themeId, snapshot.theme?.id),
    siteBuildId: firstString(pageAnalytics?.siteBuildId, analytics.siteBuildId, snapshot.siteBuildId),
    manifestVersion: firstString(pageAnalytics?.manifestVersion, analytics.manifestVersion, snapshot.manifest?.version),
    conversionGoals: isRecord(analytics.conversionGoals)
      ? analytics.conversionGoals
      : {
          acceptedForms: true,
          contactClicks: [],
        },
  }
}

export function analyticsConfigJson(config) {
  if (!config) return null
  return JSON.stringify(config).replace(/</g, "\\u003c")
}
