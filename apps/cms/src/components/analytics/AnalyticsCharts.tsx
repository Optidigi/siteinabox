"use client"

import { useMemo } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  XAxis,
  YAxis,
} from "recharts"
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
  ComponentExposureMetric,
  ComponentPerformanceMetric,
  DeviceMetric,
  FormFunnelMetric,
  JourneyStepMetric,
  ScrollDepthMetric,
  SectionPerformanceMetric,
  TopPageMetric,
  TrafficSourceMetric,
  WebVitalMetric,
} from "@/lib/analytics/queries"

type ChartLabels = {
  topPages: string
  page: string
  views: string
  visitors: string
  conversions: string
  conversionRate: string
  noData: string
  sectionPerformance: string
  section: string
  engagements: string
  ctaClicks: string
  emptyValue: string
  formFunnel: string
  started: string
  submitted: string
  accepted: string
  trafficSources: string
  source: string
  deviceSplit: string
  device: string
  componentPerformance?: string
  component?: string
  componentRole?: string
  interactions?: string
  interactionRate?: string
  webVitals?: string
  webPerformanceScore?: string
  rating?: string
  avgValue?: string
  journeySteps?: string
  step?: string
  scrollDepth?: string
  depth?: string
  events?: string
}

const SERIES = {
  pageviews: "var(--chart-1)",
  visitors: "var(--chart-2)",
  conversions: "var(--chart-3)",
  actions: "var(--chart-4)",
  secondary: "var(--chart-5)",
} as const

const PIE_COLORS = [SERIES.pageviews, SERIES.visitors, SERIES.conversions, SERIES.actions, SERIES.secondary]

const pct = (value: number) => `${Math.round(value * 1000) / 10}%`
const truncateTick = (value: unknown, max = 14) => {
  const text = String(value ?? "")
  return text.length > max ? `${text.slice(0, max)}...` : text
}

const tickLimitForRows = (rows: number) => {
  if (rows <= 2) return 22
  if (rows <= 4) return 18
  if (rows <= 6) return 14
  return 10
}

const categoryTickFormatter = (rows: number) => (value: unknown) => truncateTick(value, tickLimitForRows(rows))

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
      {label}
    </div>
  )
}

