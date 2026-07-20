import { requireSuperAdminSelectedSite } from "@/lib/routePolicy"
import { listMediaPaginated } from "@/lib/queries/media"
import { getMediaUsage } from "@/lib/queries/mediaUsage"
import { MediaGrid } from "@/components/media/MediaGrid"
import { MediaUploader } from "@/components/media/MediaUploader"
import { ListPagination } from "@/components/list-pagination"
import { PageHeader } from "@/components/page-header"
import { TenantPill } from "@/components/layout/TenantPill"
import { getAdminTranslations } from "@/i18n/admin"

const PAGE_SIZE = 50

export default async function MediaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { slug } = await params
  const { user, tenant } = await requireSuperAdminSelectedSite(slug)
  const t = await getAdminTranslations(user, "lists")
  const sp = await searchParams
  const [result, usage] = await Promise.all([
    listMediaPaginated(tenant.id, { page: Number(sp.page) || 1, pageSize: PAGE_SIZE }),
    getMediaUsage(tenant.id)
  ])
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("media.title")}
        beforeTitle={<TenantPill tenant={{ name: tenant.name, slug: tenant.slug }} />}
        action={<MediaUploader tenantId={tenant.id} refreshOnUploaded />}
      />
      <MediaGrid items={result.docs} usage={usage} pagesBaseHref={`/sites/${slug}/pages`} canManage />
      <ListPagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.totalDocs}
        pageSize={PAGE_SIZE}
      />
    </div>
  )
}
