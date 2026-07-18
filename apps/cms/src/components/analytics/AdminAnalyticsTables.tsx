import Link from "next/link"
import type { ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@siteinabox/ui/components/table"
import type { CmsActionMetric, CmsDeviceMetric, CmsRouteMetric, CmsTenantUsageMetric, EventVolumeMetric, TenantPerformanceMetric, TenantWebVitalsMetric } from "@/lib/analytics/queries"

const pct = (value: number) => `${Math.round(value * 1000) / 10}%`
const ms = (value: number | null) => value == null ? "-" : `${Math.round(value)} ms`
const cls = (value: number | null) => value == null ? "-" : value.toFixed(3)

type Labels = {
  tenantPerformance: string
  eventVolume: string
  tenant: string
  domain: string
  visitors: string
  pageviews: string
  conversions: string
  conversionRate: string
  ctaClicks: string
  acceptedForms: string
  event: string
  count: string
  noData: string
  emptyValue: string
  unknownTenant: string
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
  cmsTenantUsage?: string
  activeUsers?: string
  pageSaves?: string
  webVitals?: string
  webPerformanceScore?: string
  samples?: string
}

export function CmsTenantUsageTable({ rows, labels }: { rows: CmsTenantUsageMetric[]; labels: Labels }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.cmsTenantUsage}</CardTitle></CardHeader>
      <CardContent className="grid gap-2">
        {rows.length === 0 ? (
          <div className="flex h-20 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">{labels.noData}</div>
        ) : rows.map((row) => (
          <div key={row.tenantId} className="grid gap-3 rounded-md border border-border p-3">
            <div className="min-w-0">
              {row.tenantSlug
                ? <Link className="truncate text-sm font-medium underline underline-offset-4" href={`/analytics?tenantId=${encodeURIComponent(row.tenantId)}&view=cms`}>{row.tenantSlug}</Link>
                : <div className="truncate text-sm font-medium">{row.tenantId}</div>}
              <div className="truncate text-xs text-muted-foreground">{row.siteDomain ?? labels.emptyValue}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm @min-[44rem]/site-frame:grid-cols-5">
              <Metric label={labels.activeUsers ?? "Active users"} value={row.activeUsers} />
              <Metric label={labels.routeViews ?? "Screen views"} value={row.routeViews} />
              <Metric label={labels.actionClicks ?? "Action clicks"} value={row.actionClicks} />
              <Metric label={labels.editorOpens ?? "Editor opens"} value={row.editorOpens} />
              <Metric label={labels.pageSaves ?? "Page saves"} value={row.pageSaves} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function TenantPerformanceTable({
  rows,
  labels,
}: {
  rows: TenantPerformanceMetric[]
  labels: Labels
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.tenantPerformance}</CardTitle></CardHeader>
      <CardContent className="grid gap-2">
        {rows.length === 0 ? (
          <div className="flex h-20 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">{labels.noData}</div>
        ) : rows.map((row, index) => {
              const tenantLabel = row.siteKind === "platform" ? row.siteDomain ?? "Site in a Box" : row.tenantSlug ?? row.tenantId ?? labels.unknownTenant
              const tenantCell = row.siteKind === "tenant" && row.tenantSlug
                ? <Link className="underline underline-offset-4" href={`/sites/${row.tenantSlug}/analytics`}>{tenantLabel}</Link>
                : tenantLabel
              return (
                <div key={`${row.tenantId}:${row.siteDomain}:${index}`} className="grid gap-3 rounded-md border border-border p-3">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{tenantCell}</div>
                      <div className="truncate text-xs text-muted-foreground">{row.siteDomain ?? labels.emptyValue}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-medium">{pct(row.conversionRate)}</div>
                      <div className="text-xs text-muted-foreground">{labels.conversionRate}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm @min-[44rem]/site-frame:grid-cols-5">
                    <Metric label={labels.visitors} value={row.visitors} />
                    <Metric label={labels.pageviews} value={row.pageviews} />
                    <Metric label={labels.conversions} value={row.conversions} />
                    <Metric label={labels.ctaClicks} value={row.ctaClicks} />
                    <Metric label={labels.acceptedForms} value={row.acceptedForms} />
                  </div>
                </div>
              )
            })}
      </CardContent>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-md bg-muted/40 px-3 py-2">
      <div className="truncate text-xs text-muted-foreground">{label}</div>
      <div className="truncate font-medium">{value}</div>
    </div>
  )
}

export function TenantWebVitalsTable({
  rows,
  labels,
}: {
  rows: TenantWebVitalsMetric[]
  labels: Labels
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.webVitals ?? "Web Vitals by site"}</CardTitle></CardHeader>
      <CardContent className="grid gap-2">
        {rows.length === 0 ? (
          <div className="flex h-20 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">{labels.noData}</div>
        ) : rows.map((row, index) => {
          const tenantLabel = row.tenantSlug ?? row.tenantId ?? labels.unknownTenant
          const tenantCell = row.tenantSlug
            ? <Link className="underline underline-offset-4" href={`/sites/${row.tenantSlug}/analytics?view=behavior`}>{tenantLabel}</Link>
            : tenantLabel
          return (
            <div key={`${row.tenantId}:${row.siteDomain}:${index}`} className="grid gap-3 rounded-md border border-border p-3">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{tenantCell}</div>
                  <div className="truncate text-xs text-muted-foreground">{row.siteDomain ?? labels.emptyValue}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-medium">{row.score ?? labels.emptyValue}</div>
                  <div className="text-xs text-muted-foreground">{labels.webPerformanceScore ?? "Performance score"}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm @min-[44rem]/site-frame:grid-cols-5">
                <Metric label={labels.samples ?? "Samples"} value={row.samples} />
                <Metric label="LCP" value={ms(row.lcpAvg)} />
                <Metric label="INP" value={ms(row.inpAvg)} />
                <Metric label="CLS" value={cls(row.clsAvg)} />
                <Metric label="FCP" value={ms(row.fcpAvg)} />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

export function CmsRouteMetricsTable({
  rows,
  labels,
}: {
  rows: CmsRouteMetric[]
  labels: Labels
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.cmsRoutes}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.route}</TableHead>
              <TableHead>{labels.pageviews}</TableHead>
              <TableHead>{labels.users}</TableHead>
              <TableHead>{labels.direct}</TableHead>
              <TableHead>{labels.internal}</TableHead>
              <TableHead>{labels.external}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="h-20 text-center text-muted-foreground">{labels.noData}</TableCell></TableRow>
            ) : rows.map((row) => (
              <TableRow key={row.route}>
                <TableCell className="font-medium">{row.route}</TableCell>
                <TableCell>{row.views}</TableCell>
                <TableCell>{row.users}</TableCell>
                <TableCell>{row.direct}</TableCell>
                <TableCell>{row.internal}</TableCell>
                <TableCell>{row.external}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function CmsActionMetricsTable({
  rows,
  labels,
}: {
  rows: CmsActionMetric[]
  labels: Labels
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.cmsActions}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.action}</TableHead>
              <TableHead>{labels.clicks}</TableHead>
              <TableHead>{labels.users}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="h-20 text-center text-muted-foreground">{labels.noData}</TableCell></TableRow>
            ) : rows.map((row) => (
              <TableRow key={row.action}>
                <TableCell className="font-medium">{row.action}</TableCell>
                <TableCell>{row.clicks}</TableCell>
                <TableCell>{row.users}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function CmsDeviceMetricsTable({
  rows,
  labels,
}: {
  rows: CmsDeviceMetric[]
  labels: Labels
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.cmsDevices}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.device}</TableHead>
              <TableHead>{labels.routeViews}</TableHead>
              <TableHead>{labels.actionClicks}</TableHead>
              <TableHead>{labels.editorOpens}</TableHead>
              <TableHead>{labels.users}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="h-20 text-center text-muted-foreground">{labels.noData}</TableCell></TableRow>
            ) : rows.map((row) => (
              <TableRow key={row.deviceType}>
                <TableCell className="font-medium">{row.deviceType}</TableCell>
                <TableCell>{row.routeViews}</TableCell>
                <TableCell>{row.actionClicks}</TableCell>
                <TableCell>{row.editorOpens}</TableCell>
                <TableCell>{row.users}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function EventVolumeTable({
  rows,
  labels,
}: {
  rows: EventVolumeMetric[]
  labels: Labels
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.eventVolume}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.event}</TableHead>
              <TableHead>{labels.count}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={2} className="h-20 text-center text-muted-foreground">{labels.noData}</TableCell></TableRow>
            ) : rows.map((row) => (
              <TableRow key={row.event}>
                <TableCell className="font-medium">{row.event}</TableCell>
                <TableCell>{row.count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
