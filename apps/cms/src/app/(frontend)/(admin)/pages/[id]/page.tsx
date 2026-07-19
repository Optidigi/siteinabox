import { notFound, redirect } from "next/navigation"
import { requireAuth } from "@/lib/authGate"
import { getPageById, listPages } from "@/lib/queries/pages"
import { getOrCreateSiteSettings } from "@/lib/queries/settings"
import { pageNavMembership } from "@/lib/nav/membership"
import { PageForm } from "@/components/forms/PageForm"
import { PageHeader } from "@/components/page-header"
import { captureCmsUsageEvent } from "@/lib/analytics/cms"
import { loadTenantManifest } from "@/lib/richText/loadManifest"
import { sameRelationshipId } from "@/lib/relationshipId"
import { normalizeThemeForSave } from "@/lib/theme/normalizeTheme"

export default async function EditTenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { ctx, user } = await requireAuth()
  if (ctx.mode === "super-admin") redirect("/sites")
  const readOnly = user.role === "viewer"
  const { id } = await params
  const tenantOrigin = process.env.NEXT_PUBLIC_PREVIEW_ORIGIN_OVERRIDE ?? `https://${ctx.tenant.domain}`
  const [page, manifest, settings, rendererNavPages] = await Promise.all([
    getPageById(Number(id)).catch(() => null),
    loadTenantManifest(ctx.tenant.id),
    getOrCreateSiteSettings(ctx.tenant.id),
    listPages(ctx.tenant.id),
  ])
  if (!page) notFound()
  if (!settings) notFound()
  if (!sameRelationshipId(page.tenant, ctx.tenant.id)) notFound()
  const canManageNav = user.role === "owner" || user.role === "super-admin"
  const { inHeader, inFooter } = pageNavMembership(settings, Number(page.id))
  await captureCmsUsageEvent({ event: "cms_page_editor_opened", user, ctx, surface: "page-editor", action: "open" })
  return (
    <div className="flex flex-col gap-4">
      <div className="max-md:hidden">
        <PageHeader title={page.title} />
      </div>
      <PageForm
        initial={page}
        tenantId={ctx.tenant.id}
        tenantSlug={ctx.tenant.slug}
        tenantDomain={ctx.tenant.domain}
        baseHref="/pages"
        tenantOrigin={tenantOrigin}
        manifest={manifest}
        theme={normalizeThemeForSave(ctx.tenant.theme)}
        siteSettings={settings}
        rendererNavPages={rendererNavPages.filter((navPage) => navPage.status === "published").map((navPage) => ({ id: navPage.id, slug: navPage.slug, title: navPage.title }))}
        canManageNav={canManageNav}
        canEditSettings={canManageNav}
        inHeaderNav={inHeader}
        inFooterNav={inFooter}
        readOnly={readOnly}
      />
    </div>
  )
}
