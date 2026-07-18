import { getTranslations } from "next-intl/server"
import { AnalyticsPageContent } from "@/components/analytics/AnalyticsPageContent"
import { TenantPill } from "@/components/layout/TenantPill"
import { PageHeader } from "@/components/page-header"
import { resolveLocale } from "@/i18n/config"
import { requireSuperAdminSelectedSite } from "@/lib/routePolicy"
import { parseSiteAnalyticsView } from "@/lib/analytics/views"
import {
  getAutocaptureFriction,
  getAutocaptureInteractions,
  getComponentExposure,
  getComponentPerformance,
  getDeviceSplit,
  getFormFunnel,
  getGeoCities,
  getGeoCountries,
  getJourneySteps,
  getSectionPerformance,
  getSiteAnalyticsOverview,
  getSiteTrafficSeries,
  getScrollDepth,
  getTrafficSources,
  getTopCtas,
  getTopPages,
  getWebVitals,
} from "@/lib/analytics/queries"
import { getSiteQualityScore } from "@/lib/analytics/scoring"

export const dynamic = "force-dynamic"

const parseDays = (value: string | undefined): 7 | 30 | 90 => {
  if (value === "7" || value === "90") return Number(value) as 7 | 90
  if (value === "30") return 30
  return 7
}

const emptyFormFunnel = {
  started: 0,
  submitted: 0,
  accepted: 0,
  submitRate: 0,
  acceptanceRate: 0,
}

const emptySiteQuality = {
  available: false,
  score: null,
  passed: 0,
  total: 0,
  checks: [],
}

