import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/authGate"
import { PageForm } from "@/components/forms/PageForm"
import { PageHeader } from "@/components/page-header"
import { loadTenantManifest } from "@/lib/richText/loadManifest"
import { loadTenantCss } from "@/lib/editor/loadTenantCss"
import { getAdminTranslations } from "@/i18n/admin"
import { getOrCreateSiteSettings } from "@/lib/queries/settings"
import { isOfficialTenant } from "@/lib/officialTenants"

export default async function NewTenantPage() {
  const { ctx, user } = await requireAuth()
  if (ctx.mode === "super-admin") redirect("/sites")
  if (user.role === "viewer") redirect("/?error=forbidden")
  const t = await getAdminTranslations(user, "pages")
  const [manifest, tenantCss, settings] = await Promise.all([
    loadTenantManifest(ctx.tenant.id),
    loadTenantCss(ctx.tenant.id),
    getOrCreateSiteSettings(ctx.tenant.id),
  ])
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("new")} />
      <PageForm
        tenantId={ctx.tenant.id}
        baseHref="/pages"
        tenantOrigin={`https://${ctx.tenant.domain}`}
        manifest={manifest}
        tenantCss={tenantCss}
        userEditorMode={user.editorMode ?? null}
        theme={ctx.tenant.theme as any}
        siteSettings={settings}
        canEditSettings={user.role === "owner" || user.role === "super-admin"}
        autoPublishLive={isOfficialTenant(ctx.tenant)}
      />
    </div>
  )
}
