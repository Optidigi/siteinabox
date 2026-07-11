import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/authGate"
import { getOrCreateSiteSettings } from "@/lib/queries/settings"
import { SettingsForm } from "@/components/forms/SettingsForm"
import { PageHeader } from "@/components/page-header"
import { getAdminTranslations } from "@/i18n/admin"
import { resolveSettingsContract } from "@/lib/settingsContract"
import { isOfficialTenant } from "@/lib/officialTenants"
import { getPayload } from "payload"
import config from "@/payload.config"
import { getTenantLegalAcceptanceHistory, getTenantLegalRequirements } from "@/lib/legal/customerRequirements"
import { LegalAgreementsSection } from "@/components/legal/LegalAgreementsSection"
import { resolveLocale } from "@/i18n/config"

export default async function TenantSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ legal?: string }>
}) {
  const { user, ctx } = await requireAuth()
  if (ctx.mode === "super-admin") redirect("/sites")
  if (user.role !== "owner") redirect("/?error=forbidden")
  const t = await getAdminTranslations(user, "app")
  const payloadPromise = getPayload({ config })
  const [settings, legalRequirements, acceptanceHistory, query] = await Promise.all([
    getOrCreateSiteSettings(ctx.tenant.id),
    payloadPromise.then((payload) => getTenantLegalRequirements(payload, ctx.tenant.id)),
    payloadPromise.then((payload) => getTenantLegalAcceptanceHistory(payload, ctx.tenant.id)),
    searchParams,
  ])
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("settings")} />
      <SettingsForm
        initial={settings}
        canEdit
        settingsContract={resolveSettingsContract(ctx.tenant.siteManifest as any)}
        tenantId={ctx.tenant.id}
        autoPublishLive={isOfficialTenant(ctx.tenant)}
      />
      <LegalAgreementsSection requirements={legalRequirements} acceptanceHistory={acceptanceHistory} locale={resolveLocale(user.language)} result={query.legal} />
    </div>
  )
}
