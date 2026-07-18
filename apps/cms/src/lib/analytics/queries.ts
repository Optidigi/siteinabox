import "server-only"
import { getPostHogAnalyticsConfig } from "./config"
import { queryPostHog } from "./posthogClient"
import { WEB_VITAL_NAMES, combineSiteScore, getSiteQualityScore, webVitalRating, webVitalScore } from "./scoring"

export type AnalyticsQueryScope = {
  tenantId?: string | number | null
  days?: 7 | 30 | 90 | number
}

export type SiteAnalyticsOverview = {
  available: boolean
  visitors: number
  pageviews: number
  conversions: number
  conversionRate: number
  ctaClicks: number
  acceptedForms: number
}

export type TrafficSeriesPoint = {
  date: string
  pageviews: number
  visitors: number
}

export type TopPageMetric = {
  pagePath: string
  pageSlug: string | null
  pageviews: number
  visitors: number
  conversions: number
  conversionRate: number
}

export type TopCtaMetric = {
  label: string | null
  role: string | null
  targetType: string | null
  clicks: number
}

export type SectionPerformanceMetric = {
  sectionId: string | null
  sectionType: string | null
  providerVariant: string | null
  pagePath: string | null
  views: number
  engagements: number
  ctaClicks: number
}

export type FormFunnelMetric = {
  started: number
  submitted: number
  accepted: number
  submitRate: number
  acceptanceRate: number
}

export type TrafficSourceMetric = {
  source: string
  sourceType: string | null
  pageviews: number
  visitors: number
}

export type DeviceMetric = {
  deviceType: string
  pageviews: number
  visitors: number
}

export type ComponentPerformanceMetric = {
  componentType: string | null
  componentRole: string | null
  sectionType: string | null
  interactions: number
  visitors: number
}

export type ComponentExposureMetric = {
  actionKey: string | null
  label: string | null
  role: string | null
  sectionType: string | null
  views: number
  interactions: number
  visitors: number
  interactionRate: number
  avgVisibleMsBeforeInteraction: number
  avgHoverMsBeforeInteraction: number
  avgTimeToInteractionMs: number
}

export type JourneyStepMetric = {
  step: string | null
  stepIndex: number
  count: number
  visitors: number
}

export type ScrollDepthMetric = {
  depth: number
  visitors: number
  events: number
}

export type GeoCountryMetric = {
  countryCode: string | null
  countryName: string
  visitors: number
  pageviews: number
}

export type GeoCityMetric = {
  city: string
  countryCode: string | null
  countryName: string | null
  visitors: number
  pageviews: number
}

export type WebVitalMetric = {
  name: string
  rating: string | null
  samples: number
  avgValue: number
  maxValue: number
  visitors: number
  score: number
}

export type TenantWebVitalsMetric = {
  tenantId: string | null
  tenantSlug: string | null
  siteDomain: string | null
  samples: number
  visitors: number
  score: number | null
  lcpAvg: number | null
  inpAvg: number | null
  clsAvg: number | null
  fcpAvg: number | null
}

export type AutocaptureInteractionMetric = {
  event: string
  eventType: string | null
  actionLabel: string | null
  actionRole: string | null
  sectionType: string | null
  pagePath: string | null
  count: number
  visitors: number
}

export type AutocaptureFrictionMetric = {
  event: string
  pagePath: string | null
  sectionType: string | null
  count: number
  visitors: number
}

export type DashboardHighlights = SiteAnalyticsOverview & {
  topPage: string | null
  topCta: string | null
  performanceScore: number | null
  fieldPerformanceScore: number | null
}

export type TenantPerformanceMetric = {
  siteKind: "platform" | "tenant"
  tenantId: string | null
  tenantSlug: string | null
  siteDomain: string | null
  visitors: number
  pageviews: number
  conversions: number
  conversionRate: number
  ctaClicks: number
  acceptedForms: number
}

export type EventVolumeMetric = {
  event: string
  count: number
}

export type CmsUsageOverview = {
  available: boolean
  activeUsers: number
  dashboardViews: number
  routeViews: number
  actionClicks: number
  editorOpens: number
  editorOpensDesktop: number
  editorOpensMobile: number
  pageSaves: number
  mediaUploads: number
  receivedSubmissions: number
}

export type CmsRouteMetric = {
  route: string
  views: number
  users: number
  direct: number
  internal: number
  external: number
}

export type CmsActionMetric = {
  action: string
  clicks: number
  users: number
}

export type CmsDeviceMetric = {
  deviceType: string
  routeViews: number
  actionClicks: number
  editorOpens: number
  users: number
}

export type CmsTenantUsageMetric = {
  tenantId: string
  tenantSlug: string | null
  siteDomain: string | null
  activeUsers: number
  routeViews: number
  actionClicks: number
  editorOpens: number
  pageSaves: number
}

type HogQLResponse = {
  results?: unknown[][]
}

const unavailableOverview = (): SiteAnalyticsOverview => ({
  available: false,
  visitors: 0,
  pageviews: 0,
  conversions: 0,
  conversionRate: 0,
  ctaClicks: 0,
  acceptedForms: 0,
})

