import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/authGate"
import { listFormsPaginated } from "@/lib/queries/forms"
import { FormsTable } from "@/components/tables/FormsTable"
import { ListSearch } from "@/components/list-search"
import { ListPagination } from "@/components/list-pagination"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { getAdminTranslations } from "@/i18n/admin"
import { Inbox, FileQuestion } from "lucide-react"

const PAGE_SIZE = 10

export default async function TenantFormsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const { user, ctx } = await requireAuth()
  if (ctx.mode === "super-admin") redirect("/sites")
  const t = await getAdminTranslations(user, "lists")
  const sp = await searchParams
  const q = String(sp.q ?? "").trim() || undefined
  const result = await listFormsPaginated(ctx.tenant.id, {
    page: Number(sp.page) || 1,
    pageSize: PAGE_SIZE,
    q,
  })
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("forms.title")} />
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
