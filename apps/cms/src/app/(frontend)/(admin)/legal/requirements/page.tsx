import { ListPagination } from "@/components/list-pagination"
import { PageHeader } from "@/components/page-header"
import { LegalListToolbar, LegalRequirementsTable, LegalRouteTabs } from "@/components/legal-operations"
import { requireRole } from "@/lib/authGate"
import { listLegalRequirements } from "@/lib/queries/legalOperations"
import { getAdminTranslations } from "@/i18n/admin"

const PAGE_SIZE = 20
const statusValues = ["all", "open", "pending", "notified", "objected", "deemed", "failed", "satisfied", "waived"] as const
export const dynamic = "force-dynamic"

export default async function LegalRequirementsPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string; status?: string }> }) {
  const { user } = await requireRole(["super-admin"])
  const t = await getAdminTranslations(user, "legalOperations")
  const statuses = statusValues.map((value) => ({ value, label: t(`statuses.${value}`) }))
  const sp = await searchParams
  const status = statuses.some((item) => item.value === sp.status) ? sp.status! : "all"
  const result = await listLegalRequirements({ page: Number(sp.page) || 1, pageSize: PAGE_SIZE, q: sp.q, status })
  return <div className="flex flex-col gap-4">
    <PageHeader title={t("pages.requirements.title")} subtitle={t("pages.requirements.subtitle")} />
    <LegalRouteTabs activePath="/legal/requirements" />
    <LegalListToolbar placeholder={t("pages.requirements.search")} activeStatus={status} statuses={statuses} basePath="/legal/requirements" query={sp.q} />
    <LegalRequirementsTable rows={result.docs} />
    <ListPagination page={result.page} totalPages={result.totalPages} total={result.totalDocs} pageSize={PAGE_SIZE} />
  </div>
}
