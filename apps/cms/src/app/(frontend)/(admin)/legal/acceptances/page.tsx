import { ListPagination } from "@/components/list-pagination"
import { ListSearch } from "@/components/list-search"
import { PageHeader } from "@/components/page-header"
import { LegalAcceptancesTable, LegalRouteTabs } from "@/components/legal-operations"
import { requireRole } from "@/lib/authGate"
import { listLegalAcceptances } from "@/lib/queries/legalOperations"
import { getAdminTranslations } from "@/i18n/admin"

const PAGE_SIZE = 20
export const dynamic = "force-dynamic"

export default async function LegalAcceptancesPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  const { user } = await requireRole(["super-admin"])
  const t = await getAdminTranslations(user, "legalOperations")
  const sp = await searchParams
  const result = await listLegalAcceptances({ page: Number(sp.page) || 1, pageSize: PAGE_SIZE, q: sp.q })
  return <div className="flex flex-col gap-4">
    <PageHeader title={t("pages.acceptances.title")} subtitle={t("pages.acceptances.subtitle")} />
    <LegalRouteTabs activePath="/legal/acceptances" />
    <ListSearch placeholder={t("pages.acceptances.search")} />
    <LegalAcceptancesTable rows={result.docs} />
    <ListPagination page={result.page} totalPages={result.totalPages} total={result.totalDocs} pageSize={PAGE_SIZE} />
  </div>
}