const unavailableHighlights = (): DashboardHighlights => ({
  ...unavailableOverview(),
  topPage: null,
  topCta: null,
  performanceScore: null,
  fieldPerformanceScore: null,
})

const unavailableFormFunnel = (): FormFunnelMetric => ({
  started: 0,
  submitted: 0,
  accepted: 0,
  submitRate: 0,
  acceptanceRate: 0,
})

const unavailableCmsUsage = (): CmsUsageOverview => ({
  available: false,
  activeUsers: 0,
  dashboardViews: 0,
  routeViews: 0,
  actionClicks: 0,
  editorOpens: 0,
  editorOpensDesktop: 0,
  editorOpensMobile: 0,
  pageSaves: 0,
  mediaUploads: 0,
  receivedSubmissions: 0,
})

const days = (value: number | undefined) => {
  const n = Number(value ?? 30)
  if (!Number.isFinite(n) || n <= 0) return 30
  return Math.min(Math.floor(n), 365)
}

const quote = (value: string | number) =>
  `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`

const analyticsWhere = (scope: AnalyticsQueryScope) => {
  const clauses = [
    `timestamp >= now() - INTERVAL ${days(scope.days)} DAY`,
    `coalesce(properties.analytics_surface, 'site') = 'site'`,
  ]
  if (scope.tenantId != null && String(scope.tenantId).trim() !== "") {
    clauses.push(`properties.tenant_id = ${quote(scope.tenantId)}`)
  }
  return clauses.join(" AND ")
}

const cmsAnalyticsWhere = (scope: AnalyticsQueryScope) => {
  const clauses = [
    `timestamp >= now() - INTERVAL ${days(scope.days)} DAY`,
    `properties.analytics_surface = 'cms'`,
    `event LIKE 'cms_%'`,
  ]
  if (scope.tenantId != null && String(scope.tenantId).trim() !== "") {
    clauses.push(`properties.tenant_id = ${quote(scope.tenantId)}`)
  }
  return clauses.join(" AND ")
}

const numberAt = (row: unknown[] | undefined, index: number) => {
  const raw = row?.[index]
  const n = typeof raw === "number" ? raw : Number(raw ?? 0)
  return Number.isFinite(n) ? n : 0
}

const nullableNumberAt = (row: unknown[] | undefined, index: number) => {
  const raw = row?.[index]
  if (raw == null || raw === "") return null
  const n = typeof raw === "number" ? raw : Number(raw)
  return Number.isFinite(n) ? n : null
}

const stringAt = (row: unknown[] | undefined, index: number): string | null => {
  const raw = row?.[index]
  if (typeof raw !== "string") return raw == null ? null : String(raw)
  return raw
}

const conversionRate = (conversions: number, visitors: number) =>
  visitors > 0 ? conversions / visitors : 0

const autocaptureClickCondition = `event = '$autocapture' AND coalesce(properties.siab_autocapture, false) = true AND coalesce(properties.$event_type, '') = 'click'`
const autocaptureCtaCondition = `${autocaptureClickCondition} AND properties.siab_click_kind IN ('cta', 'contact')`
const ctaClickCondition = `(${autocaptureCtaCondition})`
const componentInteractionCondition = `(${autocaptureClickCondition})`

export const getSiteAnalyticsOverview = async (_scope: AnalyticsQueryScope): Promise<SiteAnalyticsOverview> => {
  const config = getPostHogAnalyticsConfig()
  if (!config.queryEnabled) return unavailableOverview()

  const response = await queryPostHog<HogQLResponse>(`
    SELECT
      uniqIf(distinct_id, event = '$pageview') AS visitors,
      countIf(event = '$pageview') AS pageviews,
      countIf(event = 'site_conversion_completed') AS conversions,
      countIf(${ctaClickCondition}) AS cta_clicks,
      countIf(event = 'site_form_accepted') AS accepted_forms
    FROM events
    WHERE ${analyticsWhere(_scope)}
  `, "siab_site_analytics_overview")

  const row = response?.results?.[0]
  const visitors = numberAt(row, 0)
  const pageviews = numberAt(row, 1)
  const conversions = numberAt(row, 2)
  return {
    available: true,
    visitors,
    pageviews,
    conversions,
    conversionRate: conversionRate(conversions, visitors),
    ctaClicks: numberAt(row, 3),
    acceptedForms: numberAt(row, 4),
  }
}

export const getSiteTrafficSeries = async (_scope: AnalyticsQueryScope): Promise<TrafficSeriesPoint[]> => {
  if (!getPostHogAnalyticsConfig().queryEnabled) return []
  const response = await queryPostHog<HogQLResponse>(`
    SELECT
      toString(toDate(timestamp)) AS date,
      countIf(event = '$pageview') AS pageviews,
      uniqIf(distinct_id, event = '$pageview') AS visitors
    FROM events
    WHERE ${analyticsWhere(_scope)}
    GROUP BY date
    ORDER BY date ASC
  `, "siab_site_traffic_series")

  return (response?.results ?? []).map((row) => ({
    date: stringAt(row, 0) ?? "",
    pageviews: numberAt(row, 1),
    visitors: numberAt(row, 2),
  }))
}

