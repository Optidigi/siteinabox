import { notFound, redirect } from "next/navigation"
import { requireAuth } from "@/lib/authGate"
import { getPageById, listPages } from "@/lib/queries/pages"
import { getOrCreateSiteSettings } from "@/lib/queries/settings"
import { pageNavMembership } from "@/lib/nav/membership"
import { PageForm } from "@/components/forms/PageForm"
import { PageHeader } from "@/components/page-header"
import { captureCmsUsageEvent } from "@/lib/analytics/cms"
import { loadTenantManifest } from "@/lib/richText/loadManifest"
import { loadTenantCss } from "@/lib/editor/loadTenantCss"
import { sameRelationshipId } from "@/lib/relationshipId"
import { isOfficialTenant } from "@/lib/officialTenants"

export default async function EditTenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { ctx, user } = await requireAuth()
  if (ctx.mode === "super-admin") redirect("/sites")
  const readOnly = user.role === "viewer"
  const { id } = await params
  const tenantOrigin = process.env.NEXT_PUBLIC_PREVIEW_ORIGIN_OVERRIDE ?? `https://${ctx.tenant.domain}`
  const [page, manifest, tenantCss, settings, rendererNavPages] = await Promise.all([
    getPageById(Number(id)).catch(() => null),
    loadTenantManifest(ctx.tenant.id),
    loadTenantCss(ctx.tenant.id),
    getOrCreateSiteSettings(ctx.tenant.id),
    listPages(ctx.tenant.id),
  ])
  if (!page) notFound()
  if (!sameRelationshipId(page.tenant, ctx.tenant.id)) notFound()
  // OBS-21 — nav membership feeds the page-editor toggles. Nav is settings-
  // class (owner/super-admin); editors edit page content but not nav.
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
        tenantCss={tenantCss}
        userEditorMode={user.editorMode ?? null}
        theme={ctx.tenant.theme as any}
        siteSettings={settings}
        rendererNavPages={(rendererNavPages as any[]).filter((page) => page.status === "published").map((page) => ({ id: page.id, slug: page.slug, title: page.title }))}
        canManageNav={canManageNav}
        canEditSettings={canManageNav}
        autoPublishLive={isOfficialTenant(ctx.tenant)}
        inHeaderNav={inHeader}
        inFooterNav={inFooter}
        readOnly={readOnly}
      />
    </div>
  )
}
