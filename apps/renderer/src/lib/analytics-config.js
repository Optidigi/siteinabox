import { matchesApprovedPublicAnalyticsConsent } from "@siteinabox/legal-content/consent-approval"

/** @param {unknown} value
 * @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** @param {unknown} value */
function stringValue(value) {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

/** @param {unknown} value
 * @param {boolean} [fallback] */
function booleanValue(value, fallback = true) {
  return typeof value === "boolean" ? value : fallback
}

/** @param {...unknown} values */
function firstString(...values) {
  for (const value of values) {
    const next = stringValue(value)
    if (next) return next
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return null
}

/** @param {{snapshot: unknown, page: unknown, pathname: string}} input */
export function buildAnalyticsConfig({ snapshot: rawSnapshot, page: rawPage, pathname }) {
  const snapshot = isRecord(rawSnapshot) ? rawSnapshot : {}
  const page = isRecord(rawPage) ? rawPage : {}
  const settings = isRecord(snapshot.settings) ? snapshot.settings : {}
  const theme = isRecord(snapshot.theme) ? snapshot.theme : {}
  const manifest = isRecord(snapshot.manifest) ? snapshot.manifest : {}
  const analytics = settings.analytics
  if (!isRecord(analytics)) return null
  if (analytics.enabled === false) return null

  const consent = isRecord(settings.analyticsConsent) ? settings.analyticsConsent : null
  if (!consent || !matchesApprovedPublicAnalyticsConsent(consent)) return null
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
    tenantName: firstString(analytics.tenantName, snapshot.tenantName, settings.siteName),
    siteKind: firstString(analytics.siteKind) ?? (firstString(pageAnalytics?.tenantId, analytics.tenantId, snapshot.tenantId) ? "tenant" : "platform"),
    siteId: firstString(pageAnalytics?.siteId, analytics.siteId, snapshot.tenantId),
    siteDomain: firstString(pageAnalytics?.siteDomain, analytics.siteDomain, snapshot.domain),
    pageId: firstString(pageAnalytics?.pageId, analytics.pageId, page?.id),
    pageSlug: firstString(pageAnalytics?.pageSlug, analytics.pageSlug, page?.slug),
    pagePath: firstString(pageAnalytics?.pagePath, analytics.pagePath, pathname),
    themeId: firstString(pageAnalytics?.themeId, analytics.themeId, theme.id),
    siteBuildId: firstString(pageAnalytics?.siteBuildId, analytics.siteBuildId, snapshot.siteBuildId),
    manifestVersion: firstString(pageAnalytics?.manifestVersion, analytics.manifestVersion, manifest.version),
    conversionGoals: isRecord(analytics.conversionGoals)
      ? analytics.conversionGoals
      : {
          acceptedForms: true,
          contactClicks: [],
        },
  }
}

/** @param {ReturnType<typeof buildAnalyticsConfig>} config */
export function analyticsConfigJson(config) {
  if (!config) return null
  return JSON.stringify(config).replace(/</g, "\\u003c")
}
