import { GenerationOperationsTable } from "@/components/generation/GenerationOperationsTable"
import { OperationsListToolbar } from "@/components/generation/OperationsListToolbar"
import { OperationsRouteTabs } from "@/components/generation/OperationsRouteTabs"
import { OperationsTableFrame } from "@/components/generation/OperationsTableFrame"
import { ListPagination } from "@/components/list-pagination"
import { PageHeader } from "@/components/page-header"
import { getAdminTranslations } from "@/i18n/admin"
import { requireRole } from "@/lib/authGate"
import { listOperationRuns, type GenerationRunFilter } from "@/lib/queries/generationOperations"

const PAGE_SIZE = 10
const parseStatus = (value: unknown): GenerationRunFilter =>
  value === "preview-ready" || value === "checkout-completed" || value === "live" || value === "needs-attention" ? value : "all"

export const dynamic = "force-dynamic"

export default async function OperationRunsPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string; status?: string }> }) {
  const { user } = await requireRole(["super-admin"])
  const t = await getAdminTranslations(user, "generationOperations")
  const sp = await searchParams
  const q = String(sp.q ?? "").trim() || undefined
  const status = parseStatus(sp.status)
  const result = await listOperationRuns({ page: Number(sp.page) || 1, pageSize: PAGE_SIZE, q, filter: status })
  return <div className="flex flex-col gap-4">
    <PageHeader title={t("pages.runs.title")} subtitle={t("pages.runs.subtitle")} />
    <OperationsRouteTabs activePath="/operations/runs" />
    <OperationsListToolbar placeholder={t("pages.runs.search")} activeStatus={status} basePath="/operations/runs" query={q} />
    <OperationsTableFrame title={t("runs.title")} description={t("runs.description")} isEmpty={result.docs.length === 0} emptyTitle={t("runs.emptyTitle")} emptyDescription={q ? t("runs.emptySearch", { query: q }) : t("runs.emptyDescription")}>
      <GenerationOperationsTable runs={result.docs} />
    </OperationsTableFrame>
    <ListPagination page={result.page} totalPages={result.totalPages} total={result.totalDocs} pageSize={PAGE_SIZE} />
  </div>
}