export const getTopPages = async (_scope: AnalyticsQueryScope): Promise<TopPageMetric[]> => {
  if (!getPostHogAnalyticsConfig().queryEnabled) return []
  const response = await queryPostHog<HogQLResponse>(`
    SELECT
      coalesce(properties.page_path, '/') AS page_path,
      properties.page_slug AS page_slug,
      countIf(event = '$pageview') AS pageviews,
      uniqIf(distinct_id, event = '$pageview') AS visitors,
      countIf(event = 'site_conversion_completed') AS conversions
    FROM events
    WHERE ${analyticsWhere(_scope)}
    GROUP BY page_path, page_slug
    ORDER BY pageviews DESC
    LIMIT 10
  `, "siab_top_pages")

  return (response?.results ?? []).map((row) => {
    const visitors = numberAt(row, 3)
    const conversions = numberAt(row, 4)
    return {
      pagePath: stringAt(row, 0) ?? "/",
      pageSlug: stringAt(row, 1),
      pageviews: numberAt(row, 2),
      visitors,
      conversions,
      conversionRate: conversionRate(conversions, visitors),
    }
  })
}

export const getTopCtas = async (_scope: AnalyticsQueryScope): Promise<TopCtaMetric[]> => {
  if (!getPostHogAnalyticsConfig().queryEnabled) return []
  const response = await queryPostHog<HogQLResponse>(`
    SELECT
      properties.action_label AS label,
      properties.action_role AS role,
      properties.target_type AS target_type,
      count() AS clicks
    FROM events
    WHERE ${analyticsWhere(_scope)} AND (${ctaClickCondition})
    GROUP BY label, role, target_type
    ORDER BY clicks DESC
    LIMIT 10
  `, "siab_top_ctas")

  return (response?.results ?? []).map((row) => ({
    label: stringAt(row, 0),
    role: stringAt(row, 1),
    targetType: stringAt(row, 2),
    clicks: numberAt(row, 3),
  }))
}

export const getSectionPerformance = async (_scope: AnalyticsQueryScope): Promise<SectionPerformanceMetric[]> => {
  if (!getPostHogAnalyticsConfig().queryEnabled) return []
  const response = await queryPostHog<HogQLResponse>(`
    SELECT
      properties.section_id AS section_id,
      properties.section_type AS section_type,
      properties.provider_variant AS provider_variant,
      properties.page_path AS page_path,
      countIf(event = 'site_section_viewed') AS views,
      countIf(event = 'site_section_engaged') AS engagements,
      countIf(${ctaClickCondition}) AS cta_clicks
    FROM events
    WHERE ${analyticsWhere(_scope)}
      AND (event IN ('site_section_viewed', 'site_section_engaged') OR ${ctaClickCondition})
    GROUP BY section_id, section_type, provider_variant, page_path
    ORDER BY views DESC
    LIMIT 10
  `, "siab_section_performance")

  return (response?.results ?? []).map((row) => ({
    sectionId: stringAt(row, 0),
    sectionType: stringAt(row, 1),
    providerVariant: stringAt(row, 2),
    pagePath: stringAt(row, 3),
    views: numberAt(row, 4),
    engagements: numberAt(row, 5),
    ctaClicks: numberAt(row, 6),
  }))
}

export const getFormFunnel = async (_scope: AnalyticsQueryScope): Promise<FormFunnelMetric> => {
  if (!getPostHogAnalyticsConfig().queryEnabled) return unavailableFormFunnel()
  const response = await queryPostHog<HogQLResponse>(`
    SELECT
      countIf(event = 'site_form_started') AS started,
      countIf(event = 'site_form_submitted') AS submitted,
      countIf(event = 'site_form_accepted') AS accepted
    FROM events
    WHERE ${analyticsWhere(_scope)}
  `, "siab_form_funnel")

  const row = response?.results?.[0]
  const started = numberAt(row, 0)
  const submitted = numberAt(row, 1)
  const accepted = numberAt(row, 2)
  return {
    started,
    submitted,
    accepted,
    submitRate: started > 0 ? submitted / started : 0,
    acceptanceRate: submitted > 0 ? accepted / submitted : 0,
  }
}

export const getTrafficSources = async (_scope: AnalyticsQueryScope): Promise<TrafficSourceMetric[]> => {
  if (!getPostHogAnalyticsConfig().queryEnabled) return []
  const response = await queryPostHog<HogQLResponse>(`
    SELECT
      coalesce(properties.referrer_domain, 'direct') AS source,
      properties.referrer_type AS source_type,
      countIf(event = '$pageview') AS pageviews,
      uniqIf(distinct_id, event = '$pageview') AS visitors
    FROM events
    WHERE ${analyticsWhere(_scope)} AND event = '$pageview'
    GROUP BY source, source_type
    ORDER BY pageviews DESC
    LIMIT 10
  `, "siab_traffic_sources")

  return (response?.results ?? []).map((row) => ({
    source: stringAt(row, 0) ?? "direct",
    sourceType: stringAt(row, 1),
    pageviews: numberAt(row, 2),
    visitors: numberAt(row, 3),
  }))
}

