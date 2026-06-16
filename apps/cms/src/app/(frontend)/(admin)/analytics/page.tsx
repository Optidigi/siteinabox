import { BarChart3 } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { AnalyticsPageContent } from "@/components/analytics/AnalyticsPageContent"
import { AnalyticsPeriodFrame } from "@/components/analytics/AnalyticsPeriodFrame"
import {
  CmsActionBarChart,
  CmsDeviceBarChart,
  CmsRouteStackedBarChart,
  EventVolumeBarChart,
  TenantPerformanceChart,
} from "@/components/analytics/AdminAnalyticsCharts"
import {
  CmsActionMetricsTable,
  CmsDeviceMetricsTable,
  CmsRouteMetricsTable,
  EventVolumeTable,
  TenantPerformanceTable,
  TenantWebVitalsTable,
} from "@/components/analytics/AdminAnalyticsTables"
import { Alert, AlertDescription, AlertTitle } from "@siteinabox/ui/components/alert"
import { resolveLocale } from "@/i18n/config"
import { parseAdminAnalyticsView, parseSiteAnalyticsView } from "@/lib/analytics/views"
import {
  getAutocaptureFriction,
  getAutocaptureInteractions,
  getDeviceSplit,
  getCmsActionMetrics,
  getCmsDeviceMetrics,
  getCmsRouteMetrics,
  getComponentExposure,
  getComponentPerformance,
  getEventVolume,
  getFormFunnel,
  getGeoCities,
  getGeoCountries,
  getJourneySteps,
  getSectionPerformance,
  getSiteAnalyticsOverview,
  getSiteTrafficSeries,
  getScrollDepth,
  getTenantPerformance,
  getTenantWebVitals,
  getTrafficSources,
  getTopCtas,
  getTopPages,
  getWebVitals,
} from "@/lib/analytics/queries"
import { getSiteQualityScore } from "@/lib/analytics/scoring"
import { requireAuth } from "@/lib/authGate"
import { listTenants } from "@/lib/queries/tenants"

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

