import { BarChart3 } from "lucide-react"
import { AnalyticsPeriodFrame } from "@/components/analytics/AnalyticsPeriodFrame"
import { AnalyticsOverview } from "@/components/analytics/AnalyticsOverview"
import {
  ComponentExposureBarChart,
  ComponentRadarChart,
  DeviceDonutChart,
  FormFunnelRadialChart,
  JourneyLineChart,
  SectionStackedBarChart,
  TopPagesBarChart,
  TrafficSourcesPieChart,
  WebVitalsBarChart,
  WebVitalsScoreChart,
} from "@/components/analytics/AnalyticsCharts"
import {
  AutocaptureFrictionTable,
  AutocaptureInteractionsTable,
  ComponentExposureTable,
  ComponentPerformanceTable,
  DeviceSplitTable,
  FormFunnelCard,
  GeoCitiesTable,
  GeoCountriesTable,
  GeoCountryMap,
  JourneyStepsTable,
  PerformanceOverviewCard,
  SectionPerformanceTable,
  ScrollDepthTable,
  SiteQualityCard,
  TopCtasTable,
  TopPagesTable,
  TrafficSourcesTable,
  VariantRankingTable,
  WebVitalsTable,
} from "@/components/analytics/AnalyticsTables"
import { TrafficChart } from "@/components/analytics/TrafficChart"
import { Alert, AlertDescription, AlertTitle } from "@siteinabox/ui/components/alert"
import type { SiteAnalyticsView } from "@/lib/analytics/views"
import type {
  AutocaptureFrictionMetric,
  AutocaptureInteractionMetric,
  ComponentExposureMetric,
  ComponentPerformanceMetric,
  DeviceMetric,
  FormFunnelMetric,
  GeoCityMetric,
  GeoCountryMetric,
  JourneyStepMetric,
  ScrollDepthMetric,
  SectionPerformanceMetric,
  SiteAnalyticsOverview,
  TopCtaMetric,
  TopPageMetric,
  TrafficSeriesPoint,
  TrafficSourceMetric,
  VariantRankingMetric,
  WebVitalMetric,
} from "@/lib/analytics/queries"
import type { SiteQualityScore } from "@/lib/analytics/scoring"

const TOP_PAGE_ROWS = 6
const DEVICE_ROWS = 5

type AnalyticsLabels = {
  unavailableTitle: string
  unavailableDescription: string
  visitors: string
  pageviews: string
  conversions: string
  conversionRate: string
  ctaClicks: string
  acceptedForms: string
  topPages: string
  page: string
  views: string
  noData: string
  ctaPerformance: string
  label: string
  role: string
  targetType: string
  clicks: string
  sectionPerformance: string
  section: string
  engagements: string
  engagementRate: string
  emptyValue: string
  days7: string
  days30: string
  days90: string
  formFunnel: string
  started: string
  submitted: string
  accepted: string
  submitRate: string
  acceptanceRate: string
  trafficSources: string
  source: string
  sourceType: string
  deviceSplit: string
  device: string
  componentPerformance: string
  component: string
  componentRole: string
  interactions: string
  interactionRate: string
  avgVisibleMs: string
  avgHoverMs: string
  avgTimeToInteractionMs: string
  webVitals: string
  performanceOverview: string
  overallScore: string
  scoreUnavailable: string
  measuredFromVisitors: string
  lowSampleNotice: string
  fieldPerformanceExplanation: string
  siteQualityExplanation: string
  metricMainContent: string
  metricResponsiveness: string
  metricStability: string
  metricFirstContent: string
  metricMissing: string
  ratingGood: string
  ratingNeedsWork: string
  ratingPoor: string
  webPerformanceScore: string
  siteQuality: string
  siteQualityChecks: string
  combinedSiteScore: string
  fieldPerformance: string
  statusOk: string
  statusFix: string
  metric: string
  rating: string
  samples: string
  avgValue: string
  maxValue: string
  autocaptureInteractions: string
  autocaptureFriction: string
  count: string
  journeySteps: string
  step: string
  stepIndex: string
  scrollDepth: string
  depth: string
  events: string
  geography: string
  countries: string
  cities: string
  country: string
  city: string
  countryCode: string
  share: string
  viewOverview: string
  viewAcquisition: string
  viewConversion: string
  viewBehavior: string
  viewGeography: string
  variantRanking: string
  variantRankingDescription: string
  providerVariant: string
  rank: string
  score: string
  evidence: string
  exposedVisitors: string
  tenants: string
  instances: string
  confidenceInsufficient: string
  confidenceDirectional: string
  confidenceEstablished: string
}

