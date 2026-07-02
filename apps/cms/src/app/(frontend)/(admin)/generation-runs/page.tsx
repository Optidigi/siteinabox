import Link from "next/link"
import type { ComponentType } from "react"
import { Badge } from "@siteinabox/ui/components/badge"
import { Button, buttonVariants } from "@siteinabox/ui/components/button"
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
import { AlertCircle, CheckCircle2, ClipboardList, ExternalLink, Globe2, Inbox, Search, Send, TimerReset } from "lucide-react"

const PAGE_SIZE = 10

const filters: Array<{ value: GenerationRunFilter; label: string; icon: ComponentType<{ className?: string }> }> = [
  { value: "all", label: "All", icon: ClipboardList },
  { value: "new-requests", label: "New requests", icon: Inbox },
  { value: "draft-preparing", label: "Draft preparing", icon: TimerReset },
  { value: "drafts-to-preview", label: "Drafts to preview", icon: Send },
  { value: "waiting-for-checkout", label: "Waiting for checkout", icon: CheckCircle2 },
  { value: "launch-needed", label: "Launch needed", icon: Globe2 },
  { value: "live", label: "Live", icon: Globe2 },
  { value: "needs-attention", label: "Needs attention", icon: AlertCircle },
]

const parseFilter = (value: unknown): GenerationRunFilter => {
  if (
    value === "new-requests"
    || value === "draft-preparing"
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
  "Draft preparing",
  "Drafts to preview",
  "Waiting for checkout",
  "Launch needed",
  "Live",
  "Needs attention",
]

const stateForFilter = (filter: GenerationRunFilter): OperationsWorkflowState | null => {
  if (filter === "new-requests") return "New requests"
  if (filter === "draft-preparing") return "Draft preparing"
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
        subtitle="One queue for intake, preview send, client checkout, provisioning, and live handoff."
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <ListSearch placeholder="Search business, contact, or site..." />
        {filter !== "all" && (
          <Button asChild variant="outline" size="sm">
            <Link href={hrefForFilter("all")}>Clear filter</Link>
          </Button>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Task queue</h2>
            <p className="text-sm text-muted-foreground">
              {filter === "all" ? "Showing the next required action for every active workflow." : `Filtered to ${selectedState}.`}
            </p>
          </div>
          <details className="relative">
            <summary className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer list-none")}>
              Advanced filters
            </summary>
            <div className="absolute right-0 z-10 mt-2 grid w-72 gap-2 rounded-md border bg-background p-3 shadow-lg">
              {filters.map((item) => {
                const Icon = item.icon
                const active = item.value === filter
                const count = item.value === "all"
                  ? inboxItems.length
                  : workflowCounts.get(stateForFilter(item.value) ?? "Needs attention") ?? 0
                return (
                  <Link
                    key={item.value}
                    href={hrefForFilter(item.value)}
                    className={cn(buttonVariants({ variant: active ? "default" : "ghost", size: "sm" }), "justify-between gap-2")}
                    aria-current={active ? "page" : undefined}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Icon className="size-4" aria-hidden />
                      {item.label}
                    </span>
                    <span>{count}</span>
                  </Link>
                )
              })}
            </div>
          </details>
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
              description="Intake, preview, checkout, provisioning, launch, and handoff tasks appear here."
            />
          )
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client / site</TableHead>
                  <TableHead>Next action</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inboxItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.title}</div>
                      <div className="text-xs text-muted-foreground">{item.subtitle}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{item.label}</div>
                      <div className="text-xs text-muted-foreground">{item.helper}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={inboxTone(item.state)}>
                        <span className="size-1.5 rounded-full bg-current" aria-hidden />
                        {item.state}
                      </Badge>
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