const ADMIN_TENANT_CHART_ROWS = 8
const ADMIN_EVENT_CHART_ROWS = 8
const ADMIN_ROUTE_CHART_ROWS = 6
const ADMIN_ACTION_CHART_ROWS = 8
const ADMIN_DEVICE_CHART_ROWS = 6

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<{ days?: string; tenantId?: string; view?: string }>
}) {
  const { user, ctx } = await requireAuth()
  const locale = resolveLocale(user.language)
  const t = await getTranslations({ locale, namespace: "analytics" })
  const tAdmin = await getTranslations({ locale, namespace: "adminAnalytics" })
  const params = (await searchParams) ?? {}
  const days = parseDays(params.days)

  if (ctx.mode === "super-admin") {
    const view = parseAdminAnalyticsView(params.view)
    const tenants = await listTenants()
    const tenantOptions = tenants.map((tenant: any) => ({
      id: String(tenant.id),
      name: String(tenant.name ?? tenant.slug ?? tenant.id),
      slug: String(tenant.slug ?? tenant.id),
    }))
    const selectedTenantId = tenantOptions.some((tenant) => tenant.id === params.tenantId)
      ? params.tenantId ?? null
      : null
    const scope = { tenantId: selectedTenantId, days }
    const [
      overview,
      traffic,
      tenantPerformance,
      eventVolume,
      trafficSources,
      deviceSplit,
      topPages,
      topCtas,
      sections,
      formFunnel,
      cmsRoutes,
      cmsActions,
      cmsDevices,
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
      tenantWebVitals,
    ] = await Promise.all([
      getSiteAnalyticsOverview(scope),
      view === "overview" ? getSiteTrafficSeries(scope) : Promise.resolve([]),
      view === "overview" || view === "cms" ? getTenantPerformance(scope) : Promise.resolve([]),
      view === "cms" ? getEventVolume(scope) : Promise.resolve([]),
      view === "acquisition" ? getTrafficSources(scope) : Promise.resolve([]),
      view === "acquisition" ? getDeviceSplit(scope) : Promise.resolve([]),
      view === "overview" ? getTopPages(scope) : Promise.resolve([]),
      view === "conversion" ? getTopCtas(scope) : Promise.resolve([]),
      view === "behavior" ? getSectionPerformance(scope) : Promise.resolve([]),
      view === "conversion" ? getFormFunnel(scope) : Promise.resolve(emptyFormFunnel),
      view === "cms" ? getCmsRouteMetrics({ days }) : Promise.resolve([]),
      view === "cms" ? getCmsActionMetrics({ days }) : Promise.resolve([]),
      view === "cms" ? getCmsDeviceMetrics({ days }) : Promise.resolve([]),
      view === "behavior" ? getComponentPerformance(scope) : Promise.resolve([]),
      view === "behavior" ? getComponentExposure(scope) : Promise.resolve([]),
      view === "behavior" ? getWebVitals(scope) : Promise.resolve([]),
      view === "behavior" && selectedTenantId ? getSiteQualityScore(selectedTenantId) : Promise.resolve(emptySiteQuality),
      view === "behavior" ? getAutocaptureInteractions(scope) : Promise.resolve([]),
      view === "behavior" ? getAutocaptureFriction(scope) : Promise.resolve([]),
      view === "behavior" ? getJourneySteps(scope) : Promise.resolve([]),
      view === "behavior" ? getScrollDepth(scope) : Promise.resolve([]),
      view === "geography" ? getGeoCountries(scope) : Promise.resolve([]),
      view === "geography" ? getGeoCities(scope) : Promise.resolve([]),
      view === "behavior" && !selectedTenantId ? getTenantWebVitals(scope) : Promise.resolve([]),
    ])
    const tableLabels = {
      tenantPerformance: tAdmin("tenantPerformance"),
      eventVolume: tAdmin("eventVolume"),
      tenant: tAdmin("tenant"),
      domain: tAdmin("domain"),
      visitors: t("visitors"),
      pageviews: t("pageviews"),
      conversions: t("conversions"),
      conversionRate: t("conversionRate"),
      ctaClicks: t("ctaClicks"),
      acceptedForms: t("acceptedForms"),
      event: tAdmin("event"),
      count: tAdmin("count"),
      noData: t("noData"),
      emptyValue: t("emptyValue"),
      unknownTenant: tAdmin("unknownTenant"),
      cmsRoutes: tAdmin("cmsRoutes"),
      route: tAdmin("route"),
      users: tAdmin("users"),
      direct: tAdmin("direct"),
      internal: tAdmin("internal"),
      external: tAdmin("external"),
      cmsActions: tAdmin("cmsActions"),
      action: tAdmin("action"),
      clicks: t("clicks"),
      cmsDevices: tAdmin("cmsDevices"),
      device: t("device"),
      routeViews: tAdmin("routeViews"),
      actionClicks: tAdmin("actionClicks"),
      editorOpens: tAdmin("editorOpens"),
      webVitals: t("webVitals"),
      webPerformanceScore: t("webPerformanceScore"),
      samples: t("samples"),
    }
    const tenantPerformanceRows = tenantPerformance.slice(0, ADMIN_TENANT_CHART_ROWS)
    const eventVolumeRows = eventVolume.slice(0, ADMIN_EVENT_CHART_ROWS)
    const cmsRouteRows = cmsRoutes.slice(0, ADMIN_ROUTE_CHART_ROWS)
    const cmsActionRows = cmsActions.slice(0, ADMIN_ACTION_CHART_ROWS)
    const cmsDeviceRows = cmsDevices.slice(0, ADMIN_DEVICE_CHART_ROWS)

    return (
      <div className="flex min-w-0 flex-col gap-4">
        {!overview.available && (
          <Alert>
            <BarChart3 className="h-4 w-4" aria-hidden />
            <AlertTitle>{t("unavailableTitle")}</AlertTitle>
            <AlertDescription>{t("unavailableDescription")}</AlertDescription>
          </Alert>
        )}
        <AnalyticsPeriodFrame
          days={days}
          basePath="/analytics"
          tenantId={selectedTenantId}
          activeView={view}
          title={tAdmin("title")}
          subtitle={tAdmin("description")}
          views={[
            { value: "overview", label: t("viewOverview") },
            { value: "acquisition", label: t("viewAcquisition") },
            { value: "conversion", label: t("viewConversion") },
            { value: "behavior", label: t("viewBehavior") },
            { value: "geography", label: t("viewGeography") },
            { value: "cms", label: tAdmin("viewCms") },
          ]}
          labels={{ days7: t("days7"), days30: t("days30"), days90: t("days90") }}
          tenantFilter={{
            selectedTenantId,
            label: tAdmin("tenantFilter"),
            allLabel: tAdmin("allTenants"),
            tenants: tenantOptions,
          }}
        >
        {view === "cms" ? (
          <>
            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              <TenantPerformanceChart data={tenantPerformanceRows} />
              <TenantPerformanceTable rows={tenantPerformanceRows} labels={tableLabels} />
            </div>
            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              <EventVolumeBarChart rows={eventVolumeRows} labels={tableLabels} />
              <EventVolumeTable rows={eventVolumeRows} labels={tableLabels} />
            </div>
            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              <CmsRouteStackedBarChart rows={cmsRouteRows} labels={tableLabels} />
              <CmsRouteMetricsTable rows={cmsRouteRows} labels={tableLabels} />
            </div>
            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              <CmsActionBarChart rows={cmsActionRows} labels={tableLabels} />
              <CmsActionMetricsTable rows={cmsActionRows} labels={tableLabels} />
            </div>
            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              <CmsDeviceBarChart rows={cmsDeviceRows} labels={tableLabels} />
              <CmsDeviceMetricsTable rows={cmsDeviceRows} labels={tableLabels} />
            </div>
          </>
        ) : (
          <>
            {view === "overview" && (
              <div className="grid min-w-0 gap-4 xl:grid-cols-2">
                <TenantPerformanceChart data={tenantPerformanceRows} />
                <TenantPerformanceTable rows={tenantPerformanceRows} labels={tableLabels} />
              </div>
            )}
            {view === "behavior" && !selectedTenantId && (
              <TenantWebVitalsTable rows={tenantWebVitals} labels={tableLabels} />
            )}
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
          basePath="/analytics"
          aggregateScope={!selectedTenantId}
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
            measuredFromVisitors: t("measuredFromVisitors"),
            lowSampleNotice: t("lowSampleNotice"),
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
          hideControls
          hideOverview={false}
          hideTraffic={false}
          hideUnavailable
        />
          </>
        )}
        </AnalyticsPeriodFrame>
      </div>
    )
  }

  const tenantId = ctx.tenant.id
  const view = parseSiteAnalyticsView(params.view)
  const scope = { tenantId, days }
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
    view === "behavior" ? getSiteQualityScore(tenantId) : Promise.resolve(emptySiteQuality),
    view === "behavior" ? getAutocaptureInteractions(scope) : Promise.resolve([]),
    view === "behavior" ? getAutocaptureFriction(scope) : Promise.resolve([]),
    view === "behavior" ? getJourneySteps(scope) : Promise.resolve([]),
    view === "behavior" ? getScrollDepth(scope) : Promise.resolve([]),
    view === "geography" ? getGeoCountries(scope) : Promise.resolve([]),
    view === "geography" ? getGeoCities(scope) : Promise.resolve([]),
  ])

  return (
    <div className="flex min-w-0 flex-col gap-4">
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
        basePath="/analytics"
        simplePerformance
        title={t("title")}
        subtitle={t("description")}
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
          measuredFromVisitors: t("measuredFromVisitors"),
          lowSampleNotice: t("lowSampleNotice"),
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
