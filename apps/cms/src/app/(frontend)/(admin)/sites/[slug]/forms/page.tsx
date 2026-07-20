import { requireSuperAdminSelectedSite } from "@/lib/routePolicy"
import { listFormsPaginated } from "@/lib/queries/forms"
import { FormsTable } from "@/components/tables/FormsTable"
import { ListSearch } from "@/components/list-search"
import { ListPagination } from "@/components/list-pagination"
import { PageHeader } from "@/components/page-header"
import { TenantPill } from "@/components/layout/TenantPill"
import { EmptyState } from "@/components/empty-state"
import { Inbox, FileQuestion } from "lucide-react"
import { getAdminTranslations } from "@/i18n/admin"

const PAGE_SIZE = 10

export default async function FormsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const { slug } = await params
  const { user, tenant } = await requireSuperAdminSelectedSite(slug)
  const t = await getAdminTranslations(user, "lists")
  const sp = await searchParams
  const q = String(sp.q ?? "").trim() || undefined
  const result = await listFormsPaginated(tenant.id, {
    page: Number(sp.page) || 1,
    pageSize: PAGE_SIZE,
    q,
  })
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("forms.title")}
        beforeTitle={<TenantPill tenant={{ name: tenant.name, slug: tenant.slug }} />}
      />
      <ListSearch placeholder={t("filterByEmail")} />
      <FormsTable
        data={result.docs}
        emptyState={
          q ? (
            <EmptyState
              icon={<FileQuestion className="h-10 w-10 text-muted-foreground" aria-hidden />}
              title={t("forms.noMatching")}
              description={t("forms.noMatchingDescription", { query: q })}
            />
          ) : (
            <EmptyState
              icon={<Inbox className="h-10 w-10 text-muted-foreground" aria-hidden />}
              title={t("forms.none")}
              description={t("forms.noneDescription")}
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
