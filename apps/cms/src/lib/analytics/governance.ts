import { CMS_EVENT_NAMES, PUBLIC_SITE_EVENT_NAMES, type CmsEventName, type PublicSiteEventName } from "./events"

export const ANALYTICS_RETENTION_MONTHS = 13 as const

type AnalyticsPurpose = "service_improvement" | "operational_conversion" | "site_performance"
type AnalyticsLegalBasis = "legitimate_interest" | "consent"

export type AnalyticsPurposePolicy = {
  purpose: AnalyticsPurpose
  legalBasis: AnalyticsLegalBasis
  consentCategory: "analytics" | null
  retentionMonths: typeof ANALYTICS_RETENTION_MONTHS
  permitsDirectIdentifiers: false
}

const policy = (
  purpose: AnalyticsPurpose,
  legalBasis: AnalyticsLegalBasis,
): AnalyticsPurposePolicy => ({
  purpose,
  legalBasis,
  consentCategory: legalBasis === "consent" ? "analytics" : null,
  retentionMonths: ANALYTICS_RETENTION_MONTHS,
  permitsDirectIdentifiers: false,
})

export const CMS_ANALYTICS_POLICY: Record<CmsEventName, AnalyticsPurposePolicy> = Object.fromEntries(
  CMS_EVENT_NAMES.map((event) => [event, policy("service_improvement", "legitimate_interest")]),
) as Record<CmsEventName, AnalyticsPurposePolicy>

export const PUBLIC_BROWSER_ANALYTICS_POLICY: Record<PublicSiteEventName, AnalyticsPurposePolicy> = Object.fromEntries(
  PUBLIC_SITE_EVENT_NAMES.map((event) => [
    event,
    policy(event === "$web_vitals" ? "site_performance" : "service_improvement", "consent"),
  ]),
) as Record<PublicSiteEventName, AnalyticsPurposePolicy>

export const PUBLIC_SERVER_ANALYTICS_POLICY = {
  site_form_accepted: policy("operational_conversion", "legitimate_interest"),
  site_conversion_completed: policy("operational_conversion", "legitimate_interest"),
} as const satisfies Partial<Record<PublicSiteEventName, AnalyticsPurposePolicy>>

export const serverAnalyticsPolicyFor = (event: CmsEventName | PublicSiteEventName): AnalyticsPurposePolicy | null =>
  event.startsWith("cms_")
    ? CMS_ANALYTICS_POLICY[event as CmsEventName]
    : PUBLIC_SERVER_ANALYTICS_POLICY[event as keyof typeof PUBLIC_SERVER_ANALYTICS_POLICY] ?? null
