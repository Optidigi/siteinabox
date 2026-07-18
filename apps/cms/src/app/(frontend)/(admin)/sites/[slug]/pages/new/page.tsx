import { requireSuperAdminSelectedSite } from "@/lib/routePolicy"
import { PageForm } from "@/components/forms/PageForm"
import { PageHeader } from "@/components/page-header"
import { TenantPill } from "@/components/layout/TenantPill"
import { loadTenantManifest } from "@/lib/richText/loadManifest"
import { getAdminTranslations } from "@/i18n/admin"
import { getOrCreateSiteSettings } from "@/lib/queries/settings"
import type { ThemeTokens } from "@/lib/theme/schema"
import { listPages } from "@/lib/queries/pages"

export default async function NewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { user, tenant } = await requireSuperAdminSelectedSite(slug)
  const t = await getAdminTranslations(user, "pages")
  const [manifest, settings, rendererNavPages] = await Promise.all([
    loadTenantManifest(tenant.id),
    getOrCreateSiteSettings(tenant.id),
    listPages(tenant.id),
  ])
  return (
    <div className="flex flex-col gap-4">
      <div className="max-md:hidden">
        <PageHeader
          title={t("new")}
          beforeTitle={<TenantPill tenant={{ name: tenant.name, slug: tenant.slug }} />}
        />
      </div>
      <PageForm
        tenantId={tenant.id}
        tenantSlug={tenant.slug}
        tenantDomain={tenant.domain}
        baseHref={`/sites/${slug}/pages`}
        // FN-2026-0047 — see /pages/[id]/page.tsx for the env override note.
        tenantOrigin={
          process.env.NEXT_PUBLIC_PREVIEW_ORIGIN_OVERRIDE ?? `https://${tenant.domain}`
        }
        manifest={manifest}
        theme={tenant.theme as ThemeTokens | null}
        siteSettings={settings}
        rendererNavPages={(rendererNavPages as any[]).filter((page) => page.status === "published").map((page) => ({ id: page.id, slug: page.slug, title: page.title }))}
        canEditSettings
      />
    </div>
  )
}
