import { requireSuperAdminSelectedSite } from "@/lib/routePolicy"
import { PageForm } from "@/components/forms/PageForm"
import { PageHeader } from "@/components/page-header"
import { TenantPill } from "@/components/layout/TenantPill"
import { loadTenantManifest } from "@/lib/richText/loadManifest"
import { loadTenantCss } from "@/lib/editor/loadTenantCss"
import { getAdminTranslations } from "@/i18n/admin"
import { getOrCreateSiteSettings } from "@/lib/queries/settings"
import type { ThemeTokens } from "@/lib/theme/schema"
import { isOfficialTenant } from "@/lib/officialTenants"

export default async function NewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { user, tenant } = await requireSuperAdminSelectedSite(slug)
  const t = await getAdminTranslations(user, "pages")
  const [manifest, tenantCss, settings] = await Promise.all([
    loadTenantManifest(tenant.id),
    loadTenantCss(tenant.id),
    getOrCreateSiteSettings(tenant.id),
  ])
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("new")}
        beforeTitle={<TenantPill tenant={{ name: tenant.name, slug: tenant.slug }} />}
      />
      <PageForm
        tenantId={tenant.id}
        baseHref={`/sites/${slug}/pages`}
        // FN-2026-0047 — see /pages/[id]/page.tsx for the env override note.
        tenantOrigin={
          process.env.NEXT_PUBLIC_PREVIEW_ORIGIN_OVERRIDE ?? `https://${tenant.domain}`
        }
        manifest={manifest}
        tenantCss={tenantCss}
        userEditorMode={user.editorMode ?? null}
        theme={tenant.theme as ThemeTokens | null}
        siteSettings={settings}
        canEditSettings
        autoPublishLive={isOfficialTenant(tenant)}
      />
    </div>
  )
}