export default async function TenantAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams?: Promise<{ days?: string; view?: string }>
}) {
  const { slug } = await params
  const { user, tenant } = await requireSuperAdminSelectedSite(slug)
  const locale = resolveLocale(user.language)
  const t = await getTranslations({ locale, namespace: "analytics" })

  const query = (await searchParams) ?? {}
  const days = parseDays(query.days)
  const view = parseSiteAnalyticsView(query.view)
  const scope = { tenantId: tenant.id, days }
  const [
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
    webVitals,
    siteQuality,
    autocaptureInteractions,
    autocaptureFriction,
    journeySteps,
    scrollDepth,
    geoCountries,
    geoCities,
  ] = await Promise.all([
    getSiteAnalyticsOverview(scope),
    view === "overview" ? getSiteTrafficSeries(scope) : Promise.resolve([]),
    view === "overview" ? getTopPages(scope) : Promise.resolve([]),
    view === "conversion" ? getTopCtas(scope) : Promise.resolve([]),
    view === "behavior" ? getSectionPerformance(scope) : Promise.resolve([]),
    view === "conversion" ? getFormFunnel(scope) : Promise.resolve(emptyFormFunnel),
    view === "acquisition" ? getTrafficSources(scope) : Promise.resolve([]),
    view === "acquisition" ? getDeviceSplit(scope) : Promise.resolve([]),
    view === "behavior" ? getComponentPerformance(scope) : Promise.resolve([]),
    view === "behavior" ? getComponentExposure(scope) : Promise.resolve([]),
    view === "behavior" ? getWebVitals(scope) : Promise.resolve([]),
    view === "behavior" ? getSiteQualityScore(tenant.id) : Promise.resolve(emptySiteQuality),
    view === "behavior" ? getAutocaptureInteractions(scope) : Promise.resolve([]),
    view === "behavior" ? getAutocaptureFriction(scope) : Promise.resolve([]),
    view === "behavior" ? getJourneySteps(scope) : Promise.resolve([]),
    view === "behavior" ? getScrollDepth(scope) : Promise.resolve([]),
    view === "geography" ? getGeoCountries(scope) : Promise.resolve([]),
    view === "geography" ? getGeoCities(scope) : Promise.resolve([]),
  ])

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title={t("title")}
        subtitle={t("description")}
        beforeTitle={<TenantPill tenant={{ name: tenant.name, slug: tenant.slug }} />}
      />
      <AnalyticsPageContent
        overview={overview}
        traffic={traffic}
        topPages={topPages}
        topCtas={topCtas}
        sections={sections}
        formFunnel={formFunnel}
        trafficSources={trafficSources}
        deviceSplit={deviceSplit}
        componentPerformance={componentPerformance}
        componentExposure={componentExposure}
        variantRanking={[]}
        webVitals={webVitals}
        siteQuality={siteQuality}
        autocaptureInteractions={autocaptureInteractions}
        autocaptureFriction={autocaptureFriction}
        journeySteps={journeySteps}
        scrollDepth={scrollDepth}
        geoCountries={geoCountries}
        geoCities={geoCities}
        days={days}
        view={view}
        basePath={`/sites/${tenant.slug}/analytics`}
        labels={{
          unavailableTitle: t("unavailableTitle"),
          unavailableDescription: t("unavailableDescription"),
          visitors: t("visitors"),
          pageviews: t("pageviews"),
          conversions: t("conversions"),
          conversionRate: t("conversionRate"),
          ctaClicks: t("ctaClicks"),
          acceptedForms: t("acceptedForms"),
          topPages: t("topPages"),
          page: t("page"),
          views: t("views"),
          noData: t("noData"),
          ctaPerformance: t("ctaPerformance"),
          label: t("label"),
          role: t("role"),
          targetType: t("targetType"),
          clicks: t("clicks"),
          sectionPerformance: t("sectionPerformance"),
          section: t("section"),
          engagements: t("engagements"),
          engagementRate: t("engagementRate"),
          emptyValue: t("emptyValue"),
          days7: t("days7"),
          days30: t("days30"),
          days90: t("days90"),
          formFunnel: t("formFunnel"),
          started: t("started"),
          submitted: t("submitted"),
          accepted: t("accepted"),
          submitRate: t("submitRate"),
          acceptanceRate: t("acceptanceRate"),
          trafficSources: t("trafficSources"),
          source: t("source"),
          sourceType: t("sourceType"),
          deviceSplit: t("deviceSplit"),
          device: t("device"),
          componentPerformance: t("componentPerformance"),
          component: t("component"),
          componentRole: t("componentRole"),
          interactions: t("interactions"),
          interactionRate: t("interactionRate"),
          avgVisibleMs: t("avgVisibleMs"),
          avgHoverMs: t("avgHoverMs"),
          avgTimeToInteractionMs: t("avgTimeToInteractionMs"),
          webVitals: t("webVitals"),
          performanceOverview: t("performanceOverview"),
          overallScore: t("overallScore"),
          scoreUnavailable: t("scoreUnavailable"),
          measuredFromVisitors: t.raw("measuredFromVisitors"),
          lowSampleNotice: t("lowSampleNotice"),
          variantRanking: t("variantRanking"),
          variantRankingDescription: t("variantRankingDescription"),
          providerVariant: t("providerVariant"),
          rank: t("rank"),
          score: t("score"),
          evidence: t("evidence"),
          exposedVisitors: t("exposedVisitors"),
          tenants: t("tenants"),
          instances: t("instances"),
          confidenceInsufficient: t("confidenceInsufficient"),
          confidenceDirectional: t("confidenceDirectional"),
          confidenceEstablished: t("confidenceEstablished"),
          fieldPerformanceExplanation: t("fieldPerformanceExplanation"),
          siteQualityExplanation: t("siteQualityExplanation"),
          metricMainContent: t("metricMainContent"),
          metricResponsiveness: t("metricResponsiveness"),
          metricStability: t("metricStability"),
          metricFirstContent: t("metricFirstContent"),
          metricMissing: t("metricMissing"),
          ratingGood: t("ratingGood"),
          ratingNeedsWork: t("ratingNeedsWork"),
          ratingPoor: t("ratingPoor"),
          webPerformanceScore: t("webPerformanceScore"),
          siteQuality: t("siteQuality"),
          siteQualityChecks: t("siteQualityChecks"),
          combinedSiteScore: t("combinedSiteScore"),
          fieldPerformance: t("fieldPerformance"),
          statusOk: t("statusOk"),
          statusFix: t("statusFix"),
          metric: t("metric"),
          rating: t("rating"),
          samples: t("samples"),
          avgValue: t("avgValue"),
          maxValue: t("maxValue"),
          autocaptureInteractions: t("autocaptureInteractions"),
          autocaptureFriction: t("autocaptureFriction"),
          count: t("count"),
          journeySteps: t("journeySteps"),
          step: t("step"),
          stepIndex: t("stepIndex"),
          scrollDepth: t("scrollDepth"),
          depth: t("depth"),
          events: t("events"),
          geography: t("geography"),
          countries: t("countries"),
          cities: t("cities"),
          country: t("country"),
          city: t("city"),
          countryCode: t("countryCode"),
          share: t("share"),
          viewOverview: t("viewOverview"),
          viewAcquisition: t("viewAcquisition"),
          viewConversion: t("viewConversion"),
          viewBehavior: t("viewBehavior"),
          viewGeography: t("viewGeography"),
        }}
      />
    </div>
  )
}
