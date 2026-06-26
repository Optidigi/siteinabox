import Link from "next/link"
import type { ComponentType } from "react"
import { Badge } from "@siteinabox/ui/components/badge"
import { Button, buttonVariants } from "@siteinabox/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { cn } from "@siteinabox/ui/lib/utils"
import { EmptyState } from "@/components/empty-state"
import { GenerationOperationsTable } from "@/components/generation/GenerationOperationsTable"
import { IntakeSubmissionsTable } from "@/components/generation/IntakeSubmissionsTable"
import { ListPagination } from "@/components/list-pagination"
import { ListSearch } from "@/components/list-search"
import { PageHeader } from "@/components/page-header"
import { requireRole } from "@/lib/authGate"
import { listGenerationOperations, type GenerationRunFilter } from "@/lib/queries/generationOperations"
import { AlertCircle, ClipboardList, Eye, Inbox, Search } from "lucide-react"

const PAGE_SIZE = 10

const filters: Array<{ value: GenerationRunFilter; label: string; icon: ComponentType<{ className?: string }> }> = [
  { value: "all", label: "All", icon: ClipboardList },
  { value: "failed", label: "Failed", icon: AlertCircle },
  { value: "preview-ready", label: "Preview-ready", icon: Eye },
  { value: "needs-review", label: "Needs review", icon: Inbox },
]

const parseFilter = (value: unknown): GenerationRunFilter => {
  if (value === "failed" || value === "preview-ready" || value === "needs-review") return value
  return "all"
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
        title="Generation operations"
        subtitle="Review intake submissions, generation runs, failures, and generated draft records."
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <ListSearch placeholder="Search provider, model, business, email, or hash..." />
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Runs</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{result.runs.totalDocs}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Submissions</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{result.intakes.totalDocs}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Filter</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={filter === "failed" ? "destructive" : filter === "all" ? "secondary" : "warning"}>
              {filter}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Retry</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Follow-up</CardContent>
        </Card>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Generation runs</h2>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/collections/site-generation-runs">Payload admin</Link>
          </Button>
        </div>
        <GenerationOperationsTable
          runs={result.runs.docs}
          emptyState={
            q ? (
              <EmptyState
                icon={<Search className="h-10 w-10 text-muted-foreground" aria-hidden />}
                title="No matching generation runs"
                description={`No generation runs match "${q}".`}
              />
            ) : (
              <EmptyState
                icon={<ClipboardList className="h-10 w-10 text-muted-foreground" aria-hidden />}
                title="No generation runs"
                description="Runs appear here after an intake submission starts generation."
              />
            )
          }
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Intake submissions</h2>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/collections/intake-submissions">Payload admin</Link>
          </Button>
        </div>
        <IntakeSubmissionsTable
          submissions={result.intakes.docs}
          emptyState={
            q ? (
              <EmptyState
                icon={<Search className="h-10 w-10 text-muted-foreground" aria-hidden />}
                title="No matching submissions"
                description={`No intake submissions match "${q}".`}
              />
            ) : (
              <EmptyState
                icon={<Inbox className="h-10 w-10 text-muted-foreground" aria-hidden />}
                title="No intake submissions"
                description="Submissions appear here after the public intake API receives a request."
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
