import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/authGate"
import { PageForm } from "@/components/forms/PageForm"
import { PageHeader } from "@/components/page-header"
import { loadTenantManifest } from "@/lib/richText/loadManifest"
import { loadTenantCss } from "@/lib/editor/loadTenantCss"
import { getAdminTranslations } from "@/i18n/admin"
import { getOrCreateSiteSettings } from "@/lib/queries/settings"
import { isOfficialTenant } from "@/lib/officialTenants"
import { listPages } from "@/lib/queries/pages"

export default async function NewTenantPage() {
  const { ctx, user } = await requireAuth()
  if (ctx.mode === "super-admin") redirect("/sites")
  if (user.role === "viewer") redirect("/?error=forbidden")
  const t = await getAdminTranslations(user, "pages")
  const [manifest, tenantCss, settings, rendererNavPages] = await Promise.all([
    loadTenantManifest(ctx.tenant.id),
    loadTenantCss(ctx.tenant.id),
    getOrCreateSiteSettings(ctx.tenant.id),
    listPages(ctx.tenant.id),
  ])
  return (
    <div className="flex flex-col gap-4">
      <div className="max-md:hidden">
        <PageHeader title={t("new")} />
      </div>
      <PageForm
        tenantId={ctx.tenant.id}
        tenantSlug={ctx.tenant.slug}
        tenantDomain={ctx.tenant.domain}
        baseHref="/pages"
        tenantOrigin={`https://${ctx.tenant.domain}`}
        manifest={manifest}
        tenantCss={tenantCss}
        userEditorMode={user.editorMode ?? null}
        theme={ctx.tenant.theme as any}
        siteSettings={settings}
        rendererNavPages={(rendererNavPages as any[]).filter((page) => page.status === "published").map((page) => ({ id: page.id, slug: page.slug, title: page.title }))}
        canEditSettings={user.role === "owner" || user.role === "super-admin"}
        autoPublishLive={isOfficialTenant(ctx.tenant)}
      />
    </div>
  )
}
