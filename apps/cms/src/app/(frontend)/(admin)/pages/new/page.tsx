import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/authGate"
import { PageForm } from "@/components/forms/PageForm"
import { PageHeader } from "@/components/page-header"
import { loadTenantManifest } from "@/lib/richText/loadManifest"
import { getAdminTranslations } from "@/i18n/admin"
import { getOrCreateSiteSettings } from "@/lib/queries/settings"
import { listPages } from "@/lib/queries/pages"
import { normalizeThemeForSave } from "@/lib/theme/normalizeTheme"

export default async function NewTenantPage() {
  const { ctx, user } = await requireAuth()
  if (ctx.mode === "super-admin") redirect("/sites")
  if (user.role === "viewer") redirect("/?error=forbidden")
  const t = await getAdminTranslations(user, "pages")
  const [manifest, settings, rendererNavPages] = await Promise.all([
    loadTenantManifest(ctx.tenant.id),
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
        theme={normalizeThemeForSave(ctx.tenant.theme)}
        siteSettings={settings}
        rendererNavPages={rendererNavPages.filter((navPage) => navPage.status === "published").map((navPage) => ({ id: navPage.id, slug: navPage.slug, title: navPage.title }))}
        canEditSettings={user.role === "owner" || user.role === "super-admin"}
      />
    </div>
  )
}