export const getDeviceSplit = async (_scope: AnalyticsQueryScope): Promise<DeviceMetric[]> => {
  if (!getPostHogAnalyticsConfig().queryEnabled) return []
  const response = await queryPostHog<HogQLResponse>(`
    SELECT
      coalesce(properties.device_type, 'unknown') AS device_type,
      countIf(event = '$pageview') AS pageviews,
      uniqIf(distinct_id, event = '$pageview') AS visitors
    FROM events
    WHERE ${analyticsWhere(_scope)} AND event = '$pageview'
    GROUP BY device_type
    ORDER BY pageviews DESC
  `, "siab_device_split")

  return (response?.results ?? []).map((row) => ({
    deviceType: stringAt(row, 0) ?? "unknown",
    pageviews: numberAt(row, 1),
    visitors: numberAt(row, 2),
  }))
}

export const getDashboardHighlights = async (_scope: AnalyticsQueryScope): Promise<DashboardHighlights> => {
  if (!getPostHogAnalyticsConfig().queryEnabled) return unavailableHighlights()
  const [overview, pages, ctas, webVitals, siteQuality] = await Promise.all([
    getSiteAnalyticsOverview(_scope),
    getTopPages(_scope),
    getTopCtas(_scope),
    getWebVitals(_scope),
    getSiteQualityScore(_scope.tenantId),
  ])
  const scoredVitals = webVitals.filter((row) => row.samples > 0)
  const fieldPerformanceScore = scoredVitals.length > 0
    ? Math.round(scoredVitals.reduce((sum, row) => sum + row.score, 0) / scoredVitals.length)
    : null
  const performanceScore = combineSiteScore({ webVitals, siteQuality })
  return {
    ...overview,
    topPage: pages[0]?.pagePath ?? null,
    topCta: ctas[0]?.label ?? null,
    performanceScore,
    fieldPerformanceScore,
  }
}

export const getTenantPerformance = async (_scope: AnalyticsQueryScope): Promise<TenantPerformanceMetric[]> => {
  if (!getPostHogAnalyticsConfig().queryEnabled) return []
  const response = await queryPostHog<HogQLResponse>(`
    SELECT
      coalesce(properties.site_kind, 'tenant') AS site_kind,
      properties.tenant_id AS tenant_id,
      properties.tenant_slug AS tenant_slug,
      properties.site_domain AS site_domain,
      uniqIf(distinct_id, event = '$pageview') AS visitors,
      countIf(event = '$pageview') AS pageviews,
      countIf(event = 'site_conversion_completed') AS conversions,
      countIf(${ctaClickCondition}) AS cta_clicks,
      countIf(event = 'site_form_accepted') AS accepted_forms
    FROM events
    WHERE ${analyticsWhere(_scope)}
    GROUP BY site_kind, tenant_id, tenant_slug, site_domain
    ORDER BY pageviews DESC
    LIMIT 50
  `, "siab_tenant_performance")

  return (response?.results ?? []).map((row) => {
    const visitors = numberAt(row, 4)
    const conversions = numberAt(row, 6)
    return {
      siteKind: stringAt(row, 0) === "platform" ? "platform" : "tenant",
      tenantId: stringAt(row, 1),
      tenantSlug: stringAt(row, 2),
      siteDomain: stringAt(row, 3),
      visitors,
      pageviews: numberAt(row, 5),
      conversions,
      conversionRate: conversionRate(conversions, visitors),
      ctaClicks: numberAt(row, 7),
      acceptedForms: numberAt(row, 8),
    }
  })
}

export const getEventVolume = async (_scope: AnalyticsQueryScope): Promise<EventVolumeMetric[]> => {
  if (!getPostHogAnalyticsConfig().queryEnabled) return []
  const response = await queryPostHog<HogQLResponse>(`
    SELECT event, count() AS count
    FROM events
    WHERE ${analyticsWhere(_scope)}
      AND event IN (
        '$pageview',
        '$pageleave',
        'site_section_viewed',
        'site_section_engaged',
        'site_component_viewed',
        'site_scroll_depth_reached',
        'site_journey_step',
        'site_form_started',
        'site_form_submitted',
        'site_form_accepted',
        'site_conversion_completed',
        '$web_vitals',
        '$autocapture',
        '$rageclick',
        '$dead_click',
        'cms_dashboard_viewed',
        'cms_route_viewed',
        'cms_action_clicked',
        'cms_page_editor_opened',
        'cms_page_saved',
        'cms_block_added',
        'cms_block_removed',
        'cms_media_uploaded',
        'cms_form_submission_received'
      )
    GROUP BY event
    ORDER BY count DESC
  `, "siab_event_volume")

  return (response?.results ?? []).map((row) => ({
    event: stringAt(row, 0) ?? "unknown",
    count: numberAt(row, 1),
  }))
}

export const getCmsEventVolume = async (_scope: AnalyticsQueryScope = {}): Promise<EventVolumeMetric[]> => {
  if (!getPostHogAnalyticsConfig().queryEnabled) return []
  const response = await queryPostHog<HogQLResponse>(`
    SELECT event, count() AS count
    FROM events
    WHERE ${cmsAnalyticsWhere(_scope)}
    GROUP BY event
    ORDER BY count DESC
  `, "siab_cms_event_volume")

  return (response?.results ?? []).map((row) => ({
    event: stringAt(row, 0) ?? "unknown",
    count: numberAt(row, 1),
  }))
}

