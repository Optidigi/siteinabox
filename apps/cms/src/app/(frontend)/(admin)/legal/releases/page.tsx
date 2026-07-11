import { ListPagination } from "@/components/list-pagination"
import { ListSearch } from "@/components/list-search"
import { PageHeader } from "@/components/page-header"
import { LegalReleasesTable, LegalRouteTabs } from "@/components/legal-operations"
import { requireRole } from "@/lib/authGate"
import { listLegalReleases } from "@/lib/queries/legalOperations"

const PAGE_SIZE = 20
export const dynamic = "force-dynamic"

export default async function LegalReleasesPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  await requireRole(["super-admin"])
  const sp = await searchParams
  const result = await listLegalReleases({ page: Number(sp.page) || 1, pageSize: PAGE_SIZE, q: sp.q })
  return <div className="flex flex-col gap-4">
    <PageHeader title="Juridische publicaties" subtitle="Onveranderlijke documenten uit Git, review en de release-pipeline." />
    <LegalRouteTabs activePath="/legal/releases" />
    <ListSearch placeholder="Zoek document, samenvatting of broncommit..." />
    <LegalReleasesTable rows={result.docs} />
    <ListPagination page={result.page} totalPages={result.totalPages} total={result.totalDocs} pageSize={PAGE_SIZE} />
  </div>
}
