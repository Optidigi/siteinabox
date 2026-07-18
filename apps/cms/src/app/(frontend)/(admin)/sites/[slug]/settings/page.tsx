import { requireOwnerSelectedSite } from "@/lib/routePolicy"
import { getOrCreateSiteSettings } from "@/lib/queries/settings"
import { SettingsForm } from "@/components/forms/SettingsForm"
import { PageHeader } from "@/components/page-header"
import { TenantPill } from "@/components/layout/TenantPill"
import { getAdminTranslations } from "@/i18n/admin"
import { resolveSettingsContract } from "@/lib/settingsContract"

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  // FE-54: settings is owner-only (matches SiteSettings.access.update gate).
  // requireRole redirects editor/viewer to /?error=forbidden so direct URL
  // navigation can't reach the page; AppSidebar already hides the nav link.
  const { slug } = await params
  const { user, ctx, tenant } = await requireOwnerSelectedSite(slug)
  const t = await getAdminTranslations(user, "app")
  const settings = await getOrCreateSiteSettings(tenant.id)
  const canEdit = user.role === "super-admin" || user.role === "owner"
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("settings")}
        beforeTitle={<TenantPill tenant={{ name: tenant.name, slug: tenant.slug }} href={ctx.mode === "tenant" ? "/" : undefined} />}
      />
      <SettingsForm
        initial={settings}
        canEdit={canEdit}
        settingsContract={resolveSettingsContract(tenant.siteManifest as any)}
      />
    </div>
  )
}
