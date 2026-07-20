import { requireRole } from "@/lib/authGate"
import { listTenantsPaginated } from "@/lib/queries/tenants"
import { TenantsTable } from "@/components/tables/TenantsTable"
import { ListSearch } from "@/components/list-search"
import { ListPagination } from "@/components/list-pagination"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { TenantCreateDialog } from "@/components/forms/TenantCreateDialog"
import { getAdminTranslations } from "@/i18n/admin"
import { Globe, Search } from "lucide-react"

const PAGE_SIZE = 10

export default async function SitesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const { user } = await requireRole(["super-admin"])
  const t = await getAdminTranslations(user, "lists")
  const sp = await searchParams
  const q = String(sp.q ?? "").trim() || undefined
  const result = await listTenantsPaginated({ page: Number(sp.page) || 1, pageSize: PAGE_SIZE, q })
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("sites.title")} action={<TenantCreateDialog />} />
      <ListSearch placeholder={t("filterSites")} />
      <TenantsTable
        data={result.docs}
        emptyState={
          q ? (
            <EmptyState
              icon={<Search className="h-10 w-10 text-muted-foreground" aria-hidden />}
              title={t("sites.noMatching")}
              description={t("sites.noMatchingDescription", { query: q })}
            />
          ) : (
            <EmptyState
              icon={<Globe className="h-10 w-10 text-muted-foreground" aria-hidden />}
              title={t("sites.none")}
              description={t("sites.noneDescription")}
              action={<TenantCreateDialog />}
            />
          )
        }
      />
      <ListPagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.totalDocs}
        pageSize={PAGE_SIZE}
      />
    </div>
  )
}
