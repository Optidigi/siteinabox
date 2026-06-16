"use client"

import { useMemo, useState } from "react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { AreaChartIcon, BarChart3, LineChartIcon, Settings2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { ClientOnlyChartContainer as ChartContainer } from "@/components/analytics/ClientOnlyChartContainer"
import { ChartTooltip, ChartTooltipContent, type ChartConfig } from "@siteinabox/ui/components/chart"
import { Button } from "@siteinabox/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@siteinabox/ui/components/dropdown-menu"
import type { TrafficSeriesPoint } from "@/lib/analytics/queries"

type TrafficMetric = "pageviews" | "visitors"
type TrafficChartType = "area" | "line" | "bar"

export function TrafficChart({ data }: { data: TrafficSeriesPoint[] }) {
  const t = useTranslations("analytics")
  const [chartType, setChartType] = useState<TrafficChartType>("area")
  const [metrics, setMetrics] = useState<TrafficMetric[]>(["pageviews", "visitors"])
  const chartConfig: ChartConfig = {
    pageviews: { label: t("pageviews"), color: "var(--chart-1)" },
    visitors: { label: t("visitors"), color: "var(--chart-2)" },
  }
  const activeMetrics = metrics.length > 0 ? metrics : (["pageviews"] satisfies TrafficMetric[])
  const visibleData = useMemo(() => data.map((row) => ({
    date: row.date,
    pageviews: activeMetrics.includes("pageviews") ? row.pageviews : undefined,
    visitors: activeMetrics.includes("visitors") ? row.visitors : undefined,
  })), [activeMetrics, data])

  const toggleMetric = (metric: TrafficMetric) => {
    setMetrics((current) => {
      if (current.includes(metric)) {
        return current.length === 1 ? current : current.filter((item) => item !== metric)
      }
      return [...current, metric]
    })
  }

  const chartTypes = [
    { value: "area" as const, label: t("chartArea"), icon: AreaChartIcon },
    { value: "line" as const, label: t("chartLine"), icon: LineChartIcon },
    { value: "bar" as const, label: t("chartBar"), icon: BarChart3 },
  ]

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">{t("trafficTrend")}</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="icon" variant="outline" aria-label="Configure chart">
                <Settings2 className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>{t("chartType")}</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={chartType} onValueChange={(value) => setChartType(value as TrafficChartType)}>
                {chartTypes.map((option) => {
                  const Icon = option.icon
                  return (
                    <DropdownMenuRadioItem key={option.value} value={option.value}>
                      <Icon className="size-4" aria-hidden />
                      {option.label}
                    </DropdownMenuRadioItem>
                  )
                })}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{t("chartMetrics")}</DropdownMenuLabel>
              {(["pageviews", "visitors"] as const).map((metric) => (
                <DropdownMenuCheckboxItem
                  key={metric}
                  checked={activeMetrics.includes(metric)}
                  disabled={activeMetrics.includes(metric) && activeMetrics.length === 1}
                  onCheckedChange={() => toggleMetric(metric)}
                >
                  {metric === "pageviews" ? t("pageviews") : t("visitors")}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[260px] min-w-0 w-full">
          {chartType === "area" ? (
            <AreaChart data={visibleData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="fillPageviews" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.42} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fillVisitors" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.32} />
                  <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} interval="preserveStartEnd" tickFormatter={(v) => String(v).slice(5)} />
              <YAxis width={32} tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip cursor={true} content={<ChartTooltipContent />} />
              {activeMetrics.includes("pageviews") && <Area type="monotone" dataKey="pageviews" stroke="var(--chart-1)" fill="url(#fillPageviews)" strokeWidth={1.5} />}
              {activeMetrics.includes("visitors") && <Area type="monotone" dataKey="visitors" stroke="var(--chart-2)" fill="url(#fillVisitors)" strokeWidth={1.5} />}
            </AreaChart>
          ) : chartType === "line" ? (
            <LineChart data={visibleData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} interval="preserveStartEnd" tickFormatter={(v) => String(v).slice(5)} />
              <YAxis width={32} tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip cursor={true} content={<ChartTooltipContent />} />
              {activeMetrics.includes("pageviews") && <Line type="monotone" dataKey="pageviews" stroke="var(--chart-1)" strokeWidth={2} dot={false} />}
              {activeMetrics.includes("visitors") && <Line type="monotone" dataKey="visitors" stroke="var(--chart-2)" strokeWidth={2} dot={false} />}
            </LineChart>
          ) : (
            <BarChart data={visibleData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} interval="preserveStartEnd" tickFormatter={(v) => String(v).slice(5)} />
              <YAxis width={32} tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip cursor={true} content={<ChartTooltipContent />} />
              {activeMetrics.includes("pageviews") && <Bar dataKey="pageviews" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />}
              {activeMetrics.includes("visitors") && <Bar dataKey="visitors" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />}
            </BarChart>
          )}
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
