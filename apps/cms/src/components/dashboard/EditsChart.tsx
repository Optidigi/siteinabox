"use client"
import { useTranslations } from "next-intl"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { ClientOnlyChartContainer as ChartContainer } from "@/components/analytics/ClientOnlyChartContainer"
import { type ChartConfig, ChartTooltip, ChartTooltipContent } from "@siteinabox/ui/components/chart"

export function EditsChart({ data }: { data: { date: string; count: number }[] }) {
  const t = useTranslations("dashboard")
  const chartConfig: ChartConfig = {
    count: { label: t("editsThisWeek"), color: "var(--chart-1)" }
  }
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{t("editsLast7Days")}</CardTitle></CardHeader>
      <CardContent>
        <div className="hidden min-w-0 sm:block">
          <ChartContainer config={chartConfig} className="h-[260px] min-w-0 w-full">
            <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} interval={0} tickFormatter={(v) => v.slice(5)} />
              <YAxis width={32} tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip cursor={true} content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
        <div className="grid gap-2 sm:hidden">
          {data.map((row) => (
            <div key={row.date} className="flex items-center justify-between gap-3 border-b py-2 text-xs last:border-b-0">
              <span className="text-muted-foreground">{row.date.slice(5)}</span>
              <span className="shrink-0 text-right tabular-nums">{row.count}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
