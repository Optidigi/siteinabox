import { ListPagination } from "@/components/list-pagination"
import { PageHeader } from "@/components/page-header"
import { LegalDeliveriesTable, LegalListToolbar, LegalRouteTabs } from "@/components/legal-operations"
import { requireRole } from "@/lib/authGate"
import { listLegalDeliveries } from "@/lib/queries/legalOperations"
import { getAdminTranslations } from "@/i18n/admin"

const PAGE_SIZE = 20
const statusValues = ["all", "queued", "processing", "sent", "failed", "cancelled"] as const
export const dynamic = "force-dynamic"

export default async function LegalDeliveriesPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string; status?: string }> }) {
  const { user } = await requireRole(["super-admin"])
  const t = await getAdminTranslations(user, "legalOperations")
  const statuses = statusValues.map((value) => ({ value, label: t(`statuses.${value}`) }))
  const sp = await searchParams
  const status = statuses.some((item) => item.value === sp.status) ? sp.status! : "all"
  const result = await listLegalDeliveries({ page: Number(sp.page) || 1, pageSize: PAGE_SIZE, q: sp.q, status })
  return <div className="flex flex-col gap-4">
    <PageHeader title={t("pages.deliveries.title")} subtitle={t("pages.deliveries.subtitle")} />
    <LegalRouteTabs activePath="/legal/deliveries" />
    <LegalListToolbar placeholder={t("pages.deliveries.search")} activeStatus={status} statuses={statuses} basePath="/legal/deliveries" query={sp.q} />
    <LegalDeliveriesTable rows={result.docs} />
    <ListPagination page={result.page} totalPages={result.totalPages} total={result.totalDocs} pageSize={PAGE_SIZE} />
  </div>
}
