"use client"

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { ClientOnlyChartContainer as ChartContainer } from "@/components/analytics/ClientOnlyChartContainer"
import { ChartTooltip, ChartTooltipContent, type ChartConfig } from "@siteinabox/ui/components/chart"
import { Table, TableBody, TableCell, TableRow } from "@siteinabox/ui/components/table"
import type { CmsUsageOverview } from "@/lib/analytics/queries"

type Labels = {
  title: string
  volumeTitle: string
  deviceTitle: string
  activeUsers: string
  dashboardViews: string
  routeViews: string
  actionClicks: string
  editorOpens: string
  pageSaves: string
  mediaUploads: string
  receivedSubmissions: string
  desktop: string
  mobile: string
  noData: string
}

const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)"]
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

export function CmsUsageCharts({
  usage,
  labels,
}: {
  usage: CmsUsageOverview
  labels: Labels
}) {
  const volumeRows = [
    { metric: labels.dashboardViews, value: usage.dashboardViews },
    { metric: labels.routeViews, value: usage.routeViews },
    { metric: labels.actionClicks, value: usage.actionClicks },
    { metric: labels.editorOpens, value: usage.editorOpens },
    { metric: labels.pageSaves, value: usage.pageSaves },
    { metric: labels.mediaUploads, value: usage.mediaUploads },
    { metric: labels.receivedSubmissions, value: usage.receivedSubmissions },
  ]
  const volumeTickFormatter = categoryTickFormatter(volumeRows.length)
  const deviceRows = [
    { device: labels.desktop, value: usage.editorOpensDesktop },
    { device: labels.mobile, value: usage.editorOpensMobile },
  ].filter((row) => row.value > 0)
  const volumeConfig: ChartConfig = {
    value: { label: labels.title, color: "var(--chart-1)" },
  }
  const deviceConfig: ChartConfig = {
    desktop: { label: labels.desktop, color: PIE_COLORS[0] },
    mobile: { label: labels.mobile, color: PIE_COLORS[1] },
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{labels.volumeTitle}</CardTitle>
          <p className="text-sm text-muted-foreground">{labels.activeUsers}: {usage.activeUsers}</p>
        </CardHeader>
        <CardContent>
          <div className="hidden min-w-0 sm:block">
            <ChartContainer config={volumeConfig} className="h-[300px] min-w-0 w-full">
              <BarChart data={volumeRows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="metric" tickLine={false} axisLine={false} interval={0} tickMargin={8} tickFormatter={volumeTickFormatter} />
                <YAxis width={32} tickLine={false} axisLine={false} allowDecimals={false} />
                <ChartTooltip cursor={true} content={<ChartTooltipContent />} />
                <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
          <div className="grid gap-2 sm:hidden">
            {volumeRows.map((row) => (
              <div key={row.metric} className="flex items-center justify-between gap-3 border-b py-2 text-xs last:border-b-0">
                <span className="min-w-0 truncate text-muted-foreground">{row.metric}</span>
                <span className="shrink-0 text-right tabular-nums">{row.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t pt-2">
            <Table>
              <TableBody>
                {volumeRows.map((row) => (
                  <TableRow key={row.metric}>
                    <TableCell className="font-medium">{row.metric}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">{labels.deviceTitle}</CardTitle></CardHeader>
        <CardContent>
          {deviceRows.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
              {labels.noData}
            </div>
          ) : (
            <ChartContainer config={deviceConfig} className="mx-auto h-[260px] min-w-0 w-full max-w-[360px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="device" hideLabel />} />
                <Pie data={deviceRows} dataKey="value" nameKey="device" innerRadius={58} outerRadius={92} paddingAngle={2}>
                  {deviceRows.map((row, index) => (
                    <Cell key={row.device} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          )}
          {deviceRows.length > 0 && (
            <div className="mt-4 border-t pt-2">
              <Table>
                <TableBody>
                  {deviceRows.map((row) => (
                    <TableRow key={row.device}>
                      <TableCell className="font-medium">{row.device}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.value}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