export const getComponentPerformance = async (_scope: AnalyticsQueryScope): Promise<ComponentPerformanceMetric[]> => {
  if (!getPostHogAnalyticsConfig().queryEnabled) return []
  const response = await queryPostHog<HogQLResponse>(`
    SELECT
      properties.component_type AS component_type,
      properties.component_role AS component_role,
      properties.section_type AS section_type,
      count() AS interactions,
      uniq(distinct_id) AS visitors
    FROM events
    WHERE ${analyticsWhere(_scope)} AND ${componentInteractionCondition}
    GROUP BY component_type, component_role, section_type
    ORDER BY interactions DESC
    LIMIT 20
  `, "siab_component_performance")

  return (response?.results ?? []).map((row) => ({
    componentType: stringAt(row, 0),
    componentRole: stringAt(row, 1),
    sectionType: stringAt(row, 2),
    interactions: numberAt(row, 3),
    visitors: numberAt(row, 4),
  }))
}

export const getComponentExposure = async (_scope: AnalyticsQueryScope): Promise<ComponentExposureMetric[]> => {
  if (!getPostHogAnalyticsConfig().queryEnabled) return []
  const response = await queryPostHog<HogQLResponse>(`
    SELECT
      properties.action_key AS action_key,
      properties.action_label AS label,
      properties.action_role AS role,
      properties.section_type AS section_type,
      countIf(event = 'site_component_viewed') AS views,
      countIf(${componentInteractionCondition}) AS interactions,
      uniqIf(distinct_id, event = 'site_component_viewed' OR ${componentInteractionCondition}) AS visitors,
      avgIf(properties.component_visible_ms_before_interaction, ${componentInteractionCondition}) AS avg_visible_ms,
      avgIf(properties.component_hover_ms_before_interaction, ${componentInteractionCondition}) AS avg_hover_ms,
      avgIf(properties.component_time_to_interaction_ms, ${componentInteractionCondition}) AS avg_time_to_interaction_ms
    FROM events
    WHERE ${analyticsWhere(_scope)} AND (event = 'site_component_viewed' OR ${componentInteractionCondition})
    GROUP BY action_key, label, role, section_type
    ORDER BY interactions DESC, views DESC
    LIMIT 20
  `, "siab_component_exposure")

  return (response?.results ?? []).map((row) => {
    const views = numberAt(row, 4)
    const interactions = numberAt(row, 5)
    return {
      actionKey: stringAt(row, 0),
      label: stringAt(row, 1),
      role: stringAt(row, 2),
      sectionType: stringAt(row, 3),
      views,
      interactions,
      visitors: numberAt(row, 6),
      interactionRate: views > 0 ? interactions / views : 0,
      avgVisibleMsBeforeInteraction: numberAt(row, 7),
      avgHoverMsBeforeInteraction: numberAt(row, 8),
      avgTimeToInteractionMs: numberAt(row, 9),
    }
  })
}

export const getJourneySteps = async (_scope: AnalyticsQueryScope): Promise<JourneyStepMetric[]> => {
  if (!getPostHogAnalyticsConfig().queryEnabled) return []
  const response = await queryPostHog<HogQLResponse>(`
    SELECT
      properties.journey_step AS step,
      coalesce(properties.journey_step_index, '0') AS step_index,
      count() AS count,
      uniq(distinct_id) AS visitors
    FROM events
    WHERE ${analyticsWhere(_scope)} AND event = 'site_journey_step'
    GROUP BY step, step_index
    ORDER BY step_index ASC, count DESC
    LIMIT 30
  `, "siab_journey_steps")

  return (response?.results ?? []).map((row) => ({
    step: stringAt(row, 0),
    stepIndex: numberAt(row, 1),
    count: numberAt(row, 2),
    visitors: numberAt(row, 3),
  }))
}

export const getWebVitals = async (_scope: AnalyticsQueryScope): Promise<WebVitalMetric[]> => {
  if (!getPostHogAnalyticsConfig().queryEnabled) return []
  const rows: Array<WebVitalMetric | null> = await Promise.all(WEB_VITAL_NAMES.map(async (metric) => {
    const valueProperty = `properties['$web_vitals_${metric}_value']`
    const response = await queryPostHog<HogQLResponse>(`
      SELECT
        count() AS samples,
        avg(${valueProperty}) AS avg_value,
        max(${valueProperty}) AS max_value,
        uniq(distinct_id) AS visitors
      FROM events
      WHERE ${analyticsWhere(_scope)}
        AND event = '$web_vitals'
        AND ${valueProperty} IS NOT NULL
    `, `siab_web_vitals_${metric.toLowerCase()}`)

    const row = response?.results?.[0]
    const samples = numberAt(row, 0)
    if (samples <= 0) return null
    const avgValue = numberAt(row, 1)
    return {
      name: metric,
      rating: webVitalRating(metric, avgValue),
      samples,
      avgValue,
      maxValue: numberAt(row, 2),
      visitors: numberAt(row, 3),
      score: webVitalScore(metric, avgValue),
    }
  }))

  const nativeRows = rows.filter((row): row is WebVitalMetric => row != null)
  return nativeRows
}

