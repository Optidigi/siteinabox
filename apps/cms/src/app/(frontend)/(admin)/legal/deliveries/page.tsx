import { ListPagination } from "@/components/list-pagination"
import { PageHeader } from "@/components/page-header"
import { LegalDeliveriesTable, LegalListToolbar, LegalRouteTabs } from "@/components/legal-operations"
import { requireRole } from "@/lib/authGate"
import { listLegalDeliveries } from "@/lib/queries/legalOperations"

const PAGE_SIZE = 20
const statuses = [{ value: "all", label: "Alle" }, { value: "queued", label: "In wachtrij" }, { value: "processing", label: "Bezig" }, { value: "sent", label: "Naar provider verzonden" }, { value: "failed", label: "Mislukt" }, { value: "cancelled", label: "Geannuleerd" }]
export const dynamic = "force-dynamic"

export default async function LegalDeliveriesPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string; status?: string }> }) {
  await requireRole(["super-admin"])
  const sp = await searchParams
  const status = statuses.some((item) => item.value === sp.status) ? sp.status! : "all"
  const result = await listLegalDeliveries({ page: Number(sp.page) || 1, pageSize: PAGE_SIZE, q: sp.q, status })
  return <div className="flex flex-col gap-4">
    <PageHeader title="Juridische verzendingen" subtitle="Provider-overdracht, pogingen en herstel van juridische e-mailkennisgevingen." />
    <LegalRouteTabs activePath="/legal/deliveries" />
    <LegalListToolbar placeholder="Zoek ontvanger of verzendsleutel..." activeStatus={status} statuses={statuses} basePath="/legal/deliveries" query={sp.q} />
    <LegalDeliveriesTable rows={result.docs} />
    <ListPagination page={result.page} totalPages={result.totalPages} total={result.totalDocs} pageSize={PAGE_SIZE} />
  </div>
}
