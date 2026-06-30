import Link from "next/link"
import type { ComponentType } from "react"
import { Badge } from "@siteinabox/ui/components/badge"
import { Button, buttonVariants } from "@siteinabox/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@siteinabox/ui/components/table"
import { cn } from "@siteinabox/ui/lib/utils"
import { EmptyState } from "@/components/empty-state"
import { ListPagination } from "@/components/list-pagination"
import { ListSearch } from "@/components/list-search"
import { PageHeader } from "@/components/page-header"
import { requireRole } from "@/lib/authGate"
import {
  listGenerationOperations,
  relationLabel,
  workflowSummaryForGenerationRun,
  workflowSummaryForIntakeSubmission,
  type GenerationRunFilter,
  type OperationsWorkflowState,
} from "@/lib/queries/generationOperations"
import { AlertCircle, CheckCircle2, ClipboardList, ExternalLink, Globe2, Inbox, Search, Send, Wand2 } from "lucide-react"

const PAGE_SIZE = 10

const filters: Array<{ value: GenerationRunFilter; label: string; icon: ComponentType<{ className?: string }> }> = [
  { value: "all", label: "All", icon: ClipboardList },
  { value: "new-requests", label: "New requests", icon: Inbox },
  { value: "ready-for-ai", label: "Ready for AI", icon: Wand2 },
  { value: "drafts-to-preview", label: "Drafts to preview", icon: Send },
  { value: "waiting-for-checkout", label: "Waiting for checkout", icon: CheckCircle2 },
  { value: "launch-needed", label: "Launch needed", icon: Globe2 },
  { value: "live", label: "Live", icon: Globe2 },
  { value: "needs-attention", label: "Needs attention", icon: AlertCircle },
]

const parseFilter = (value: unknown): GenerationRunFilter => {
  if (
    value === "new-requests"
    || value === "ready-for-ai"
    || value === "drafts-to-preview"
    || value === "waiting-for-checkout"
    || value === "launch-needed"
    || value === "live"
    || value === "needs-attention"
  ) return value
  return "all"
}

const workflowStates: OperationsWorkflowState[] = [
  "New requests",
  "Ready for AI",
  "Drafts to preview",
  "Waiting for checkout",
  "Launch needed",
  "Live",
  "Needs attention",
]

const stateForFilter = (filter: GenerationRunFilter): OperationsWorkflowState | null => {
  if (filter === "new-requests") return "New requests"
  if (filter === "ready-for-ai") return "Ready for AI"
  if (filter === "drafts-to-preview") return "Drafts to preview"
  if (filter === "waiting-for-checkout") return "Waiting for checkout"
  if (filter === "launch-needed") return "Launch needed"
  if (filter === "live") return "Live"
  if (filter === "needs-attention") return "Needs attention"
  return null
}

const formatDate = (value?: string | null) => {
  if (!value) return "-"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("nl-NL")
}

const inboxTone = (state: OperationsWorkflowState) => {
  if (state === "Needs attention") return "destructive"
  if (state === "Live" || state === "Launch needed") return "success"
  return "secondary"
}

export const dynamic = "force-dynamic"