export const getTenantWebVitals = async (_scope: AnalyticsQueryScope): Promise<TenantWebVitalsMetric[]> => {
  if (!getPostHogAnalyticsConfig().queryEnabled) return []
  const response = await queryPostHog<HogQLResponse>(`
    SELECT
      properties.tenant_id AS tenant_id,
      properties.tenant_slug AS tenant_slug,
      properties.site_domain AS site_domain,
      count() AS samples,
      uniq(distinct_id) AS visitors,
      avgIf(properties['$web_vitals_LCP_value'], properties['$web_vitals_LCP_value'] IS NOT NULL) AS lcp_avg,
      avgIf(properties['$web_vitals_INP_value'], properties['$web_vitals_INP_value'] IS NOT NULL) AS inp_avg,
      avgIf(properties['$web_vitals_CLS_value'], properties['$web_vitals_CLS_value'] IS NOT NULL) AS cls_avg,
      avgIf(properties['$web_vitals_FCP_value'], properties['$web_vitals_FCP_value'] IS NOT NULL) AS fcp_avg
    FROM events
    WHERE ${analyticsWhere(_scope)}
      AND event = '$web_vitals'
      AND properties.tenant_id IS NOT NULL
    GROUP BY tenant_id, tenant_slug, site_domain
    HAVING samples > 0
    ORDER BY samples DESC
    LIMIT 25
  `, "siab_tenant_web_vitals")

  return (response?.results ?? []).map((row) => {
    const lcpAvg = nullableNumberAt(row, 5)
    const inpAvg = nullableNumberAt(row, 6)
    const clsAvg = nullableNumberAt(row, 7)
    const fcpAvg = nullableNumberAt(row, 8)
    const metrics = [
      ["LCP", lcpAvg] as const,
      ["INP", inpAvg] as const,
      ["CLS", clsAvg] as const,
      ["FCP", fcpAvg] as const,
    ]
    const scores = metrics
      .map(([name, value]) => value == null ? null : webVitalScore(name, value))
      .filter((score): score is number => score != null)

    return {
      tenantId: stringAt(row, 0),
      tenantSlug: stringAt(row, 1),
      siteDomain: stringAt(row, 2),
      samples: numberAt(row, 3),
      visitors: numberAt(row, 4),
      score: scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
      lcpAvg,
      inpAvg,
      clsAvg,
      fcpAvg,
    }
  })
}

export const getScrollDepth = async (_scope: AnalyticsQueryScope): Promise<ScrollDepthMetric[]> => {
  if (!getPostHogAnalyticsConfig().queryEnabled) return []
  const response = await queryPostHog<HogQLResponse>(`
    SELECT
      multiIf(
        toFloat(properties.$prev_pageview_max_content_percentage) >= 0.9, 90,
        toFloat(properties.$prev_pageview_max_content_percentage) >= 0.75, 75,
        toFloat(properties.$prev_pageview_max_content_percentage) >= 0.5, 50,
        toFloat(properties.$prev_pageview_max_content_percentage) >= 0.25, 25,
        0
      ) AS depth,
      uniq(distinct_id) AS visitors,
      count() AS events
    FROM events
    WHERE ${analyticsWhere(_scope)}
      AND event = '$pageleave'
      AND properties.$prev_pageview_max_content_percentage IS NOT NULL
    GROUP BY depth
    ORDER BY depth ASC
  `, "siab_scroll_depth")

  return (response?.results ?? []).map((row) => ({
    depth: numberAt(row, 0),
    visitors: numberAt(row, 1),
    events: numberAt(row, 2),
  }))
}

export const getAutocaptureInteractions = async (_scope: AnalyticsQueryScope): Promise<AutocaptureInteractionMetric[]> => {
  if (!getPostHogAnalyticsConfig().queryEnabled) return []
  const response = await queryPostHog<HogQLResponse>(`
    SELECT
      event,
      properties.$event_type AS event_type,
      properties.action_label AS action_label,
      properties.action_role AS action_role,
      properties.section_type AS section_type,
      properties.page_path AS page_path,
      count() AS count,
      uniq(distinct_id) AS visitors
    FROM events
    WHERE ${analyticsWhere(_scope)}
      AND event IN ('$autocapture', '$rageclick', '$dead_click')
      AND coalesce(properties.siab_autocapture, false) = true
    GROUP BY event, event_type, action_label, action_role, section_type, page_path
    ORDER BY count DESC
    LIMIT 30
  `, "siab_autocapture_interactions")

  return (response?.results ?? []).map((row) => ({
    event: stringAt(row, 0) ?? "unknown",
    eventType: stringAt(row, 1),
    actionLabel: stringAt(row, 2),
    actionRole: stringAt(row, 3),
    sectionType: stringAt(row, 4),
    pagePath: stringAt(row, 5),
    count: numberAt(row, 6),
    visitors: numberAt(row, 7),
  }))
}

