import type { Metadata } from "next"
import { getTenantBySlug } from "@/lib/queries/tenants"
import { getPageBySlug, listPages } from "@/lib/queries/pages"
import { requireSuperAdminSelectedSite } from "@/lib/routePolicy"
import { PageForm } from "@/components/forms/PageForm"
import { PageHeader } from "@/components/page-header"
import { TenantPill } from "@/components/layout/TenantPill"
import { captureCmsUsageEvent } from "@/lib/analytics/cms"
import { notFound } from "next/navigation"
import { loadTenantManifest } from "@/lib/richText/loadManifest"
import { getOrCreateSiteSettings } from "@/lib/queries/settings"
import { pageNavMembership } from "@/lib/nav/membership"
import { sameRelationshipId } from "@/lib/relationshipId"
import type { ThemeTokens } from "@/lib/theme/schema"
import { isOfficialTenant } from "@/lib/officialTenants"

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string; pageSlug: string }> }
): Promise<Metadata> {
  const { slug, pageSlug } = await params
  const tenant = await getTenantBySlug(slug)
  const page = tenant ? await getPageBySlug(tenant.id, decodeURIComponent(pageSlug)).catch(() => null) : null
  if (!tenant || !page) return { title: "Page" }
  return { title: `${page.title} · ${tenant.name}` }
}

export default async function EditPageBySlug({ params }: { params: Promise<{ slug: string; pageSlug: string }> }) {
  const { slug, pageSlug } = await params
  const { user, ctx, tenant } = await requireSuperAdminSelectedSite(slug)
  const tenantOrigin = process.env.NEXT_PUBLIC_PREVIEW_ORIGIN_OVERRIDE ?? `https://${tenant.domain}`
  const [page, manifest, settings, rendererNavPages] = await Promise.all([
    getPageBySlug(tenant.id, decodeURIComponent(pageSlug)).catch(() => null),
    loadTenantManifest(tenant.id),
    getOrCreateSiteSettings(tenant.id),
    listPages(tenant.id),
  ])
  if (!page) notFound()
  if (!sameRelationshipId(page.tenant, tenant.id)) notFound()
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
        tenantOrigin={tenantOrigin}
        manifest={manifest}
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
