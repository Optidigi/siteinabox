import { requireAuth } from "@/lib/authGate"
import { getTranslations } from "next-intl/server"
import { resolveLocale } from "@/i18n/config"
import { getRecentActivity, getDashboardStats, getEditsTimeseries } from "@/lib/activity"
import { captureCmsUsageEvent } from "@/lib/analytics/cms"
import { getCmsUsageOverview, getDashboardHighlights } from "@/lib/analytics/queries"
import { StatCards } from "@/components/dashboard/StatCards"
import { CmsUsageCharts } from "@/components/dashboard/CmsUsageCharts"
import { EditsChart } from "@/components/dashboard/EditsChart"
import { ActivityFeed } from "@/components/dashboard/ActivityFeed"
import { Alert, AlertDescription, AlertTitle } from "@siteinabox/ui/components/alert"
import { Globe, FileCheck2, Activity, Inbox, ShieldAlert, Eye, Target, Percent, Gauge } from "lucide-react"

const pct = (value: number) => `${Math.round(value * 1000) / 10}%`
const score = (value: number | null) => value == null ? "n/a" : `${value}/100`
const DASHBOARD_ANALYTICS_DAYS = 7

export const dynamic = "force-dynamic"

// FN-2026-0035 — `requireRole` redirects to /?error=forbidden on access
// failures; pre-fix the dashboard ignored the param. Surface a friendly
// inline alert so the operator knows WHY they ended up here. Sibling of
// the LoginForm error-copy fix (FN-2026-0043).
export default async function DashboardPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string }>
}) {
  const { user, ctx } = await requireAuth()
  const t = await getTranslations({ locale: resolveLocale(user.language), namespace: "dashboard" })
  const tenantId = ctx.mode === "tenant" ? ctx.tenant.id : null
  const params = (await searchParams) ?? {}
  const errorCopy = params.error === "forbidden" ? t("forbidden") : null

  const [, stats, series, activity, analytics, cmsUsage] = await Promise.all([
    captureCmsUsageEvent({ event: "cms_dashboard_viewed", user, ctx, surface: "dashboard", action: "view" }),
    getDashboardStats(tenantId),
    getEditsTimeseries(tenantId, DASHBOARD_ANALYTICS_DAYS),
    getRecentActivity({ tenantId, limit: 25 }),
    tenantId ? getDashboardHighlights({ tenantId, days: DASHBOARD_ANALYTICS_DAYS }) : Promise.resolve(null),
    ctx.mode === "super-admin" ? getCmsUsageOverview({ days: DASHBOARD_ANALYTICS_DAYS }) : Promise.resolve(null)
  ])

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {errorCopy && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" aria-hidden />
          <AlertTitle>{t("accessDenied")}</AlertTitle>
          <AlertDescription>{errorCopy}</AlertDescription>
        </Alert>
      )}
      <StatCards stats={[
        // FN-2026-0045 — wire href so cards become drill-down affordances.
        // CRITICAL: tenant-mode operators (owner/editor/viewer) must NOT
        // be linked to the /sites/[slug]/* super-admin tenant subroutes
        // (those gate with `requireRole(["super-admin"])` and would
        // bounce to /?error=forbidden — exactly the regression the
        // fn-batch-6 reviewer caught). For tenant-mode users the canonical
        // routes are the slugless host-resolved pages: /pages, /forms,
        // /media, /settings, /users. For super-admin at workspace top-
        // level the natural drill-downs are the global /sites + /users.
        {
          label: ctx.mode === "tenant" ? t("activeSite") : t("totalSites"),
          value: stats.tenants,
          icon: Globe,
          // Tenant mode: leave the active-site card non-interactive (the
          // dashboard IS the active-site landing). Super-admin: drill
          // into the global tenants list.
          href: ctx.mode === "tenant" ? undefined : "/sites"
        },
        {
          label: t("publishedPages"),
          value: stats.publishedPages,
          icon: FileCheck2,
          href: ctx.mode === "tenant" ? "/pages" : undefined
        },
        { label: t("editsThisWeek"), value: stats.editsThisWeek, icon: Activity },
        {
          label: t("submissions30d"),
          value: stats.formsThisMonth,
          icon: Inbox,
          href: ctx.mode === "tenant" ? "/forms" : undefined
        }
      ]}/>
      <EditsChart data={series} />
      {analytics?.available && (
        <StatCards stats={[
          { label: t("visitors7d"), value: analytics.visitors, icon: Eye, href: "/analytics", disableMobileHref: true },
          { label: t("conversions7d"), value: analytics.conversions, icon: Target, href: "/analytics", disableMobileHref: true },
          { label: t("conversionRate"), value: pct(analytics.conversionRate), icon: Percent, href: "/analytics", disableMobileHref: true },
          { label: t("performanceScore7d"), value: score(analytics.performanceScore), icon: Gauge, href: "/analytics?view=behavior", disableMobileHref: true },
        ]} />
      )}
      {cmsUsage?.available && (
        <CmsUsageCharts
          usage={cmsUsage}
          labels={{
            title: t("cmsUsageTitle"),
            volumeTitle: t("cmsUsageVolume"),
            deviceTitle: t("cmsEditorDeviceSplit"),
            activeUsers: t("cmsActiveUsers7d"),
            dashboardViews: t("cmsDashboardViews7d"),
            routeViews: t("cmsRouteViews7d"),
            actionClicks: t("cmsActionClicks7d"),
            editorOpens: t("cmsEditorOpens7d"),
            pageSaves: t("cmsPageSaves7d"),
            mediaUploads: t("cmsMediaUploads7d"),
            receivedSubmissions: t("cmsReceivedSubmissions7d"),
            desktop: t("cmsEditorDesktop7d"),
            mobile: t("cmsEditorMobile7d"),
            noData: t("noData"),
          }}
        />
      )}
      <ActivityFeed entries={activity} mode={ctx.mode} />
    </div>
  )
}