export default async function GenerationRunsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; filter?: string }>
}) {
  await requireRole(["super-admin"])
  const sp = await searchParams
  const q = String(sp.q ?? "").trim() || undefined
  const filter = parseFilter(sp.filter)
  const result = await listGenerationOperations({
    page: Number(sp.page) || 1,
    pageSize: PAGE_SIZE,
    q,
    filter,
  })
  const totalPages = Math.max(result.runs.totalPages, result.intakes.totalPages)
  const totalDocs = Math.max(result.runs.totalDocs, result.intakes.totalDocs)
  const currentPage = Math.max(result.runs.page, result.intakes.page)
  const workflowCounts = new Map<OperationsWorkflowState, number>(workflowStates.map((state) => [state, 0]))
  for (const submission of result.intakes.docs) {
    const summary = workflowSummaryForIntakeSubmission(submission)
    workflowCounts.set(summary.state, (workflowCounts.get(summary.state) ?? 0) + 1)
  }
  for (const run of result.runs.docs) {
    const summary = workflowSummaryForGenerationRun(run)
    workflowCounts.set(summary.state, (workflowCounts.get(summary.state) ?? 0) + 1)
  }
  const selectedState = stateForFilter(filter)
  const visibleRuns = selectedState
    ? result.runs.docs.filter((run) => workflowSummaryForGenerationRun(run).state === selectedState)
    : result.runs.docs
  const visibleIntakes = selectedState
    ? result.intakes.docs.filter((submission) => workflowSummaryForIntakeSubmission(submission).state === selectedState)
    : result.intakes.docs
  const inboxItems = [
    ...visibleIntakes.map((submission) => {
      const summary = workflowSummaryForIntakeSubmission(submission)
      return {
        id: `submission-${submission.id}`,
        title: submission.businessName,
        subtitle: submission.contactEmail ?? submission.contactName ?? "New request",
        state: summary.state,
        label: summary.label,
        helper: summary.helper,
        primaryAction: summary.primaryAction,
        href: `/generation-runs/submissions/${submission.id}`,
        updatedAt: submission.updatedAt ?? submission.createdAt,
      }
    }),
    ...visibleRuns.map((run) => {
      const summary = workflowSummaryForGenerationRun(run)
      const pageCount = Array.isArray(run.pages) ? run.pages.length : 0
      return {
        id: `run-${run.id}`,
        title: relationLabel(run.tenant, "Draft site"),
        subtitle: `${pageCount} pages`,
        state: summary.state,
        label: summary.label,
        helper: summary.helper,
        primaryAction: summary.primaryAction,
        href: `/generation-runs/${run.id}`,
        updatedAt: run.updatedAt,
      }
    }),
  ].sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime())
  const summaryCards = [
    {
      label: "Intake",
      count: (workflowCounts.get("New requests") ?? 0) + (workflowCounts.get("Ready for AI") ?? 0),
      helper: "Review intake and send approved briefs to AI.",
    },
    {
      label: "Preview",
      count: (workflowCounts.get("Drafts to preview") ?? 0) + (workflowCounts.get("Waiting for checkout") ?? 0),
      helper: "Open drafts, send previews, and wait for checkout.",
    },
    {
      label: "Launch",
      count: (workflowCounts.get("Launch needed") ?? 0) + (workflowCounts.get("Live") ?? 0),
      helper: "Register domains, launch sites, and hand off access.",
    },
    {
      label: "Needs attention",
      count: workflowCounts.get("Needs attention") ?? 0,
      helper: "Requests or drafts that need operator review.",
    },
  ]

  const hrefForFilter = (next: GenerationRunFilter) => {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (next !== "all") params.set("filter", next)
    const qs = params.toString()
    return qs ? `/generation-runs?${qs}` : "/generation-runs"
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Operations"
        subtitle="Track intake review, AI drafts, preview checkout, domain launch, and handoff."
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <ListSearch placeholder="Search business, contact, or site..." />
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => {
            const Icon = item.icon
            const active = item.value === filter
            return (
              <Link
                key={item.value}
                href={hrefForFilter(item.value)}
                className={cn(buttonVariants({ variant: active ? "default" : "outline", size: "sm" }), "gap-1.5")}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <span className="text-2xl font-semibold">{card.count}</span>
              <p className="text-sm text-muted-foreground">{card.helper}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Task inbox</h2>
        </div>
        {inboxItems.length === 0 ? (
          q ? (
            <EmptyState
              icon={<Search className="h-10 w-10 text-muted-foreground" aria-hidden />}
              title="No matching tasks"
              description={`No operations tasks match "${q}".`}
            />
          ) : (
            <EmptyState
              icon={<Inbox className="h-10 w-10 text-muted-foreground" aria-hidden />}
              title="No tasks"
              description="Requests, drafts, checkout, launch, and handoff tasks appear here."
            />
          )
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stage</TableHead>
                  <TableHead>Client / site</TableHead>
                  <TableHead>Next action</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inboxItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant={inboxTone(item.state)}>
                        <span className="size-1.5 rounded-full bg-current" aria-hidden />
                        {item.state}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{item.title}</div>
                      <div className="text-xs text-muted-foreground">{item.subtitle}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{item.label}</div>
                      <div className="text-xs text-muted-foreground">{item.helper}</div>
                    </TableCell>
                    <TableCell>{formatDate(item.updatedAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={item.href} className="gap-1.5">
                          <ExternalLink className="size-3.5" aria-hidden />
                          {item.primaryAction}
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <ListPagination
        page={currentPage}
        totalPages={totalPages}
        total={totalDocs}
        pageSize={PAGE_SIZE}
      />
    </div>
  )
}
