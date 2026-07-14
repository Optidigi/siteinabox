import { IntakeSubmissionsTable } from "@/components/generation/IntakeSubmissionsTable"
import { OperationsListToolbar } from "@/components/generation/OperationsListToolbar"
import { OperationsRouteTabs } from "@/components/generation/OperationsRouteTabs"
import { OperationsTableFrame } from "@/components/generation/OperationsTableFrame"
import { ListPagination } from "@/components/list-pagination"
import { PageHeader } from "@/components/page-header"
import { getAdminTranslations } from "@/i18n/admin"
import { requireRole } from "@/lib/authGate"
import { listOperationIntakes } from "@/lib/queries/generationOperations"

const PAGE_SIZE = 10
export const dynamic = "force-dynamic"

export default async function OperationIntakesPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  const { user } = await requireRole(["super-admin"])
  const t = await getAdminTranslations(user, "generationOperations")
  const sp = await searchParams
  const q = String(sp.q ?? "").trim() || undefined
  const result = await listOperationIntakes({ page: Number(sp.page) || 1, pageSize: PAGE_SIZE, q })
  return <div className="flex flex-col gap-4">
    <PageHeader title={t("pages.intakes.title")} subtitle={t("pages.intakes.subtitle")} />
    <OperationsRouteTabs activePath="/operations/intakes" />
    <OperationsListToolbar placeholder={t("pages.intakes.search")} activeStatus="all" basePath="/operations/intakes" query={q} showStatuses={false} />
    <OperationsTableFrame title={t("intakes.title")} description={t("intakes.description")} isEmpty={result.docs.length === 0} emptyTitle={t("intakes.emptyTitle")} emptyDescription={q ? t("intakes.emptySearch", { query: q }) : t("intakes.emptyDescription")}>
      <IntakeSubmissionsTable submissions={result.docs} />
    </OperationsTableFrame>
    <ListPagination page={result.page} totalPages={result.totalPages} total={result.totalDocs} pageSize={PAGE_SIZE} />
  </div>
}