export const getAutocaptureFriction = async (_scope: AnalyticsQueryScope): Promise<AutocaptureFrictionMetric[]> => {
  if (!getPostHogAnalyticsConfig().queryEnabled) return []
  const response = await queryPostHog<HogQLResponse>(`
    SELECT
      event,
      properties.page_path AS page_path,
      properties.section_type AS section_type,
      count() AS count,
      uniq(distinct_id) AS visitors
    FROM events
    WHERE ${analyticsWhere(_scope)}
      AND event IN ('$rageclick', '$dead_click')
      AND coalesce(properties.siab_autocapture, false) = true
    GROUP BY event, page_path, section_type
    ORDER BY count DESC
    LIMIT 20
  `, "siab_autocapture_friction")

  return (response?.results ?? []).map((row) => ({
    event: stringAt(row, 0) ?? "unknown",
    pagePath: stringAt(row, 1),
    sectionType: stringAt(row, 2),
    count: numberAt(row, 3),
    visitors: numberAt(row, 4),
  }))
}

export const getGeoCountries = async (_scope: AnalyticsQueryScope): Promise<GeoCountryMetric[]> => {
  if (!getPostHogAnalyticsConfig().queryEnabled) return []
  const response = await queryPostHog<HogQLResponse>(`
    SELECT
      properties.$geoip_country_code AS country_code,
      coalesce(properties.$geoip_country_name, properties.$geoip_country_code, 'Unknown') AS country_name,
      uniqIf(distinct_id, event = '$pageview') AS visitors,
      countIf(event = '$pageview') AS pageviews
    FROM events
    WHERE ${analyticsWhere(_scope)}
      AND event = '$pageview'
      AND properties.$geoip_country_code IS NOT NULL
    GROUP BY country_code, country_name
    ORDER BY visitors DESC, pageviews DESC
    LIMIT 25
  `, "siab_geo_countries")

  return (response?.results ?? []).map((row) => ({
    countryCode: stringAt(row, 0),
    countryName: stringAt(row, 1) ?? "Unknown",
    visitors: numberAt(row, 2),
    pageviews: numberAt(row, 3),
  }))
}

export const getGeoCities = async (_scope: AnalyticsQueryScope): Promise<GeoCityMetric[]> => {
  if (!getPostHogAnalyticsConfig().queryEnabled) return []
  const response = await queryPostHog<HogQLResponse>(`
    SELECT
      coalesce(properties.$geoip_city_name, 'Unknown') AS city,
      properties.$geoip_country_code AS country_code,
      properties.$geoip_country_name AS country_name,
      uniqIf(distinct_id, event = '$pageview') AS visitors,
      countIf(event = '$pageview') AS pageviews
    FROM events
    WHERE ${analyticsWhere(_scope)}
      AND event = '$pageview'
      AND properties.$geoip_city_name IS NOT NULL
    GROUP BY city, country_code, country_name
    ORDER BY visitors DESC, pageviews DESC
    LIMIT 25
  `, "siab_geo_cities")

  return (response?.results ?? []).map((row) => ({
    city: stringAt(row, 0) ?? "Unknown",
    countryCode: stringAt(row, 1),
    countryName: stringAt(row, 2),
    visitors: numberAt(row, 3),
    pageviews: numberAt(row, 4),
  }))
}

export const getCmsUsageOverview = async (_scope: AnalyticsQueryScope = {}): Promise<CmsUsageOverview> => {
  if (!getPostHogAnalyticsConfig().queryEnabled) return unavailableCmsUsage()
  const response = await queryPostHog<HogQLResponse>(`
    SELECT
      uniqIf(distinct_id, event LIKE 'cms_%') AS active_users,
      countIf(event = 'cms_dashboard_viewed') AS dashboard_views,
      countIf(event = 'cms_route_viewed') AS route_views,
      countIf(event = 'cms_action_clicked') AS action_clicks,
      countIf(event = 'cms_page_editor_opened') AS editor_opens,
      countIf(event = 'cms_route_viewed' AND properties.cms_route IN ('/pages/[id]', '/sites/[slug]/pages/[id]', '/pages/edit/[slug]', '/sites/[slug]/pages/edit/[slug]') AND properties.cms_device_type = 'desktop') AS editor_opens_desktop,
      countIf(event = 'cms_route_viewed' AND properties.cms_route IN ('/pages/[id]', '/sites/[slug]/pages/[id]', '/pages/edit/[slug]', '/sites/[slug]/pages/edit/[slug]') AND properties.cms_device_type = 'mobile') AS editor_opens_mobile,
      countIf(event = 'cms_page_saved') AS page_saves,
      countIf(event = 'cms_media_uploaded') AS media_uploads,
      countIf(event = 'cms_form_submission_received') AS received_submissions
    FROM events
    WHERE ${cmsAnalyticsWhere(_scope)}
  `, "siab_cms_usage_overview")

  const row = response?.results?.[0]
  return {
    available: true,
    activeUsers: numberAt(row, 0),
    dashboardViews: numberAt(row, 1),
    routeViews: numberAt(row, 2),
    actionClicks: numberAt(row, 3),
    editorOpens: numberAt(row, 4),
    editorOpensDesktop: numberAt(row, 5),
    editorOpensMobile: numberAt(row, 6),
    pageSaves: numberAt(row, 7),
    mediaUploads: numberAt(row, 8),
    receivedSubmissions: numberAt(row, 9),
  }
}

