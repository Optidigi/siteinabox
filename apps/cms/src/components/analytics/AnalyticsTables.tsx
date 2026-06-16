import { Card, CardContent, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { GeoChoroplethMap } from "@/components/analytics/GeoChoroplethMap"
import { Badge } from "@siteinabox/ui/components/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@siteinabox/ui/components/table"
import type {
  AutocaptureFrictionMetric,
  AutocaptureInteractionMetric,
  ComponentExposureMetric,
  ComponentPerformanceMetric,
  DeviceMetric,
  FormFunnelMetric,
  GeoCityMetric,
  GeoCountryMetric,
  JourneyStepMetric,
  ScrollDepthMetric,
  SectionPerformanceMetric,
  TopCtaMetric,
  TopPageMetric,
  TrafficSourceMetric,
  WebVitalMetric,
} from "@/lib/analytics/queries"
import type { SiteQualityScore } from "@/lib/analytics/scoring"

const pct = (value: number) => `${Math.round(value * 1000) / 10}%`
const ms = (value: number) => `${Math.round(value)} ms`

type TableLabels = {
  topPages: string
  page: string
  views: string
  visitors: string
  conversions: string
  conversionRate: string
  noData: string
  ctaPerformance: string
  label: string
  role: string
  targetType: string
  clicks: string
  sectionPerformance: string
  section: string
  engagements: string
  ctaClicks: string
  emptyValue: string
  formFunnel: string
  started: string
  submitted: string
  accepted: string
  submitRate: string
  acceptanceRate: string
  trafficSources: string
  source: string
  sourceType: string
  deviceSplit: string
  device: string
  componentPerformance?: string
  component?: string
  componentRole?: string
  interactions?: string
  interactionRate?: string
  avgVisibleMs?: string
  avgHoverMs?: string
  avgTimeToInteractionMs?: string
  webVitals?: string
  performanceOverview?: string
  overallScore?: string
  scoreUnavailable?: string
  measuredFromVisitors?: string
  lowSampleNotice?: string
  fieldPerformanceExplanation?: string
  siteQualityExplanation?: string
  metricMainContent?: string
  metricResponsiveness?: string
  metricStability?: string
  metricFirstContent?: string
  metricMissing?: string
  ratingGood?: string
  ratingNeedsWork?: string
  ratingPoor?: string
  siteQuality?: string
  siteQualityChecks?: string
  combinedSiteScore?: string
  fieldPerformance?: string
  statusOk?: string
  statusFix?: string
  metric?: string
  rating?: string
  samples?: string
  avgValue?: string
  maxValue?: string
  autocaptureInteractions?: string
  autocaptureFriction?: string
  journeySteps?: string
  step?: string
  stepIndex?: string
  scrollDepth?: string
  depth?: string
  events?: string
  count?: string
  geography?: string
  countries?: string
  cities?: string
  country?: string
  city?: string
  countryCode?: string
  share?: string
}

const countryLabel = (row: GeoCountryMetric, emptyValue: string) =>
  row.countryCode ? `${row.countryName} (${row.countryCode})` : row.countryName || emptyValue

const WEB_VITAL_DISPLAY_ORDER = ["LCP", "INP", "CLS", "FCP"] as const
type StateTone = "success" | "warning" | "destructive" | "neutral"

const scoreLabel = (score: number | null, labels: TableLabels) => {
  if (score == null) return labels.scoreUnavailable ?? labels.emptyValue
  if (score >= 90) return labels.ratingGood ?? "Good"
  if (score >= 50) return labels.ratingNeedsWork ?? "Needs work"
  return labels.ratingPoor ?? "Poor"
}

const ratingLabel = (rating: string | null, labels: TableLabels) => {
  if (rating === "good") return labels.ratingGood ?? "Good"
  if (rating === "needs-improvement") return labels.ratingNeedsWork ?? "Needs work"
  if (rating === "poor") return labels.ratingPoor ?? "Poor"
  return labels.emptyValue
}

const scoreTone = (score: number | null): StateTone => {
  if (score == null) return "neutral"
  if (score >= 90) return "success"
  if (score >= 50) return "warning"
  return "destructive"
}

const ratingTone = (rating: string | null): StateTone => {
  if (rating === "good") return "success"
  if (rating === "needs-improvement") return "warning"
  if (rating === "poor") return "destructive"
  return "neutral"
}

const stateTextClassName = (tone: StateTone) => {
  if (tone === "success") return "text-success"
  if (tone === "warning") return "text-warning"
  if (tone === "destructive") return "text-destructive"
  return "text-muted-foreground"
}

const stateBadgeVariant = (tone: StateTone) => {
  if (tone === "success") return "success"
  if (tone === "warning") return "warning"
  if (tone === "destructive") return "destructive"
  return "secondary"
}

const stateHintClassName = (tone: StateTone) => {
  if (tone === "success") return "bg-success"
  if (tone === "warning") return "bg-warning"
  if (tone === "destructive") return "bg-destructive"
  return "bg-muted"
}

const webVitalPlainLabel = (name: string, labels: TableLabels) => {
  if (name === "LCP") return labels.metricMainContent ?? "Main content loading"
  if (name === "INP") return labels.metricResponsiveness ?? "Interaction responsiveness"
  if (name === "CLS") return labels.metricStability ?? "Visual stability"
  if (name === "FCP") return labels.metricFirstContent ?? "First content appearing"
  return name
}

const formatWebVitalValue = (row: WebVitalMetric) =>
  row.name === "CLS" ? row.avgValue.toFixed(3) : ms(row.avgValue)

function PerformanceScoreTile({
  title,
  score,
  tone,
  label,
  description,
  suffix = "/100",
}: {
  title: string
  score: number | null
  tone: StateTone
  label: string
  description: string
  suffix?: string
}) {
  return (
    <div className="rounded-md border border-border p-4">
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className={`mt-2 h-1 w-8 rounded-full ${stateHintClassName(tone)}`} />
      <div className="mt-2 flex items-end gap-2">
        <div className={`text-3xl font-semibold leading-none ${stateTextClassName(tone)}`}>{score ?? "--"}</div>
        <div className="pb-0.5 text-sm text-muted-foreground">{suffix}</div>
      </div>
      <Badge className="mt-2" variant={stateBadgeVariant(tone)}>{label}</Badge>
      <div className="mt-2 text-xs text-muted-foreground">{description}</div>
    </div>
  )
}

export function PerformanceOverviewCard({
  webVitals,
  siteQuality,
  labels,
  showSiteQuality = true,
}: {
  webVitals: WebVitalMetric[]
  siteQuality: SiteQualityScore
  labels: TableLabels
  showSiteQuality?: boolean
}) {
  const scoredVitals = webVitals.filter((row) => row.samples > 0)
  const fieldScore = scoredVitals.length > 0
    ? Math.round(scoredVitals.reduce((sum, row) => sum + row.score, 0) / scoredVitals.length)
    : null
  const siteQualityScore = showSiteQuality ? siteQuality.score : null
  const overallScore = fieldScore == null && siteQualityScore == null
    ? null
    : fieldScore == null
      ? siteQualityScore
      : siteQualityScore == null
        ? fieldScore
        : Math.round((fieldScore * 0.6) + (siteQualityScore * 0.4))
  const sampleCount = webVitals.reduce((sum, row) => sum + row.samples, 0)
  const visitorCount = webVitals.reduce((max, row) => Math.max(max, row.visitors), 0)
  const overallTone = scoreTone(overallScore)
  const fieldTone = scoreTone(fieldScore)
  const siteQualityTone = scoreTone(siteQualityScore)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{labels.performanceOverview ?? "Performance overview"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className={`grid gap-3 ${showSiteQuality ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
          <PerformanceScoreTile
            title={labels.overallScore ?? "Overall score"}
            score={overallScore}
            tone={overallTone}
            label={scoreLabel(overallScore, labels)}
            description={(labels.measuredFromVisitors ?? "Based on real visitor measurements after analytics consent.")
              .replace("{samples}", String(sampleCount))
              .replace("{visitors}", String(visitorCount))}
          />
          <PerformanceScoreTile
            title={labels.fieldPerformance ?? "Field performance"}
            score={fieldScore}
            tone={fieldTone}
            label={scoreLabel(fieldScore, labels)}
            description={labels.fieldPerformanceExplanation ?? "Real visitor loading, interaction, and stability signals."}
          />
          {showSiteQuality && (
            <PerformanceScoreTile
              title={labels.siteQuality ?? "Site quality"}
              score={siteQualityScore}
              tone={siteQualityTone}
              label={scoreLabel(siteQualityScore, labels)}
              description={labels.siteQualityExplanation ?? "CMS checks for metadata, navigation, contact details, and publishing basics."}
            />
          )}
        </div>
        {sampleCount > 0 && sampleCount < 20 && (
          <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
            {labels.lowSampleNotice ?? "This score is based on a small number of measurements and can move quickly."}
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {WEB_VITAL_DISPLAY_ORDER.map((name) => {
            const row = webVitals.find((metric) => metric.name === name) ?? null
            const tone = ratingTone(row?.rating ?? null)
            return (
              <div key={name} className="rounded-md border border-border p-3">
                <div className="text-sm font-medium">{webVitalPlainLabel(name, labels)}</div>
                <div className={`mt-2 h-1 w-7 rounded-full ${stateHintClassName(tone)}`} />
                <div className="mt-1 text-xs text-muted-foreground">{name}</div>
                {row ? (
                  <>
                    <div className={`mt-3 text-2xl font-semibold ${stateTextClassName(tone)}`}>{formatWebVitalValue(row)}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant={stateBadgeVariant(tone)}>{ratingLabel(row.rating, labels)}</Badge>
                      <div className="text-sm text-muted-foreground">{row.samples} {labels.samples?.toLowerCase() ?? "samples"}</div>
                    </div>
                  </>
                ) : (
                  <div className="mt-3 text-sm text-muted-foreground">{labels.metricMissing ?? labels.noData}</div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export function FormFunnelCard({ funnel, labels }: { funnel: FormFunnelMetric; labels: TableLabels }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.formFunnel}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">{labels.started}</TableCell>
              <TableCell>{funnel.started}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">{labels.submitted}</TableCell>
              <TableCell>{funnel.submitted}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">{labels.accepted}</TableCell>
              <TableCell>{funnel.accepted}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">{labels.submitRate}</TableCell>
              <TableCell>{pct(funnel.submitRate)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">{labels.acceptanceRate}</TableCell>
              <TableCell>{pct(funnel.acceptanceRate)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function SiteQualityCard({ score, labels }: { score: SiteQualityScore; labels: TableLabels }) {
  const visibleChecks = score.checks
    .slice()
    .sort((a, b) => Number(a.passed) - Number(b.passed))
    .slice(0, 8)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{labels.siteQuality ?? "Site quality"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-3xl font-semibold">{score.score == null ? labels.emptyValue : score.score}</div>
            <div className="text-sm text-muted-foreground">{labels.siteQualityChecks ?? "Checks"}: {score.passed}/{score.total}</div>
          </div>
          <div className="text-sm text-muted-foreground">{labels.combinedSiteScore ?? "Site score"}</div>
        </div>
        <div className="space-y-2">
          {visibleChecks.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">{labels.noData}</div>
          ) : visibleChecks.map((check) => (
            <div key={check.key} className="flex min-w-0 items-start justify-between gap-3 rounded-md border border-border p-3">
              <div className="flex min-w-0 gap-2">
                <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${stateHintClassName(check.passed ? "success" : "warning")}`} />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{check.label}</div>
                  {!check.passed && <div className="text-xs text-muted-foreground">{check.hint}</div>}
                </div>
              </div>
              <Badge className="shrink-0 self-start" variant={check.passed ? "success" : "warning"}>{check.passed ? labels.statusOk : labels.statusFix}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function TopPagesTable({ rows, labels }: { rows: TopPageMetric[]; labels: TableLabels }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.topPages}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.page}</TableHead>
              <TableHead>{labels.views}</TableHead>
              <TableHead>{labels.visitors}</TableHead>
              <TableHead>{labels.conversions}</TableHead>
              <TableHead>{labels.conversionRate}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="h-20 text-center text-muted-foreground">{labels.noData}</TableCell></TableRow>
            ) : rows.map((row) => (
              <TableRow key={row.pagePath}>
                <TableCell className="font-medium">{row.pagePath}</TableCell>
                <TableCell>{row.pageviews}</TableCell>
                <TableCell>{row.visitors}</TableCell>
                <TableCell>{row.conversions}</TableCell>
                <TableCell>{pct(row.conversionRate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function TopCtasTable({ rows, labels }: { rows: TopCtaMetric[]; labels: TableLabels }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.ctaPerformance}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.label}</TableHead>
              <TableHead>{labels.role}</TableHead>
              <TableHead>{labels.targetType}</TableHead>
              <TableHead>{labels.clicks}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="h-20 text-center text-muted-foreground">{labels.noData}</TableCell></TableRow>
            ) : rows.map((row, index) => (
              <TableRow key={`${row.label}:${row.role}:${row.targetType}:${index}`}>
                <TableCell className="font-medium">{row.label ?? labels.emptyValue}</TableCell>
                <TableCell>{row.role ?? labels.emptyValue}</TableCell>
                <TableCell>{row.targetType ?? labels.emptyValue}</TableCell>
                <TableCell>{row.clicks}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function SectionPerformanceTable({ rows, labels }: { rows: SectionPerformanceMetric[]; labels: TableLabels }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.sectionPerformance}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.section}</TableHead>
              <TableHead>{labels.page}</TableHead>
              <TableHead>{labels.views}</TableHead>
              <TableHead>{labels.engagements}</TableHead>
              <TableHead>{labels.ctaClicks}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="h-20 text-center text-muted-foreground">{labels.noData}</TableCell></TableRow>
            ) : rows.map((row, index) => (
              <TableRow key={`${row.sectionId}:${row.pagePath}:${index}`}>
                <TableCell className="font-medium">{row.sectionType ?? row.sectionId ?? labels.emptyValue}</TableCell>
                <TableCell>{row.pagePath ?? labels.emptyValue}</TableCell>
                <TableCell>{row.views}</TableCell>
                <TableCell>{row.engagements}</TableCell>
                <TableCell>{row.ctaClicks}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function TrafficSourcesTable({ rows, labels }: { rows: TrafficSourceMetric[]; labels: TableLabels }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.trafficSources}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.source}</TableHead>
              <TableHead>{labels.sourceType}</TableHead>
              <TableHead>{labels.views}</TableHead>
              <TableHead>{labels.visitors}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="h-20 text-center text-muted-foreground">{labels.noData}</TableCell></TableRow>
            ) : rows.map((row, index) => (
              <TableRow key={`${row.source}:${row.sourceType}:${index}`}>
                <TableCell className="font-medium">{row.source}</TableCell>
                <TableCell>{row.sourceType ?? labels.emptyValue}</TableCell>
                <TableCell>{row.pageviews}</TableCell>
                <TableCell>{row.visitors}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function DeviceSplitTable({ rows, labels }: { rows: DeviceMetric[]; labels: TableLabels }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.deviceSplit}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.device}</TableHead>
              <TableHead>{labels.views}</TableHead>
              <TableHead>{labels.visitors}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="h-20 text-center text-muted-foreground">{labels.noData}</TableCell></TableRow>
            ) : rows.map((row) => (
              <TableRow key={row.deviceType}>
                <TableCell className="font-medium">{row.deviceType}</TableCell>
                <TableCell>{row.pageviews}</TableCell>
                <TableCell>{row.visitors}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function ComponentPerformanceTable({ rows, labels }: { rows: ComponentPerformanceMetric[]; labels: TableLabels }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.componentPerformance}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.component}</TableHead>
              <TableHead>{labels.componentRole}</TableHead>
              <TableHead>{labels.section}</TableHead>
              <TableHead>{labels.interactions}</TableHead>
              <TableHead>{labels.visitors}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="h-20 text-center text-muted-foreground">{labels.noData}</TableCell></TableRow>
            ) : rows.map((row, index) => (
              <TableRow key={`${row.componentType}:${row.componentRole}:${row.sectionType}:${index}`}>
                <TableCell className="font-medium">{row.componentType ?? labels.emptyValue}</TableCell>
                <TableCell>{row.componentRole ?? labels.emptyValue}</TableCell>
                <TableCell>{row.sectionType ?? labels.emptyValue}</TableCell>
                <TableCell>{row.interactions}</TableCell>
                <TableCell>{row.visitors}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function ComponentExposureTable({ rows, labels }: { rows: ComponentExposureMetric[]; labels: TableLabels }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.componentPerformance}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.label}</TableHead>
              <TableHead>{labels.role}</TableHead>
              <TableHead>{labels.views}</TableHead>
              <TableHead>{labels.interactions}</TableHead>
              <TableHead>{labels.interactionRate}</TableHead>
              <TableHead>{labels.avgHoverMs}</TableHead>
              <TableHead>{labels.avgTimeToInteractionMs}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="h-20 text-center text-muted-foreground">{labels.noData}</TableCell></TableRow>
            ) : rows.map((row, index) => (
              <TableRow key={`${row.actionKey}:${index}`}>
                <TableCell className="font-medium">{row.label ?? row.sectionType ?? labels.emptyValue}</TableCell>
                <TableCell>{row.role ?? labels.emptyValue}</TableCell>
                <TableCell>{row.views}</TableCell>
                <TableCell>{row.interactions}</TableCell>
                <TableCell>{pct(row.interactionRate)}</TableCell>
                <TableCell>{ms(row.avgHoverMsBeforeInteraction)}</TableCell>
                <TableCell>{ms(row.avgTimeToInteractionMs)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function WebVitalsTable({ rows, labels }: { rows: WebVitalMetric[]; labels: TableLabels }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.webVitals}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.metric}</TableHead>
              <TableHead>{labels.rating}</TableHead>
              <TableHead>{labels.samples}</TableHead>
              <TableHead>{labels.avgValue}</TableHead>
              <TableHead>{labels.maxValue}</TableHead>
              <TableHead>{labels.visitors}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="h-20 text-center text-muted-foreground">{labels.noData}</TableCell></TableRow>
            ) : rows.map((row, index) => (
              <TableRow key={`${row.name}:${row.rating}:${index}`}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell><Badge variant={stateBadgeVariant(ratingTone(row.rating))}>{ratingLabel(row.rating, labels)}</Badge></TableCell>
                <TableCell>{row.samples}</TableCell>
                <TableCell>{row.name === "CLS" ? row.avgValue.toFixed(3) : ms(row.avgValue)}</TableCell>
                <TableCell>{row.name === "CLS" ? row.maxValue.toFixed(3) : ms(row.maxValue)}</TableCell>
                <TableCell>{row.visitors}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function AutocaptureInteractionsTable({ rows, labels }: { rows: AutocaptureInteractionMetric[]; labels: TableLabels }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.autocaptureInteractions}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.events}</TableHead>
              <TableHead>{labels.label}</TableHead>
              <TableHead>{labels.role}</TableHead>
              <TableHead>{labels.section}</TableHead>
              <TableHead>{labels.page}</TableHead>
              <TableHead>{labels.count}</TableHead>
              <TableHead>{labels.visitors}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="h-20 text-center text-muted-foreground">{labels.noData}</TableCell></TableRow>
            ) : rows.map((row, index) => (
              <TableRow key={`${row.event}:${row.actionLabel}:${row.pagePath}:${index}`}>
                <TableCell className="font-medium">{row.eventType ?? row.event}</TableCell>
                <TableCell>{row.actionLabel ?? labels.emptyValue}</TableCell>
                <TableCell>{row.actionRole ?? labels.emptyValue}</TableCell>
                <TableCell>{row.sectionType ?? labels.emptyValue}</TableCell>
                <TableCell>{row.pagePath ?? labels.emptyValue}</TableCell>
                <TableCell>{row.count}</TableCell>
                <TableCell>{row.visitors}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function AutocaptureFrictionTable({ rows, labels }: { rows: AutocaptureFrictionMetric[]; labels: TableLabels }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.autocaptureFriction}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.events}</TableHead>
              <TableHead>{labels.page}</TableHead>
              <TableHead>{labels.section}</TableHead>
              <TableHead>{labels.count}</TableHead>
              <TableHead>{labels.visitors}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="h-20 text-center text-muted-foreground">{labels.noData}</TableCell></TableRow>
            ) : rows.map((row, index) => (
              <TableRow key={`${row.event}:${row.pagePath}:${row.sectionType}:${index}`}>
                <TableCell className="font-medium">{row.event}</TableCell>
                <TableCell>{row.pagePath ?? labels.emptyValue}</TableCell>
                <TableCell>{row.sectionType ?? labels.emptyValue}</TableCell>
                <TableCell>{row.count}</TableCell>
                <TableCell>{row.visitors}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function JourneyStepsTable({ rows, labels }: { rows: JourneyStepMetric[]; labels: TableLabels }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.journeySteps}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.stepIndex}</TableHead>
              <TableHead>{labels.step}</TableHead>
              <TableHead>{labels.events}</TableHead>
              <TableHead>{labels.visitors}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="h-20 text-center text-muted-foreground">{labels.noData}</TableCell></TableRow>
            ) : rows.map((row, index) => (
              <TableRow key={`${row.stepIndex}:${row.step}:${index}`}>
                <TableCell className="font-medium">{row.stepIndex}</TableCell>
                <TableCell>{row.step ?? labels.emptyValue}</TableCell>
                <TableCell>{row.count}</TableCell>
                <TableCell>{row.visitors}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function ScrollDepthTable({ rows, labels }: { rows: ScrollDepthMetric[]; labels: TableLabels }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.scrollDepth}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.depth}</TableHead>
              <TableHead>{labels.visitors}</TableHead>
              <TableHead>{labels.events}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="h-20 text-center text-muted-foreground">{labels.noData}</TableCell></TableRow>
            ) : rows.map((row) => (
              <TableRow key={row.depth}>
                <TableCell className="font-medium">{row.depth}%</TableCell>
                <TableCell>{row.visitors}</TableCell>
                <TableCell>{row.events}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function GeoCountryMap({ rows, labels }: { rows: GeoCountryMetric[]; labels: TableLabels }) {
  const maxVisitors = Math.max(...rows.map((row) => row.visitors), 0)
  const totalVisitors = rows.reduce((sum, row) => sum + row.visitors, 0)

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.geography}</CardTitle></CardHeader>
      <CardContent className="grid gap-4">
        <GeoChoroplethMap rows={rows} noData={labels.noData} />
        {rows.length > 0 && (
          <div className="grid gap-3">
            {rows.slice(0, 8).map((row) => {
              const filledSegments = maxVisitors > 0 ? Math.max(1, Math.round((row.visitors / maxVisitors) * 16)) : 0
              const share = totalVisitors > 0 ? row.visitors / totalVisitors : 0
              return (
                <div key={`${row.countryCode}:${row.countryName}`} className="grid gap-1">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{countryLabel(row, labels.emptyValue)}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {row.visitors} {labels.visitors?.toLowerCase()} · {pct(share)}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: 16 }).map((_, index) => (
                      <span
                        key={index}
                        className={index < filledSegments ? "h-2 flex-1 rounded-full bg-primary" : "h-2 flex-1 rounded-full bg-muted"}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function GeoCountriesTable({ rows, labels }: { rows: GeoCountryMetric[]; labels: TableLabels }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.countries}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.country}</TableHead>
              <TableHead>{labels.countryCode}</TableHead>
              <TableHead>{labels.visitors}</TableHead>
              <TableHead>{labels.views}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="h-20 text-center text-muted-foreground">{labels.noData}</TableCell></TableRow>
            ) : rows.map((row, index) => (
              <TableRow key={`${row.countryCode}:${row.countryName}:${index}`}>
                <TableCell className="font-medium">{row.countryName || labels.emptyValue}</TableCell>
                <TableCell>{row.countryCode ?? labels.emptyValue}</TableCell>
                <TableCell>{row.visitors}</TableCell>
                <TableCell>{row.pageviews}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function GeoCitiesTable({ rows, labels }: { rows: GeoCityMetric[]; labels: TableLabels }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{labels.cities}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.city}</TableHead>
              <TableHead>{labels.country}</TableHead>
              <TableHead>{labels.visitors}</TableHead>
              <TableHead>{labels.views}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="h-20 text-center text-muted-foreground">{labels.noData}</TableCell></TableRow>
            ) : rows.map((row, index) => (
              <TableRow key={`${row.city}:${row.countryCode}:${index}`}>
                <TableCell className="font-medium">{row.city}</TableCell>
                <TableCell>{row.countryName ?? row.countryCode ?? labels.emptyValue}</TableCell>
                <TableCell>{row.visitors}</TableCell>
                <TableCell>{row.pageviews}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
