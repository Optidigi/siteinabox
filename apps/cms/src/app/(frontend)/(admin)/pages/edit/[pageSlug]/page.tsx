import { notFound, redirect } from "next/navigation"
import { requireAuth } from "@/lib/authGate"
import { getPageBySlug, listPages } from "@/lib/queries/pages"
import { getOrCreateSiteSettings } from "@/lib/queries/settings"
import { pageNavMembership } from "@/lib/nav/membership"
import { PageForm } from "@/components/forms/PageForm"
import { PageHeader } from "@/components/page-header"
import { captureCmsUsageEvent } from "@/lib/analytics/cms"
import { loadTenantManifest } from "@/lib/richText/loadManifest"
import { sameRelationshipId } from "@/lib/relationshipId"

export default async function EditTenantPageBySlug({ params }: { params: Promise<{ pageSlug: string }> }) {
  const { ctx, user } = await requireAuth()
  if (ctx.mode === "super-admin") redirect("/sites")
  const readOnly = user.role === "viewer"
  const { pageSlug } = await params
  const tenantOrigin = process.env.NEXT_PUBLIC_PREVIEW_ORIGIN_OVERRIDE ?? `https://${ctx.tenant.domain}`
  const [page, manifest, settings, rendererNavPages] = await Promise.all([
    getPageBySlug(ctx.tenant.id, decodeURIComponent(pageSlug)).catch(() => null),
    loadTenantManifest(ctx.tenant.id),
    getOrCreateSiteSettings(ctx.tenant.id),
    listPages(ctx.tenant.id),
  ])
  if (!page) notFound()
  if (!sameRelationshipId(page.tenant, ctx.tenant.id)) notFound()
  const canManageNav = user.role === "owner" || user.role === "super-admin"
  const { inHeader, inFooter } = pageNavMembership(settings as any, Number(page.id))
  await captureCmsUsageEvent({ event: "cms_page_editor_opened", user, ctx, surface: "page-editor", action: "open" })
  return (
    <div className="flex flex-col gap-4">
      <div className="max-md:hidden">
        <PageHeader title={page.title} />
      </div>
      <PageForm
        initial={page as any}
        tenantId={ctx.tenant.id}
        tenantSlug={ctx.tenant.slug}
        tenantDomain={ctx.tenant.domain}
        baseHref="/pages"
        tenantOrigin={tenantOrigin}
        manifest={manifest}
        theme={ctx.tenant.theme as any}
        siteSettings={settings}
        rendererNavPages={(rendererNavPages as any[]).filter((page) => page.status === "published").map((page) => ({ id: page.id, slug: page.slug, title: page.title }))}
        canManageNav={canManageNav}
        canEditSettings={canManageNav}
        inHeaderNav={inHeader}
        inFooterNav={inFooter}
        readOnly={readOnly}
      />
    </div>
  )
}
