import Link from "next/link"
import type { ComponentType } from "react"
import { Badge } from "@siteinabox/ui/components/badge"
import { Button, buttonVariants } from "@siteinabox/ui/components/button"
import { Card, CardContent } from "@siteinabox/ui/components/card"
import { cn } from "@siteinabox/ui/lib/utils"
import { EmptyState } from "@/components/empty-state"
import { ListPagination } from "@/components/list-pagination"
import { ListSearch } from "@/components/list-search"
import { PageHeader } from "@/components/page-header"
import { sendPreviewAccessEmailAction } from "@/lib/actions/previewAccess"
import { requireRole } from "@/lib/authGate"
import {
  listGenerationOperations,
  relationId,
  relationLabel,
  workflowSummaryForGenerationRun,
  workflowSummaryForIntakeSubmission,
  type GenerationRunFilter,
  type OperationsWorkflowState,
} from "@/lib/queries/generationOperations"
import { AlertCircle, CheckCircle2, ExternalLink, Globe2, Inbox, Mail, Search, Send } from "lucide-react"
import { getAdminTranslations } from "@/i18n/admin"
import { useTranslations } from "next-intl"

const PAGE_SIZE = 10

const filters: Array<{ value: GenerationRunFilter; key: string; icon: ComponentType<{ className?: string }> }> = [
  { value: "all", key: "all", icon: Inbox },
  { value: "preview-ready", key: "previewReady", icon: Send },
  { value: "checkout-completed", key: "checkoutCompleted", icon: CheckCircle2 },
  { value: "live", key: "live", icon: Globe2 },
  { value: "needs-attention", key: "needsAttention", icon: AlertCircle },
]

const parseFilter = (value: unknown): GenerationRunFilter => {
  if (
    value === "preview-ready"
    || value === "checkout-completed"
    || value === "live"
    || value === "needs-attention"
  ) return value
  return "all"
}

const workflowStates: OperationsWorkflowState[] = [
  "Preview ready",
  "Checkout completed",
  "Live",
  "Needs attention",
]

const stateForFilter = (filter: GenerationRunFilter): OperationsWorkflowState | null => {
  if (filter === "preview-ready") return "Preview ready"
  if (filter === "checkout-completed") return "Checkout completed"
  if (filter === "live") return "Live"
  if (filter === "needs-attention") return "Needs attention"
  return null
}

const inboxTone = (state: OperationsWorkflowState) => {
  if (state === "Needs attention") return "warning"
  if (state === "Live") return "success"
  return "outline"
}

const jsonObject = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null

const textField = (value: unknown, key: string): string | null => {
  const text = jsonObject(value)?.[key]
  return typeof text === "string" && text.trim() ? text.trim() : null
}

const relationshipText = (value: unknown, key: string): string | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? textField(value, key)
    : null

const domainForRun = (run: any): string | null =>
  relationshipText(run.tenant, "domain")
  ?? textField(run.domainOrder, "domain")
  ?? textField(run.domainOrder, "requestedDomain")

type InboxItem = {
  id: string
  title: string
  subtitle: string
  state: OperationsWorkflowState
  label: string
  primaryAction: string
  href: string
  runId: string | number | null
  contactEmail: string | null
  domain: string | null
  updatedAt?: string | null
}

function ClientQueueItem({ item }: { item: InboxItem }) {
  const t = useTranslations("generationOperations")
  const canSendPreview = item.primaryAction === "Send preview" && item.runId && item.contactEmail
  return (
    <Card className="py-0">
      <CardContent className="flex flex-col gap-3 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{item.title}</div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {item.contactEmail ?? item.subtitle}
            </div>
          </div>
          <Badge
            variant={inboxTone(item.state)}
            className={cn(
              "shrink-0",
              item.state !== "Live" && item.state !== "Needs attention" && "border-foreground/35 text-foreground",
            )}
          >
            {t(`states.${item.state}`)}
          </Badge>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div aria-hidden />
          <div className="flex shrink-0 gap-2">
            {canSendPreview ? (
              <form action={sendPreviewAccessEmailAction.bind(null, item.runId!)}>
                <input type="hidden" name="email" value={item.contactEmail!} />
                <Button type="submit" size="icon" aria-label={t("sendPreviewTo", { title: item.title })}>
                  <Mail className="size-4" aria-hidden />
                </Button>
              </form>
            ) : null}
            <Button asChild variant={canSendPreview ? "outline" : "default"} size="icon" aria-label={t("openItem", { title: item.title })}>
              <Link href={item.href}>
                <ExternalLink className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export const dynamic = "force-dynamic"

export default async function GenerationRunsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; filter?: string }>
}) {
  const { user } = await requireRole(["super-admin"])
  const t = await getAdminTranslations(user, "generationOperations")
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
      const contactEmail = submission.contactEmail ?? relationshipText(submission.generationRun, "customerEmail")
      return {
        id: `submission-${submission.id}`,
        title: submission.businessName,
        subtitle: contactEmail ?? submission.contactName ?? t("clientRequest"),
        state: summary.state,
        label: summary.label,
        helper: summary.helper,
        primaryAction: summary.primaryAction,
        href: `/generation-runs/submissions/${submission.id}`,
        runId: relationId(submission.generationRun),
        contactEmail,
        domain: textField(submission.normalized, "primaryDomain") ?? textField(submission.normalized, "domain"),
        updatedAt: submission.updatedAt ?? submission.createdAt,
      }
    }),
    ...visibleRuns.map((run) => {
      const summary = workflowSummaryForGenerationRun(run)
      const pageCount = Array.isArray(run.pages) ? run.pages.length : 0
      const contactEmail = relationshipText(run.intakeSubmission, "contactEmail") ?? textField(run.payment, "customerEmail")
      const domain = domainForRun(run)
      return {
        id: `run-${run.id}`,
        title: relationLabel(run.tenant, t("draftSite")),
        subtitle: contactEmail ?? t("pageCount", { count: pageCount }),
        state: summary.state,
        label: summary.label,
        helper: summary.helper,
        primaryAction: summary.primaryAction,
        href: `/generation-runs/${run.id}`,
        runId: run.id,
        contactEmail,
        domain,
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
        title={t("list.title")}
        subtitle={t("list.subtitle")}
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <ListSearch placeholder={t("list.search")} />
        {filter !== "all" && (
          <Button asChild variant="outline" size="sm">
            <Link href={hrefForFilter("all")}>{t("list.clearFilter")}</Link>
          </Button>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">{t("list.taskQueue")}</h2>
            <p className="text-sm text-muted-foreground">
              {filter === "all" ? t("list.activeOnly") : t("list.filteredTo", { state: t(`states.${selectedState}`) })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
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
                className={cn(buttonVariants({ variant: active ? "default" : "outline", size: "sm" }), "gap-2")}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-4" aria-hidden />
                <span>{t(`filters.${item.key}`)}</span>
                <span className="text-xs opacity-70">{count}</span>
              </Link>
            )
          })}
        </div>
        {inboxItems.length === 0 ? (
          q ? (
            <EmptyState
              icon={<Search className="h-10 w-10 text-muted-foreground" aria-hidden />}
              title={t("list.noMatchingTasks")}
              description={t("list.noMatchingDescription", { query: q })}
            />
          ) : (
            <EmptyState
              icon={<Inbox className="h-10 w-10 text-muted-foreground" aria-hidden />}
              title={t("list.noTasks")}
              description={t("list.noTasksDescription")}
            />
          )
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {inboxItems.map((item) => (
              <ClientQueueItem key={item.id} item={item} />
            ))}
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
