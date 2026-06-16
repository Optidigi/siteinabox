import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/authGate"
import { listPagesPaginated } from "@/lib/queries/pages"
import { PagesTable } from "@/components/tables/PagesTable"
import { ListSearch } from "@/components/list-search"
import { ListPagination } from "@/components/list-pagination"
import { Button } from "@siteinabox/ui/components/button"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { getAdminTranslations } from "@/i18n/admin"
import { FileText, FileQuestion, Plus } from "lucide-react"
import Link from "next/link"

const PAGE_SIZE = 10

export default async function TenantPagesIndex({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const { user, ctx } = await requireAuth()
  if (ctx.mode === "super-admin") redirect("/sites")
  const canManagePages = user.role === "owner" || user.role === "editor"
  const t = await getAdminTranslations(user, "lists")
  const sp = await searchParams
  const q = String(sp.q ?? "").trim() || undefined
  const result = await listPagesPaginated(ctx.tenant.id, {
    page: Number(sp.page) || 1,
    pageSize: PAGE_SIZE,
    q,
  })
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("pages.title")}
        action={canManagePages ? <Button asChild><Link href="/pages/new"><Plus className="mr-1 h-4 w-4"/> {t("pages.new")}</Link></Button> : undefined}
      />
      <ListSearch placeholder={t("filterPages")} />
      <PagesTable
        data={result.docs as any}
        base="/pages"
        canManage={canManagePages}
        emptyState={
          q ? (
            <EmptyState
              icon={<FileQuestion className="h-10 w-10 text-muted-foreground" aria-hidden />}
              title={t("pages.noMatching")}
              description={t("pages.noMatchingDescription", { query: q })}
            />
          ) : (
            <EmptyState
              icon={<FileText className="h-10 w-10 text-muted-foreground" aria-hidden />}
              title={t("pages.none")}
              description={t("pages.noneDescription")}
              action={canManagePages ? (
                <Button asChild>
                  <Link href="/pages/new"><Plus className="h-4 w-4 mr-1" /> {t("pages.new")}</Link>
                </Button>
              ) : undefined}
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
