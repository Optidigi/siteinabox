import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/authGate"
import { listMediaPaginated } from "@/lib/queries/media"
import { getMediaUsage } from "@/lib/queries/mediaUsage"
import { MediaGrid } from "@/components/media/MediaGrid"
import { MediaUploader } from "@/components/media/MediaUploader"
import { ListPagination } from "@/components/list-pagination"
import { PageHeader } from "@/components/page-header"
import { getAdminTranslations } from "@/i18n/admin"

const PAGE_SIZE = 50

export default async function TenantMediaPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { user, ctx } = await requireAuth()
  if (ctx.mode === "super-admin") redirect("/sites")
  const canManageMedia = user.role === "owner" || user.role === "editor"
  const t = await getAdminTranslations(user, "lists")
  const sp = await searchParams
  const [result, usage] = await Promise.all([
    listMediaPaginated(ctx.tenant.id, { page: Number(sp.page) || 1, pageSize: PAGE_SIZE }),
    getMediaUsage(ctx.tenant.id)
  ])
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("media.title")}
        action={canManageMedia ? <MediaUploader tenantId={ctx.tenant.id} refreshOnUploaded /> : undefined}
      />
      <MediaGrid
        items={result.docs}
        usage={usage}
        pagesBaseHref={canManageMedia ? "/pages" : null}
        canManage={canManageMedia}
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
