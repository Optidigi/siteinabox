import { getPayload } from "payload"
import config from "@/payload.config"
import { canRepublishWorkspace } from "@/lib/workspace/manualAccess"
import { platformCmsOrigin } from "@/lib/hostToTenant"
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
        canPublish={await canRepublishWorkspace(await getPayload({ config }), String(tenant.id))}
        tenantId={tenant.id}
        tenantSlug={tenant.slug}
        tenantDomain={tenant.domain}
        baseHref={`/sites/${slug}/pages`}
        // FN-2026-0047 — see /pages/[id]/page.tsx for the env override note.
        tenantOrigin={
          process.env.NEXT_PUBLIC_PREVIEW_ORIGIN_OVERRIDE ?? (tenant.domain ? `https://${tenant.domain}` : platformCmsOrigin())
        }
        manifest={manifest}
        theme={tenant.theme as ThemeTokens | null}
        siteSettings={settings}
        rendererNavPages={rendererNavPages.map((navPage) => ({ id: navPage.id, slug: navPage.slug, title: navPage.title }))}
        canEditSettings
      />
    </div>
  )
}
