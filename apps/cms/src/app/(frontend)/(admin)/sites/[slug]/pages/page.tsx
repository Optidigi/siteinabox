import { requireSuperAdminSelectedSite } from "@/lib/routePolicy"
import { listPagesPaginated } from "@/lib/queries/pages"
import { PagesTable } from "@/components/tables/PagesTable"
import { ListSearch } from "@/components/list-search"
import { ListPagination } from "@/components/list-pagination"
import { Button } from "@siteinabox/ui/components/button"
import { PageHeader } from "@/components/page-header"
import { TenantPill } from "@/components/layout/TenantPill"
import { EmptyState } from "@/components/empty-state"
import { FileText, FileQuestion, Plus } from "lucide-react"
import Link from "next/link"
import { getAdminTranslations } from "@/i18n/admin"

const PAGE_SIZE = 10

export default async function PagesIndex({
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
  const result = await listPagesPaginated(tenant.id, {
    page: Number(sp.page) || 1,
    pageSize: PAGE_SIZE,
    q,
  })
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("pages.title")}
        beforeTitle={<TenantPill tenant={{ name: tenant.name, slug: tenant.slug }} />}
        action={<Button asChild><Link href={`/sites/${slug}/pages/new`}><Plus className="mr-1 h-4 w-4"/> {t("pages.new")}</Link></Button>}
      />
      <ListSearch placeholder={t("filterPages")} />
      <PagesTable
        data={result.docs as any}
        base={`/sites/${slug}/pages`}
        canManage
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
              action={
                <Button asChild>
                  <Link href={`/sites/${slug}/pages/new`}>
                    <Plus className="h-4 w-4 mr-1" /> {t("pages.new")}
                  </Link>
                </Button>
              }
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