export function AnalyticsPageContent({
  overview,
  traffic,
  topPages,
  topCtas,
  sections,
  formFunnel,
  trafficSources,
  deviceSplit,
  componentPerformance,
  componentExposure,
  variantRanking,
  webVitals,
  siteQuality,
  autocaptureInteractions,
  autocaptureFriction,
  journeySteps,
  scrollDepth,
  geoCountries,
  geoCities,
  days,
  basePath,
  labels,
  view = "overview",
  hideControls = false,
  hideOverview = false,
  hideTraffic = false,
  hideUnavailable = false,
  aggregateScope = false,
  simplePerformance = false,
  title,
  subtitle,
}: {
  overview: SiteAnalyticsOverview
  traffic: TrafficSeriesPoint[]
  topPages: TopPageMetric[]
  topCtas: TopCtaMetric[]
  sections: SectionPerformanceMetric[]
  formFunnel: FormFunnelMetric
  trafficSources: TrafficSourceMetric[]
  deviceSplit: DeviceMetric[]
  componentPerformance: ComponentPerformanceMetric[]
  componentExposure: ComponentExposureMetric[]
  variantRanking: VariantRankingMetric[]
  webVitals: WebVitalMetric[]
  siteQuality: SiteQualityScore
  autocaptureInteractions: AutocaptureInteractionMetric[]
  autocaptureFriction: AutocaptureFrictionMetric[]
  journeySteps: JourneyStepMetric[]
  scrollDepth: ScrollDepthMetric[]
  geoCountries: GeoCountryMetric[]
  geoCities: GeoCityMetric[]
  days: 7 | 30 | 90
  basePath: string
  labels: AnalyticsLabels
  view?: SiteAnalyticsView
  hideControls?: boolean
  hideOverview?: boolean
  hideTraffic?: boolean
  hideUnavailable?: boolean
  aggregateScope?: boolean
  simplePerformance?: boolean
  title?: string
  subtitle?: React.ReactNode
}) {
  const tableLabels = {
    topPages: labels.topPages,
    page: labels.page,
    views: labels.views,
    visitors: labels.visitors,
    conversions: labels.conversions,
    conversionRate: labels.conversionRate,
    noData: labels.noData,
    ctaPerformance: labels.ctaPerformance,
    label: labels.label,
    role: labels.role,
    targetType: labels.targetType,
    clicks: labels.clicks,
    sectionPerformance: labels.sectionPerformance,
    section: labels.section,
    engagements: labels.engagements,
    engagementRate: labels.engagementRate,
    ctaClicks: labels.ctaClicks,
    emptyValue: labels.emptyValue,
    formFunnel: labels.formFunnel,
    started: labels.started,
    submitted: labels.submitted,
    accepted: labels.accepted,
    submitRate: labels.submitRate,
    acceptanceRate: labels.acceptanceRate,
    trafficSources: labels.trafficSources,
    source: labels.source,
    sourceType: labels.sourceType,
    deviceSplit: labels.deviceSplit,
    device: labels.device,
    componentPerformance: labels.componentPerformance,
    component: labels.component,
    componentRole: labels.componentRole,
    interactions: labels.interactions,
    interactionRate: labels.interactionRate,
    avgVisibleMs: labels.avgVisibleMs,
    avgHoverMs: labels.avgHoverMs,
    avgTimeToInteractionMs: labels.avgTimeToInteractionMs,
    webVitals: labels.webVitals,
    performanceOverview: labels.performanceOverview,
    overallScore: labels.overallScore,
    scoreUnavailable: labels.scoreUnavailable,
    measuredFromVisitors: labels.measuredFromVisitors,
    lowSampleNotice: labels.lowSampleNotice,
    fieldPerformanceExplanation: labels.fieldPerformanceExplanation,
    siteQualityExplanation: labels.siteQualityExplanation,
    metricMainContent: labels.metricMainContent,
    metricResponsiveness: labels.metricResponsiveness,
    metricStability: labels.metricStability,
    metricFirstContent: labels.metricFirstContent,
    metricMissing: labels.metricMissing,
    ratingGood: labels.ratingGood,
    ratingNeedsWork: labels.ratingNeedsWork,
    ratingPoor: labels.ratingPoor,
    webPerformanceScore: labels.webPerformanceScore,
    siteQuality: labels.siteQuality,
    siteQualityChecks: labels.siteQualityChecks,
    combinedSiteScore: labels.combinedSiteScore,
    fieldPerformance: labels.fieldPerformance,
    statusOk: labels.statusOk,
    statusFix: labels.statusFix,
    metric: labels.metric,
    rating: labels.rating,
    samples: labels.samples,
    avgValue: labels.avgValue,
    maxValue: labels.maxValue,
    autocaptureInteractions: labels.autocaptureInteractions,
    autocaptureFriction: labels.autocaptureFriction,
    count: labels.count,
    journeySteps: labels.journeySteps,
    step: labels.step,
    stepIndex: labels.stepIndex,
    scrollDepth: labels.scrollDepth,
    depth: labels.depth,
    events: labels.events,
    geography: labels.geography,
    countries: labels.countries,
    cities: labels.cities,
    country: labels.country,
    city: labels.city,
    countryCode: labels.countryCode,
    share: labels.share,
    variantRanking: labels.variantRanking,
    variantRankingDescription: labels.variantRankingDescription,
    providerVariant: labels.providerVariant,
    rank: labels.rank,
    score: labels.score,
    evidence: labels.evidence,
    exposedVisitors: labels.exposedVisitors,
    tenants: labels.tenants,
    instances: labels.instances,
    confidenceInsufficient: labels.confidenceInsufficient,
    confidenceDirectional: labels.confidenceDirectional,
    confidenceEstablished: labels.confidenceEstablished,
  }
  const viewItems = [
    { value: "overview", label: labels.viewOverview },
    { value: "acquisition", label: labels.viewAcquisition },
    { value: "conversion", label: labels.viewConversion },
    { value: "behavior", label: labels.viewBehavior },
    { value: "geography", label: labels.viewGeography },
  ]

  const content = (
    <>
      {!hideUnavailable && !overview.available && (
        <Alert>
          <BarChart3 className="h-4 w-4" aria-hidden />
          <AlertTitle>{labels.unavailableTitle}</AlertTitle>
          <AlertDescription>{labels.unavailableDescription}</AlertDescription>
        </Alert>
      )}
      {view === "overview" && (
        <>
          {!hideOverview && <AnalyticsOverview overview={overview} labels={labels} />}
          {!hideTraffic && <TrafficChart data={traffic} />}
          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            <TopPagesBarChart rows={topPages.slice(0, TOP_PAGE_ROWS)} labels={tableLabels} />
            <TopPagesTable rows={topPages.slice(0, TOP_PAGE_ROWS)} labels={tableLabels} />
          </div>
        </>
      )}
      {view === "acquisition" && (
        <>
          <div className="grid min-w-0 gap-4 xl:grid-cols-3">
            <TrafficSourcesPieChart rows={trafficSources} labels={tableLabels} />
            <DeviceDonutChart rows={deviceSplit.slice(0, DEVICE_ROWS)} labels={tableLabels} />
            <DeviceSplitTable rows={deviceSplit.slice(0, DEVICE_ROWS)} labels={tableLabels} />
          </div>
          <TrafficSourcesTable rows={trafficSources} labels={tableLabels} />
        </>
      )}
      {view === "conversion" && (
        <>
          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            <FormFunnelRadialChart funnel={formFunnel} labels={tableLabels} />
            <FormFunnelCard funnel={formFunnel} labels={tableLabels} />
          </div>
          <TopCtasTable rows={topCtas} labels={tableLabels} />
        </>
      )}
      {view === "behavior" && (
        <>
          <PerformanceOverviewCard
            webVitals={webVitals}
            siteQuality={siteQuality}
            labels={tableLabels}
            showSiteQuality={!aggregateScope}
          />
          {simplePerformance ? (
            !aggregateScope && <SiteQualityCard score={siteQuality} labels={tableLabels} />
          ) : (
            <>
          {aggregateScope && <VariantRankingTable rows={variantRanking} labels={tableLabels} />}
          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            <SectionStackedBarChart rows={sections} labels={tableLabels} />
            <ComponentExposureBarChart rows={componentExposure} labels={tableLabels} />
          </div>
          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            <ComponentRadarChart rows={componentPerformance} labels={tableLabels} />
            <WebVitalsScoreChart rows={webVitals} labels={tableLabels} />
          </div>
          {aggregateScope ? (
            <WebVitalsBarChart rows={webVitals} labels={tableLabels} />
          ) : (
            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              <SiteQualityCard score={siteQuality} labels={tableLabels} />
              <WebVitalsBarChart rows={webVitals} labels={tableLabels} />
            </div>
          )}
          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            <AutocaptureFrictionTable rows={autocaptureFriction} labels={tableLabels} />
            <WebVitalsTable rows={webVitals} labels={tableLabels} />
          </div>
          <div className="grid min-w-0 gap-4 xl:grid-cols-3">
            <SectionPerformanceTable rows={sections} labels={tableLabels} />
            <JourneyLineChart journeySteps={journeySteps} scrollDepth={scrollDepth} labels={tableLabels} />
            <JourneyStepsTable rows={journeySteps} labels={tableLabels} />
            <ScrollDepthTable rows={scrollDepth} labels={tableLabels} />
          </div>
          <ComponentExposureTable rows={componentExposure} labels={tableLabels} />
          <AutocaptureInteractionsTable rows={autocaptureInteractions} labels={tableLabels} />
          <ComponentPerformanceTable rows={componentPerformance} labels={tableLabels} />
            </>
          )}
        </>
      )}
      {view === "geography" && (
        <>
          <GeoCountryMap rows={geoCountries} labels={tableLabels} />
          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            <GeoCountriesTable rows={geoCountries} labels={tableLabels} />
            <GeoCitiesTable rows={geoCities} labels={tableLabels} />
          </div>
        </>
      )}
    </>
  )

  if (hideControls) return content

  return (
    <AnalyticsPeriodFrame
      days={days}
      basePath={basePath}
      activeView={view}
      views={viewItems}
      title={title}
      subtitle={subtitle}
      labels={{ days7: labels.days7, days30: labels.days30, days90: labels.days90 }}
    >
      {content}
    </AnalyticsPeriodFrame>
  )
}
