import { ListPagination } from "@/components/list-pagination"
import { PageHeader } from "@/components/page-header"
import { CommunicationPreferencesTable, LegalListToolbar, LegalRouteTabs, TenantNotificationsTable } from "@/components/legal-operations"
import { requireRole } from "@/lib/authGate"
import { listCommunicationPreferences, listTenantNotificationSubscriptions } from "@/lib/queries/legalOperations"
import { getAdminTranslations } from "@/i18n/admin"

const PAGE_SIZE = 20
export const dynamic = "force-dynamic"

export default async function LegalCommunicationsPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string; status?: string }> }) {
  const { user } = await requireRole(["super-admin"])
  const t = await getAdminTranslations(user, "legalOperations")
  const sp = await searchParams
  const status = sp.status || "all"
  const [preferences, subscriptions] = await Promise.all([
    listCommunicationPreferences({ page: Number(sp.page) || 1, pageSize: PAGE_SIZE, q: sp.q, status }),
    listTenantNotificationSubscriptions({ page: 1, pageSize: 100, q: sp.q }),
  ])
  const statuses = ["all", "opted_in", "opted_out", "suppressed"].map((value) => ({ value, label: t(`communicationsUi.filters.${value}`) }))
  return <div className="flex flex-col gap-4">
    <PageHeader title={t("communicationsUi.pageTitle")} subtitle={t("communicationsUi.pageSubtitle")} />
    <LegalRouteTabs activePath="/legal/communications" />
    <LegalListToolbar placeholder={t("communicationsUi.search")} activeStatus={status} statuses={statuses} basePath="/legal/communications" query={sp.q} />
    <CommunicationPreferencesTable rows={preferences.docs} />
    <ListPagination page={preferences.page} totalPages={preferences.totalPages} total={preferences.totalDocs} pageSize={PAGE_SIZE} />
    <TenantNotificationsTable rows={subscriptions.docs} />
  </div>
}
