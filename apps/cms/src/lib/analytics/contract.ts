import type { SiabAnalyticsEventName } from "./events"

export type AnalyticsEventContractEntry = {
  event: SiabAnalyticsEventName
  source: "posthog-js-native" | "siab-browser-runtime" | "siab-server"
  consentRequired: boolean
  cmsConsentRequired?: boolean
  canonicalUse: string
  duplicatePrevention: string
  queryConsumers: string[]
}

export const ANALYTICS_EVENT_CONTRACT: AnalyticsEventContractEntry[] = [
  {
    event: "$pageview",
    source: "posthog-js-native",
    consentRequired: false,
    cmsConsentRequired: false,
    canonicalUse: "PostHog-native web analytics page views. Public sites permit a minimized cookieless baseline; accepted consent enables the richer tier.",
    duplicatePrevention: "PostHog JS is the sole lifecycle owner; the tier transition does not manually emit $pageview.",
    queryConsumers: ["PostHog web analytics", "getEventVolume"],
  },
  {
    event: "$pageleave",
    source: "posthog-js-native",
    consentRequired: true,
    cmsConsentRequired: false,
    canonicalUse: "PostHog-native consented page leave/session-duration and native scroll-depth signal.",
    duplicatePrevention: "SIAB does not manually emit $pageleave and keeps SDK scroll properties enabled.",
    queryConsumers: ["PostHog web analytics", "getScrollDepth", "getEventVolume"],
  },
  {
    event: "$web_vitals",
    source: "posthog-js-native",
    consentRequired: false,
    cmsConsentRequired: false,
    canonicalUse: "Native minimized cookieless or consented PostHog Web Vitals for field performance scoring.",
    duplicatePrevention: "SIAB does not manually emit Web Vitals; before_send only enriches native PostHog events.",
    queryConsumers: ["getWebVitals", "getDashboardHighlights", "getEventVolume"],
  },
  {
    event: "$autocapture",
    source: "posthog-js-native",
    consentRequired: true,
    cmsConsentRequired: false,
    canonicalUse: "Canonical browser interaction stream for clicks, submits, and form changes.",
    duplicatePrevention: "SIAB semantic click events are limited to journey/conversion/section context; component click counts use enriched autocapture only.",
    queryConsumers: ["getTopCtas", "getComponentPerformance", "getComponentExposure", "getAutocaptureInteractions", "getEventVolume"],
  },
  {
    event: "$rageclick",
    source: "posthog-js-native",
    consentRequired: true,
    cmsConsentRequired: false,
    canonicalUse: "Native friction signal enriched with SIAB page/section metadata.",
    duplicatePrevention: "No custom rage-click event is emitted.",
    queryConsumers: ["getAutocaptureFriction", "getEventVolume"],
  },
  {
    event: "$dead_click",
    source: "posthog-js-native",
    consentRequired: true,
    cmsConsentRequired: false,
    canonicalUse: "Native friction signal enriched with SIAB page/section metadata.",
    duplicatePrevention: "No custom dead-click event is emitted.",
    queryConsumers: ["getAutocaptureFriction", "getEventVolume"],
  },
  {
    event: "site_section_viewed",
    source: "siab-browser-runtime",
    consentRequired: true,
    canonicalUse: "Section exposure after visibility threshold.",
    duplicatePrevention: "WeakSet guards one viewed event per section element per page load.",
    queryConsumers: ["getSectionPerformance", "getEventVolume"],
  },
  {
    event: "site_section_engaged",
    source: "siab-browser-runtime",
    consentRequired: true,
    canonicalUse: "Section engagement after dwell or interaction.",
    duplicatePrevention: "WeakSet guards one engagement event per section element per page load.",
    queryConsumers: ["getSectionPerformance", "getEventVolume"],
  },
  {
    event: "site_component_viewed",
    source: "siab-browser-runtime",
    consentRequired: true,
    canonicalUse: "CTA/nav/button exposure before interaction-rate analysis.",
    duplicatePrevention: "WeakSet guards one viewed event per action element per page load.",
    queryConsumers: ["getComponentExposure", "getEventVolume"],
  },
  {
    event: "site_scroll_depth_reached",
    source: "siab-browser-runtime",
    consentRequired: true,
    canonicalUse: "SIAB threshold milestone event retained for journey/context analysis; native PostHog scroll-depth health uses $pageleave properties.",
    duplicatePrevention: "Each threshold is captured once per page load; CMS scroll-depth buckets use native $pageleave properties to avoid diverging from PostHog health.",
    queryConsumers: ["getEventVolume"],
  },
  {
    event: "site_journey_step",
    source: "siab-browser-runtime",
    consentRequired: true,
    canonicalUse: "Ordered client journey steps for high-level path analysis.",
    duplicatePrevention: "Journey index is local to the page session; it is not counted as a pageview or conversion.",
    queryConsumers: ["getJourneySteps", "getEventVolume"],
  },
  {
    event: "site_form_started",
    source: "siab-browser-runtime",
    consentRequired: true,
    canonicalUse: "Client-side form funnel start.",
    duplicatePrevention: "WeakSet guards one start event per form element per page load.",
    queryConsumers: ["getFormFunnel", "getEventVolume"],
  },
  {
    event: "site_form_submitted",
    source: "siab-browser-runtime",
    consentRequired: true,
    canonicalUse: "Client-side form submit attempt.",
    duplicatePrevention: "Accepted submissions are counted separately from the trusted server-side event.",
    queryConsumers: ["getFormFunnel", "getEventVolume"],
  },
  {
    event: "site_form_accepted",
    source: "siab-server",
    consentRequired: false,
    canonicalUse: "Trusted backend conversion when the CMS accepts a public form row.",
    duplicatePrevention: "Conversion dashboards count this accepted event rather than client submit success guesses.",
    queryConsumers: ["getSiteAnalyticsOverview", "getFormFunnel", "getTenantPerformance", "getEventVolume"],
  },
  {
    event: "site_conversion_completed",
    source: "siab-browser-runtime",
    consentRequired: true,
    canonicalUse: "Configured client-side conversion goals such as contact clicks.",
    duplicatePrevention: "Only configured target types emit conversion events; raw autocapture clicks remain interaction metrics.",
    queryConsumers: ["getSiteAnalyticsOverview", "getTopPages", "getTenantPerformance", "getEventVolume"],
  },
]

export const analyticsEventContractByName = new Map(
  ANALYTICS_EVENT_CONTRACT.map((entry) => [entry.event, entry]),
)
