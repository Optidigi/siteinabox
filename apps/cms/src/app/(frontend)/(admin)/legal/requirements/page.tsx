import { ListPagination } from "@/components/list-pagination"
import { PageHeader } from "@/components/page-header"
import { LegalListToolbar, LegalRequirementsTable, LegalRouteTabs } from "@/components/legal-operations"
import { requireRole } from "@/lib/authGate"
import { listLegalRequirements } from "@/lib/queries/legalOperations"

const PAGE_SIZE = 20
const statuses = [{ value: "all", label: "Alle" }, { value: "open", label: "Open" }, { value: "pending", label: "Openstaand" }, { value: "notified", label: "Genotificeerd" }, { value: "failed", label: "Mislukt" }, { value: "satisfied", label: "Voldaan" }, { value: "waived", label: "Vrijgesteld" }]
export const dynamic = "force-dynamic"

export default async function LegalRequirementsPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string; status?: string }> }) {
  await requireRole(["super-admin"])
  const sp = await searchParams
  const status = statuses.some((item) => item.value === sp.status) ? sp.status! : "all"
  const result = await listLegalRequirements({ page: Number(sp.page) || 1, pageSize: PAGE_SIZE, q: sp.q, status })
  return <div className="flex flex-col gap-4">
    <PageHeader title="Juridische klantacties" subtitle="Vereiste kennisgeving en acceptatie per klantaccount." />
    <LegalRouteTabs activePath="/legal/requirements" />
    <LegalListToolbar placeholder="Zoek account of vereiste..." activeStatus={status} statuses={statuses} basePath="/legal/requirements" query={sp.q} />
    <LegalRequirementsTable rows={result.docs} />
    <ListPagination page={result.page} totalPages={result.totalPages} total={result.totalDocs} pageSize={PAGE_SIZE} />
  </div>
}
