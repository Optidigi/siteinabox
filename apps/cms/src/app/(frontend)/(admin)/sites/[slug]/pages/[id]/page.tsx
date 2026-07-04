import type { Metadata } from "next"
import { getTenantBySlug } from "@/lib/queries/tenants"
import { getPageById, listPages } from "@/lib/queries/pages"
import { requireSuperAdminSelectedSite } from "@/lib/routePolicy"
import { PageForm } from "@/components/forms/PageForm"
import { PageHeader } from "@/components/page-header"
import { TenantPill } from "@/components/layout/TenantPill"
import { captureCmsUsageEvent } from "@/lib/analytics/cms"
import { notFound } from "next/navigation"
import { loadTenantManifest } from "@/lib/richText/loadManifest"
import { loadTenantCss } from "@/lib/editor/loadTenantCss"
import { getOrCreateSiteSettings } from "@/lib/queries/settings"
import { pageNavMembership } from "@/lib/nav/membership"
import { sameRelationshipId } from "@/lib/relationshipId"
import type { ThemeTokens } from "@/lib/theme/schema"
import { isOfficialTenant } from "@/lib/officialTenants"

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string; id: string }> }
): Promise<Metadata> {
  const { slug, id } = await params
  const [tenant, page] = await Promise.all([getTenantBySlug(slug), getPageById(Number(id)).catch(() => null)])
  if (!tenant || !page) return { title: "Page" }
  return { title: `${page.title} · ${tenant.name}` }
}

export default async function EditPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params
  const { user, ctx, tenant } = await requireSuperAdminSelectedSite(slug)
  // FN-2026-0023 fix — `payload.findByID` throws on missing rows; the prior
  // shape `await getPageById(Number(id))` propagated the throw through to a
  // 500 server-component error before the `if (!page) notFound()` guard
  // could fire. Catch the throw, normalise to null, then let notFound()
  // render the standard 404 page. Mirror of the same `.catch(() => null)`
  // pattern already used in this file's `generateMetadata` (UX-2026-0001
  // batch-1).
  const tenantOrigin = process.env.NEXT_PUBLIC_PREVIEW_ORIGIN_OVERRIDE ?? `https://${tenant.domain}`
  const [page, manifest, tenantCss, settings, rendererNavPages] = await Promise.all([
    getPageById(Number(id)).catch(() => null),
    loadTenantManifest(tenant.id),
    loadTenantCss(tenant.id),
    getOrCreateSiteSettings(tenant.id),
    listPages(tenant.id),
  ])
  if (!page) notFound()
  if (!sameRelationshipId(page.tenant, tenant.id)) notFound()
  // OBS-21 — nav membership for the page-editor toggles. This route is
  // super-admin-only (requireRole above), so nav management is always allowed.
  const { inHeader, inFooter } = pageNavMembership(settings as any, Number(page.id))
  await captureCmsUsageEvent({ event: "cms_page_editor_opened", user, ctx, surface: "page-editor", action: "open" })
  return (
    <div className="flex flex-col gap-4">
      <div className="max-md:hidden">
        <PageHeader
          title={page.title}
          beforeTitle={<TenantPill tenant={{ name: tenant.name, slug: tenant.slug }} />}
        />
      </div>
      <PageForm
        initial={page as any}
        tenantId={tenant.id}
        tenantSlug={tenant.slug}
        tenantDomain={tenant.domain}
        baseHref={`/sites/${slug}/pages`}
        // FN-2026-0047 — preview iframe origin. Production: https://<domain>.
        // Dev (no /etc/hosts entry, no local reverse proxy): operator can set
        // NEXT_PUBLIC_PREVIEW_ORIGIN_OVERRIDE to a reachable URL (e.g.
        // http://localhost:5173). The pre-fix shape always built
        // https://${tenant.domain} and the iframe failed with
        // ERR_CONNECTION_REFUSED in any direct-local dev setup.
        tenantOrigin={tenantOrigin}
        manifest={manifest}
        tenantCss={tenantCss}
        userEditorMode={user.editorMode ?? null}
        theme={tenant.theme as ThemeTokens | null}
        siteSettings={settings}
        rendererNavPages={(rendererNavPages as any[]).filter((page) => page.status === "published").map((page) => ({ id: page.id, slug: page.slug, title: page.title }))}
        canManageNav
        canEditSettings
        autoPublishLive={isOfficialTenant(tenant)}
        inHeaderNav={inHeader}
        inFooterNav={inFooter}
      />
    </div>
  )
}