export function TopPagesBarChart({ rows, labels }: { rows: TopPageMetric[]; labels: ChartLabels }) {
  const data = rows.slice(0, 6).map((row) => ({
    page: row.pagePath,
    pageviews: row.pageviews,
    visitors: row.visitors,
    conversions: row.conversions,
  }))
  const tickFormatter = categoryTickFormatter(data.length)
  const chartConfig: ChartConfig = {
    pageviews: { label: labels.views, color: SERIES.pageviews },
    visitors: { label: labels.visitors, color: SERIES.visitors },
    conversions: { label: labels.conversions, color: SERIES.conversions },
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.topPages}</CardTitle></CardHeader>
      <CardContent>
        {data.length === 0 ? <EmptyChart label={labels.noData} /> : (
          <ChartContainer config={chartConfig} className="h-[300px] min-w-0 w-full">
            <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="page" tickLine={false} axisLine={false} interval={0} tickMargin={8} tickFormatter={tickFormatter} />
              <YAxis width={32} tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip cursor content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="pageviews" fill="var(--color-pageviews)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="visitors" fill="var(--color-visitors)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="conversions" fill="var(--color-conversions)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function TrafficSourcesPieChart({ rows, labels }: { rows: TrafficSourceMetric[]; labels: ChartLabels }) {
  const data = rows.slice(0, 5)
  const chartConfig = useMemo<ChartConfig>(() => {
    return Object.fromEntries(data.map((row, index) => [
      row.source,
      { label: row.source, color: PIE_COLORS[index % PIE_COLORS.length] },
    ]))
  }, [data])

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.trafficSources}</CardTitle></CardHeader>
      <CardContent>
        {data.length === 0 ? <EmptyChart label={labels.noData} /> : (
          <ChartContainer config={chartConfig} className="mx-auto h-[260px] min-w-0 w-full max-w-[380px]">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="source" hideLabel />} />
              <Pie data={data} dataKey="visitors" nameKey="source" innerRadius={58} outerRadius={92} paddingAngle={2}>
                {data.map((row, index) => (
                  <Cell key={`${row.source}:${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="source" />} />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function DeviceDonutChart({ rows, labels }: { rows: DeviceMetric[]; labels: ChartLabels }) {
  const data = rows.slice(0, 5)
  const chartConfig = useMemo<ChartConfig>(() => {
    return Object.fromEntries(data.map((row, index) => [
      row.deviceType,
      { label: row.deviceType, color: PIE_COLORS[index % PIE_COLORS.length] },
    ]))
  }, [data])

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.deviceSplit}</CardTitle></CardHeader>
      <CardContent>
        {data.length === 0 ? <EmptyChart label={labels.noData} /> : (
          <ChartContainer config={chartConfig} className="mx-auto h-[260px] min-w-0 w-full max-w-[380px]">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="deviceType" hideLabel />} />
              <Pie data={data} dataKey="visitors" nameKey="deviceType" innerRadius={58} outerRadius={92} paddingAngle={2}>
                {data.map((row, index) => (
                  <Cell key={row.deviceType} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="deviceType" />} />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function ComponentRadarChart({ rows, labels }: { rows: ComponentPerformanceMetric[]; labels: ChartLabels }) {
  const data = rows.slice(0, 6).map((row) => ({
    component: row.componentRole ?? row.componentType ?? row.sectionType ?? labels.emptyValue,
    interactions: row.interactions,
    visitors: row.visitors,
  }))
  const tickFormatter = categoryTickFormatter(data.length)
  const chartConfig: ChartConfig = {
    visitors: { label: labels.visitors, color: SERIES.visitors },
    interactions: { label: labels.interactions, color: SERIES.actions },
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.componentPerformance}</CardTitle></CardHeader>
      <CardContent>
        {data.length === 0 ? <EmptyChart label={labels.noData} /> : (
          <ChartContainer config={chartConfig} className="mx-auto h-[260px] min-w-0 w-full max-w-[420px]">
            <RadarChart data={data}>
              <PolarGrid />
              <PolarAngleAxis dataKey="component" tickFormatter={tickFormatter} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Radar dataKey="interactions" fill="var(--color-interactions)" fillOpacity={0.18} stroke="var(--color-interactions)" />
              <Radar dataKey="visitors" fill="var(--color-visitors)" fillOpacity={0.24} stroke="var(--color-visitors)" />
              <ChartLegend content={<ChartLegendContent />} />
            </RadarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function ComponentExposureBarChart({ rows, labels }: { rows: ComponentExposureMetric[]; labels: ChartLabels }) {
  const data = rows.slice(0, 8).map((row) => ({
    component: row.label ?? row.role ?? row.sectionType ?? labels.emptyValue,
    views: row.views,
    interactions: row.interactions,
  }))
  const tickFormatter = categoryTickFormatter(data.length)
  const chartConfig: ChartConfig = {
    views: { label: labels.views, color: SERIES.pageviews },
    interactions: { label: labels.interactions, color: SERIES.actions },
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.componentPerformance}</CardTitle></CardHeader>
      <CardContent>
        {data.length === 0 ? <EmptyChart label={labels.noData} /> : (
          <ChartContainer config={chartConfig} className="h-[280px] min-w-0 w-full">
            <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="component" tickLine={false} axisLine={false} interval={0} tickMargin={8} tickFormatter={tickFormatter} />
              <YAxis width={32} tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip cursor content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="views" fill="var(--color-views)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="interactions" fill="var(--color-interactions)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function WebVitalsBarChart({ rows, labels }: { rows: WebVitalMetric[]; labels: ChartLabels }) {
  const data = rows.slice(0, 8).map((row) => ({
    vital: `${row.name}${row.rating ? ` ${row.rating}` : ""}`,
    avgValue: row.avgValue,
    maxValue: row.maxValue,
  }))
  const tickFormatter = categoryTickFormatter(data.length)
  const chartConfig: ChartConfig = {
    avgValue: { label: labels.avgValue, color: SERIES.visitors },
    maxValue: { label: labels.events, color: SERIES.secondary },
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.webVitals}</CardTitle></CardHeader>
      <CardContent>
        {data.length === 0 ? <EmptyChart label={labels.noData} /> : (
          <ChartContainer config={chartConfig} className="h-[280px] min-w-0 w-full">
            <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="vital" tickLine={false} axisLine={false} interval={0} tickMargin={8} tickFormatter={tickFormatter} />
              <YAxis width={42} tickLine={false} axisLine={false} allowDecimals />
              <ChartTooltip cursor content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="avgValue" fill="var(--color-avgValue)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="maxValue" fill="var(--color-maxValue)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function WebVitalsScoreChart({ rows, labels }: { rows: WebVitalMetric[]; labels: ChartLabels }) {
  const data = rows.slice(0, 5).map((row) => ({
    vital: row.name,
    score: row.score,
    rating: row.rating ?? labels.emptyValue,
    samples: row.samples,
  }))
  const tickFormatter = categoryTickFormatter(data.length)
  const chartConfig: ChartConfig = {
    score: { label: labels.webPerformanceScore ?? labels.rating, color: SERIES.conversions },
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.webPerformanceScore ?? labels.webVitals}</CardTitle></CardHeader>
      <CardContent>
        {data.length === 0 ? <EmptyChart label={labels.noData} /> : (
          <ChartContainer config={chartConfig} className="h-[260px] min-w-0 w-full">
            <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="vital" tickLine={false} axisLine={false} interval={0} tickMargin={8} tickFormatter={tickFormatter} />
              <YAxis width={32} domain={[0, 100]} tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip cursor content={<ChartTooltipContent />} />
              <Bar dataKey="score" fill="var(--color-score)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function FormFunnelRadialChart({ funnel, labels }: { funnel: FormFunnelMetric; labels: ChartLabels }) {
  const data = [
    { name: labels.started, value: funnel.started, fill: SERIES.pageviews },
    { name: labels.submitted, value: funnel.submitted, fill: SERIES.visitors },
    { name: labels.accepted, value: funnel.accepted, fill: SERIES.conversions },
  ]
  const total = funnel.started
  const chartConfig: ChartConfig = {
    started: { label: labels.started, color: SERIES.pageviews },
    submitted: { label: labels.submitted, color: SERIES.visitors },
    accepted: { label: labels.accepted, color: SERIES.conversions },
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.formFunnel}</CardTitle></CardHeader>
      <CardContent>
        {total === 0 ? <EmptyChart label={labels.noData} /> : (
          <ChartContainer config={chartConfig} className="mx-auto h-[260px] min-w-0 w-full max-w-[360px]">
            <RadialBarChart data={data} innerRadius={46} outerRadius={110} startAngle={90} endAngle={-270}>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
              <RadialBar dataKey="value" background cornerRadius={6} />
              <PolarRadiusAxis tick={false} tickLine={false} axisLine={false} />
              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                <tspan x="50%" className="fill-foreground text-xl font-semibold">{pct(funnel.submitRate)}</tspan>
                <tspan x="50%" dy={18} className="fill-muted-foreground text-xs">{labels.conversionRate}</tspan>
              </text>
              <ChartLegend content={<ChartLegendContent />} />
            </RadialBarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function JourneyLineChart({
  journeySteps,
  scrollDepth,
  labels,
}: {
  journeySteps: JourneyStepMetric[]
  scrollDepth: ScrollDepthMetric[]
  labels: ChartLabels
}) {
  const journeyData = journeySteps.slice(0, 8).map((row) => ({
    point: row.step ?? `${labels.step ?? ""} ${row.stepIndex}`.trim(),
    events: row.count,
    visitors: row.visitors,
  }))
  const scrollData = scrollDepth.slice(0, 8).map((row) => ({
    point: `${row.depth}%`,
    events: row.events,
    visitors: row.visitors,
  }))
  const data = journeyData.length > 0 ? journeyData : scrollData
  const tickFormatter = categoryTickFormatter(data.length)
  const title = journeyData.length > 0 ? labels.journeySteps : labels.scrollDepth
  const chartConfig: ChartConfig = {
    events: { label: labels.events, color: SERIES.actions },
    visitors: { label: labels.visitors, color: SERIES.visitors },
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {data.length === 0 ? <EmptyChart label={labels.noData} /> : (
          <ChartContainer config={chartConfig} className="h-[260px] min-w-0 w-full">
            <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="point" tickLine={false} axisLine={false} interval={0} tickMargin={8} tickFormatter={tickFormatter} />
              <YAxis width={32} tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip cursor content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line type="monotone" dataKey="events" stroke="var(--color-events)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="visitors" stroke="var(--color-visitors)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function SectionStackedBarChart({ rows, labels }: { rows: SectionPerformanceMetric[]; labels: ChartLabels }) {
  const data = rows.slice(0, 6).map((row) => ({
    section: row.sectionType ?? row.sectionId ?? labels.emptyValue,
    views: row.views,
    engagements: row.engagements,
    ctaClicks: row.ctaClicks,
  }))
  const tickFormatter = categoryTickFormatter(data.length)
  const chartConfig: ChartConfig = {
    views: { label: labels.views, color: SERIES.pageviews },
    engagements: { label: labels.engagements, color: SERIES.actions },
    ctaClicks: { label: labels.ctaClicks, color: SERIES.conversions },
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.sectionPerformance}</CardTitle></CardHeader>
      <CardContent>
        {data.length === 0 ? <EmptyChart label={labels.noData} /> : (
          <ChartContainer config={chartConfig} className="h-[280px] min-w-0 w-full">
            <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="section" tickLine={false} axisLine={false} interval={0} tickMargin={8} tickFormatter={tickFormatter} />
              <YAxis width={32} tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip cursor content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="views" stackId="section" fill="var(--color-views)" radius={[0, 0, 4, 4]} />
              <Bar dataKey="engagements" stackId="section" fill="var(--color-engagements)" />
              <Bar dataKey="ctaClicks" stackId="section" fill="var(--color-ctaClicks)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