export const getCmsTenantUsage = async (_scope: AnalyticsQueryScope = {}): Promise<CmsTenantUsageMetric[]> => {
  if (!getPostHogAnalyticsConfig().queryEnabled) return []
  const response = await queryPostHog<HogQLResponse>(`
    SELECT
      properties.tenant_id AS tenant_id,
      properties.tenant_slug AS tenant_slug,
      properties.site_domain AS site_domain,
      uniq(distinct_id) AS active_users,
      countIf(event = 'cms_route_viewed') AS route_views,
      countIf(event = 'cms_action_clicked') AS action_clicks,
      countIf(event = 'cms_page_editor_opened') AS editor_opens,
      countIf(event = 'cms_page_saved') AS page_saves
    FROM events
    WHERE ${cmsAnalyticsWhere(_scope)}
      AND properties.tenant_id IS NOT NULL
    GROUP BY tenant_id, tenant_slug, site_domain
    ORDER BY route_views DESC, action_clicks DESC
    LIMIT 50
  `, "siab_cms_tenant_usage")

  return (response?.results ?? []).map((row) => ({
    tenantId: stringAt(row, 0) ?? "",
    tenantSlug: stringAt(row, 1),
    siteDomain: stringAt(row, 2),
    activeUsers: numberAt(row, 3),
    routeViews: numberAt(row, 4),
    actionClicks: numberAt(row, 5),
    editorOpens: numberAt(row, 6),
    pageSaves: numberAt(row, 7),
  })).filter((row) => row.tenantId !== "")
}

export const getCmsRouteMetrics = async (_scope: AnalyticsQueryScope = {}): Promise<CmsRouteMetric[]> => {
  if (!getPostHogAnalyticsConfig().queryEnabled) return []
  const response = await queryPostHog<HogQLResponse>(`
    SELECT
      coalesce(properties.cms_route, properties.cms_surface, 'unknown') AS route,
      count() AS views,
      uniq(distinct_id) AS users,
      countIf(properties.cms_referrer_type = 'direct') AS direct,
      countIf(properties.cms_referrer_type = 'internal') AS internal,
      countIf(properties.cms_referrer_type = 'external') AS external
    FROM events
    WHERE ${cmsAnalyticsWhere(_scope)}
      AND event = 'cms_route_viewed'
    GROUP BY route
    ORDER BY views DESC
    LIMIT 20
  `, "siab_cms_route_metrics")

  return (response?.results ?? []).map((row) => ({
    route: stringAt(row, 0) ?? "unknown",
    views: numberAt(row, 1),
    users: numberAt(row, 2),
    direct: numberAt(row, 3),
    internal: numberAt(row, 4),
    external: numberAt(row, 5),
  }))
}

export const getCmsActionMetrics = async (_scope: AnalyticsQueryScope = {}): Promise<CmsActionMetric[]> => {
  if (!getPostHogAnalyticsConfig().queryEnabled) return []
  const response = await queryPostHog<HogQLResponse>(`
    SELECT
      coalesce(properties.cms_action, 'unknown') AS action,
      count() AS clicks,
      uniq(distinct_id) AS users
    FROM events
    WHERE ${cmsAnalyticsWhere(_scope)}
      AND event = 'cms_action_clicked'
    GROUP BY action
    ORDER BY clicks DESC
    LIMIT 20
  `, "siab_cms_action_metrics")

  return (response?.results ?? []).map((row) => ({
    action: stringAt(row, 0) ?? "unknown",
    clicks: numberAt(row, 1),
    users: numberAt(row, 2),
  }))
}

export const getCmsDeviceMetrics = async (_scope: AnalyticsQueryScope = {}): Promise<CmsDeviceMetric[]> => {
  if (!getPostHogAnalyticsConfig().queryEnabled) return []
  const response = await queryPostHog<HogQLResponse>(`
    SELECT
      coalesce(properties.cms_device_type, 'unknown') AS device_type,
      countIf(event = 'cms_route_viewed') AS route_views,
      countIf(event = 'cms_action_clicked') AS action_clicks,
      countIf(event = 'cms_route_viewed' AND properties.cms_route IN ('/pages/[id]', '/sites/[slug]/pages/[id]', '/pages/edit/[slug]', '/sites/[slug]/pages/edit/[slug]')) AS editor_opens,
      uniq(distinct_id) AS users
    FROM events
    WHERE ${cmsAnalyticsWhere(_scope)}
      AND event IN ('cms_route_viewed', 'cms_action_clicked')
    GROUP BY device_type
    ORDER BY route_views DESC
  `, "siab_cms_device_metrics")

  return (response?.results ?? []).map((row) => ({
    deviceType: stringAt(row, 0) ?? "unknown",
    routeViews: numberAt(row, 1),
    actionClicks: numberAt(row, 2),
    editorOpens: numberAt(row, 3),
    users: numberAt(row, 4),
  }))
}
