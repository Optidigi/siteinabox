import Link from "next/link"
import type { ComponentType } from "react"
import { Badge } from "@siteinabox/ui/components/badge"
import { buttonVariants } from "@siteinabox/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { cn } from "@siteinabox/ui/lib/utils"
import { EmptyState } from "@/components/empty-state"
import { GenerationOperationsTable } from "@/components/generation/GenerationOperationsTable"
import { IntakeSubmissionsTable } from "@/components/generation/IntakeSubmissionsTable"
import { ListPagination } from "@/components/list-pagination"
import { ListSearch } from "@/components/list-search"
import { PageHeader } from "@/components/page-header"
import { requireRole } from "@/lib/authGate"
import {
  listGenerationOperations,
  workflowSummaryForGenerationRun,
  workflowSummaryForIntakeSubmission,
  type GenerationRunFilter,
  type OperationsWorkflowState,
} from "@/lib/queries/generationOperations"
import { AlertCircle, CheckCircle2, ClipboardList, Globe2, Inbox, Search, Send, Wand2 } from "lucide-react"

const PAGE_SIZE = 10

const filters: Array<{ value: GenerationRunFilter; label: string; icon: ComponentType<{ className?: string }> }> = [
  { value: "all", label: "All", icon: ClipboardList },
  { value: "new-requests", label: "New requests", icon: Inbox },
  { value: "draft-sites", label: "Draft sites", icon: Wand2 },
  { value: "waiting-on-client", label: "Waiting on client", icon: Send },
  { value: "ready-to-go-live", label: "Ready to go live", icon: CheckCircle2 },
  { value: "live", label: "Live", icon: Globe2 },
  { value: "needs-attention", label: "Needs attention", icon: AlertCircle },
]

const parseFilter = (value: unknown): GenerationRunFilter => {
  if (
    value === "new-requests"
    || value === "draft-sites"
    || value === "waiting-on-client"
    || value === "ready-to-go-live"
    || value === "live"
    || value === "needs-attention"
  ) return value
  return "all"
}

const workflowStates: OperationsWorkflowState[] = [
  "New requests",
  "Draft sites",
  "Waiting on client",
  "Ready to go live",
  "Live",
  "Needs attention",
]

const cardTone = (state: OperationsWorkflowState) => {
  if (state === "Needs attention") return "destructive"
  if (state === "Live" || state === "Ready to go live") return "success"
  return "secondary"
}

const stateForFilter = (filter: GenerationRunFilter): OperationsWorkflowState | null => {
  if (filter === "new-requests") return "New requests"
  if (filter === "draft-sites") return "Draft sites"
  if (filter === "waiting-on-client") return "Waiting on client"
  if (filter === "ready-to-go-live") return "Ready to go live"
  if (filter === "live") return "Live"
  if (filter === "needs-attention") return "Needs attention"
  return null
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
        subtitle="Track new requests, draft sites, client approval, payment, domain verification, and go-live."
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

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {workflowStates.map((state) => (
          <Card key={state}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{state}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-2">
              <span className="text-2xl font-semibold">{workflowCounts.get(state) ?? 0}</span>
              <Badge variant={cardTone(state)}>{state}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">New request</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Review intake, Approve brief, Generate draft.</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Draft site</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Open site, Send preview, Approved, Payment, Waive payment.</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Go live</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Domain verified, Go live, Live.</CardContent>
        </Card>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Site workflow</h2>
        </div>
        <GenerationOperationsTable
          runs={visibleRuns}
          emptyState={
            q ? (
              <EmptyState
                icon={<Search className="h-10 w-10 text-muted-foreground" aria-hidden />}
                title="No matching sites"
                description={`No sites match "${q}".`}
              />
            ) : (
              <EmptyState
                icon={<ClipboardList className="h-10 w-10 text-muted-foreground" aria-hidden />}
                title="No draft sites"
                description="Draft sites appear here after a request is approved."
              />
            )
          }
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">New requests</h2>
        </div>
        <IntakeSubmissionsTable
          submissions={visibleIntakes}
          emptyState={
            q ? (
              <EmptyState
                icon={<Search className="h-10 w-10 text-muted-foreground" aria-hidden />}
                title="No matching requests"
                description={`No requests match "${q}".`}
              />
            ) : (
              <EmptyState
                icon={<Inbox className="h-10 w-10 text-muted-foreground" aria-hidden />}
                title="No new requests"
                description="New requests appear here after a client completes intake."
              />
            )
          }
        />
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
