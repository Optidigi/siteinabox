"use client"

import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { ClientOnlyChartContainer as ChartContainer } from "@/components/analytics/ClientOnlyChartContainer"
import {
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@siteinabox/ui/components/chart"
import type {
  CmsActionMetric,
  CmsDeviceMetric,
  CmsRouteMetric,
  CmsTenantUsageMetric,
  DeviceMetric,
  EventVolumeMetric,
  TenantPerformanceMetric,
  TrafficSourceMetric,
} from "@/lib/analytics/queries"

const truncateTick = (value: unknown, max = 14) => {
  const text = String(value ?? "")
  return text.length > max ? `${text.slice(0, max)}...` : text
}

export function CmsTenantUsageChart({ data }: { data: CmsTenantUsageMetric[] }) {
  const t = useTranslations("adminAnalytics")
  const rows = data.slice(0, 8).map((row) => ({
    tenant: row.tenantSlug ?? row.siteDomain ?? row.tenantId,
    routeViews: row.routeViews,
    actionClicks: row.actionClicks,
  }))
  const chartConfig: ChartConfig = {
    routeViews: { label: t("routeViews"), color: "var(--chart-1)" },
    actionClicks: { label: t("actionClicks"), color: "var(--chart-2)" },
  }
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{t("cmsTenantUsage")}</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? <EmptyChart label={t("noData")} /> : (
          <ChartContainer config={chartConfig} className="h-[300px] min-w-0 w-full">
            <BarChart data={rows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="tenant" tickLine={false} axisLine={false} interval={0} tickMargin={8} tickFormatter={categoryTickFormatter(rows.length)} />
              <YAxis width={32} tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip cursor={true} content={<ChartTooltipContent />} />
              <Bar dataKey="routeViews" fill="var(--color-routeViews)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actionClicks" fill="var(--color-actionClicks)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

const tickLimitForRows = (rows: number) => {
  if (rows <= 2) return 22
  if (rows <= 4) return 18
  if (rows <= 6) return 14
  return 10
}

const categoryTickFormatter = (rows: number) => (value: unknown) => truncateTick(value, tickLimitForRows(rows))

type AdminChartLabels = {
  eventVolume: string
  event: string
  count: string
  noData: string
  cmsRoutes?: string
  route?: string
  users?: string
  direct?: string
  internal?: string
  external?: string
  cmsActions?: string
  action?: string
  clicks?: string
  cmsDevices?: string
  device?: string
  routeViews?: string
  actionClicks?: string
  editorOpens?: string
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
      {label}
    </div>
  )
}

export function TenantPerformanceChart({ data }: { data: TenantPerformanceMetric[] }) {
  const t = useTranslations("adminAnalytics")
  const chartConfig: ChartConfig = {
    visitors: { label: t("visitors"), color: "var(--chart-2)" },
    conversions: { label: t("conversions"), color: "var(--chart-3)" },
  }
  const rows = data.slice(0, 8).map((row) => ({
    tenant: row.siteKind === "platform" ? row.siteDomain ?? t("platformSite") : row.tenantSlug ?? row.siteDomain ?? row.tenantId ?? t("unknownTenant"),
    visitors: row.visitors,
    conversions: row.conversions,
  }))
  const tickFormatter = categoryTickFormatter(rows.length)

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{t("tenantPerformance")}</CardTitle></CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] min-w-0 w-full">
          <BarChart data={rows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="tenant" tickLine={false} axisLine={false} interval={0} tickMargin={8} tickFormatter={tickFormatter} />
            <YAxis width={32} tickLine={false} axisLine={false} allowDecimals={false} />
            <ChartTooltip cursor={true} content={<ChartTooltipContent />} />
            <Bar dataKey="visitors" fill="var(--color-visitors)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="conversions" fill="var(--color-conversions)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

export function DeviceDonutChart({ data }: { data: DeviceMetric[] }) {
  const t = useTranslations("adminAnalytics")
  const chartConfig = useMemo<ChartConfig>(() => {
    const entries = data.map((row, index) => [
      row.deviceType,
      { label: row.deviceType, color: PIE_COLORS[index % PIE_COLORS.length] },
    ])
    return Object.fromEntries(entries)
  }, [data])

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{t("deviceSplit")}</CardTitle></CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="mx-auto h-[240px] min-w-0 w-full max-w-[360px]">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="deviceType" hideLabel />} />
            <Pie data={data} dataKey="visitors" nameKey="deviceType" innerRadius={56} outerRadius={88} paddingAngle={2}>
              {data.map((row, index) => (
                <Cell key={row.deviceType} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export function SourceBarChart({ data }: { data: TrafficSourceMetric[] }) {
  const t = useTranslations("adminAnalytics")
  const chartConfig: ChartConfig = {
    visitors: { label: t("visitors"), color: "var(--chart-2)" },
  }
  const rows = data.slice(0, 8)
  const tickFormatter = categoryTickFormatter(rows.length)

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{t("trafficSources")}</CardTitle></CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[240px] min-w-0 w-full">
          <BarChart data={rows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="source" tickLine={false} axisLine={false} interval={0} tickMargin={8} tickFormatter={tickFormatter} />
            <YAxis width={32} tickLine={false} axisLine={false} allowDecimals={false} />
            <ChartTooltip cursor={true} content={<ChartTooltipContent />} />
            <Bar dataKey="visitors" fill="var(--color-visitors)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export function EventVolumeBarChart({ rows, labels }: { rows: EventVolumeMetric[]; labels: AdminChartLabels }) {
  const data = rows.slice(0, 8)
  const tickFormatter = categoryTickFormatter(data.length)
  const chartConfig: ChartConfig = {
    count: { label: labels.count, color: "var(--chart-1)" },
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.eventVolume}</CardTitle></CardHeader>
      <CardContent>
        {data.length === 0 ? <EmptyChart label={labels.noData} /> : (
          <ChartContainer config={chartConfig} className="h-[260px] min-w-0 w-full">
            <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="event" tickLine={false} axisLine={false} interval={0} tickMargin={8} tickFormatter={tickFormatter} />
              <YAxis width={32} tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip cursor={true} content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function CmsRouteStackedBarChart({ rows, labels }: { rows: CmsRouteMetric[]; labels: AdminChartLabels }) {
  const data = rows.slice(0, 6)
  const tickFormatter = categoryTickFormatter(data.length)
  const chartConfig: ChartConfig = {
    direct: { label: labels.direct ?? "Direct", color: "var(--chart-1)" },
    internal: { label: labels.internal ?? "Internal", color: "var(--chart-2)" },
    external: { label: labels.external ?? "External", color: "var(--chart-3)" },
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.cmsRoutes}</CardTitle></CardHeader>
      <CardContent>
        {data.length === 0 ? <EmptyChart label={labels.noData} /> : (
          <ChartContainer config={chartConfig} className="h-[280px] min-w-0 w-full">
            <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="route" tickLine={false} axisLine={false} interval={0} tickMargin={8} tickFormatter={tickFormatter} />
              <YAxis width={32} tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip cursor={true} content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="direct" stackId="route" fill="var(--color-direct)" radius={[0, 0, 4, 4]} />
              <Bar dataKey="internal" stackId="route" fill="var(--color-internal)" />
              <Bar dataKey="external" stackId="route" fill="var(--color-external)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function CmsActionBarChart({ rows, labels }: { rows: CmsActionMetric[]; labels: AdminChartLabels }) {
  const data = rows.slice(0, 8)
  const tickFormatter = categoryTickFormatter(data.length)
  const chartConfig: ChartConfig = {
    clicks: { label: labels.clicks ?? "Clicks", color: "var(--chart-2)" },
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.cmsActions}</CardTitle></CardHeader>
      <CardContent>
        {data.length === 0 ? <EmptyChart label={labels.noData} /> : (
          <ChartContainer config={chartConfig} className="h-[260px] min-w-0 w-full">
            <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="action" tickLine={false} axisLine={false} interval={0} tickMargin={8} tickFormatter={tickFormatter} />
              <YAxis width={32} tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip cursor={true} content={<ChartTooltipContent />} />
              <Bar dataKey="clicks" fill="var(--color-clicks)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function CmsDeviceBarChart({ rows, labels }: { rows: CmsDeviceMetric[]; labels: AdminChartLabels }) {
  const data = rows.slice(0, 6)
  const tickFormatter = categoryTickFormatter(data.length)
  const chartConfig: ChartConfig = {
    routeViews: { label: labels.routeViews ?? "Route views", color: "var(--chart-1)" },
    actionClicks: { label: labels.actionClicks ?? "Action clicks", color: "var(--chart-2)" },
    editorOpens: { label: labels.editorOpens ?? "Editor opens", color: "var(--chart-3)" },
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.cmsDevices}</CardTitle></CardHeader>
      <CardContent>
        {data.length === 0 ? <EmptyChart label={labels.noData} /> : (
          <ChartContainer config={chartConfig} className="h-[260px] min-w-0 w-full">
            <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="deviceType" tickLine={false} axisLine={false} interval={0} tickMargin={8} tickFormatter={tickFormatter} />
              <YAxis width={32} tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip cursor={true} content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="routeViews" fill="var(--color-routeViews)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actionClicks" fill="var(--color-actionClicks)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="editorOpens" fill="var(--color-editorOpens)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
