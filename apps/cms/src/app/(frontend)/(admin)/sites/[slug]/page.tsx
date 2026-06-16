import type { Metadata } from "next"
import { getTenantBySlug } from "@/lib/queries/tenants"
import { getDashboardStats, getEditsTimeseries, getRecentActivity } from "@/lib/activity"
import { getDashboardHighlights } from "@/lib/analytics/queries"
import { StatCards } from "@/components/dashboard/StatCards"
import { EditsChart } from "@/components/dashboard/EditsChart"
import { ActivityFeed } from "@/components/dashboard/ActivityFeed"
import { Badge } from "@siteinabox/ui/components/badge"
import { statusVariant } from "@/lib/badge-helpers"
import { Button } from "@siteinabox/ui/components/button"
import { PageHeader } from "@/components/page-header"
import { Pencil, FileCheck2, Activity, Inbox, BadgeCheck, Eye, Target, Percent, Gauge } from "lucide-react"
import Link from "next/link"
import { requireSuperAdminSelectedSite } from "@/lib/routePolicy"
import { getTranslations } from "next-intl/server"
import { resolveLocale } from "@/i18n/config"
import { statusLabel } from "@/lib/i18nLabels"

const pct = (value: number) => `${Math.round(value * 1000) / 10}%`
const score = (value: number | null) => value == null ? "n/a" : `${value}/100`
const DASHBOARD_ANALYTICS_DAYS = 7

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const tenant = await getTenantBySlug(slug)
  return { title: tenant?.name ?? "Site" }
}

export default async function TenantOverviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { user, tenant } = await requireSuperAdminSelectedSite(slug)
  const locale = resolveLocale(user.language)
  const t = await getTranslations({ locale, namespace: "dashboard" })
  const tCommon = await getTranslations({ locale, namespace: "common" })
  const tenantId = tenant.id

  const [stats, series, activity, analytics] = await Promise.all([
    getDashboardStats(tenantId),
    getEditsTimeseries(tenantId, DASHBOARD_ANALYTICS_DAYS),
    getRecentActivity({ tenantId, limit: 25 }),
    getDashboardHighlights({ tenantId, days: DASHBOARD_ANALYTICS_DAYS })
  ])

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title={tenant.name}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <span>{tenant.domain}</span> · <Badge variant={statusVariant(tenant.status as string)}><span className="size-1.5 rounded-full bg-current" aria-hidden />{statusLabel(tCommon, tenant.status as string)}</Badge>
          </span>
        }
        action={
          <Button asChild variant="outline">
            <Link href={`/sites/${tenant.slug}/edit`}><Pencil className="mr-1 h-4 w-4"/> {t("editSite")}</Link>
          </Button>
        }
      />
      <StatCards stats={[
        { label: t("publishedPages"), value: stats.publishedPages, icon: FileCheck2 },
        { label: t("editsThisWeek"), value: stats.editsThisWeek, icon: Activity },
        { label: t("submissions30d"), value: stats.formsThisMonth, icon: Inbox },
        { label: t("status"), value: statusLabel(tCommon, tenant.status as string), icon: BadgeCheck }
      ]} />
      <EditsChart data={series} />
      {analytics.available && (
        <StatCards stats={[
          { label: t("visitors7d"), value: analytics.visitors, icon: Eye, href: `/sites/${tenant.slug}/analytics`, disableMobileHref: true },
          { label: t("conversions7d"), value: analytics.conversions, icon: Target, href: `/sites/${tenant.slug}/analytics`, disableMobileHref: true },
          { label: t("conversionRate"), value: pct(analytics.conversionRate), icon: Percent, href: `/sites/${tenant.slug}/analytics`, disableMobileHref: true },
          { label: t("performanceScore7d"), value: score(analytics.performanceScore), icon: Gauge, href: `/sites/${tenant.slug}/analytics?view=behavior`, disableMobileHref: true },
        ]} />
      )}
      <ActivityFeed entries={activity} />
    </div>
  )
}
