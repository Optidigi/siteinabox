import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/authGate"
import { getOrCreateSiteSettings } from "@/lib/queries/settings"
import { SettingsForm } from "@/components/forms/SettingsForm"
import { PageHeader } from "@/components/page-header"
import { getAdminTranslations } from "@/i18n/admin"
import { resolveSettingsContract } from "@/lib/settingsContract"
import { getPayload } from "payload"
import config from "@/payload.config"
import { getTenantLegalAcceptanceHistory, getTenantLegalRequirements } from "@/lib/legal/customerRequirements"
import { LegalAgreementsSection } from "@/components/legal/LegalAgreementsSection"
import { resolveLocale } from "@/i18n/config"
import {
  findCommunicationPreference,
  findTenantNotificationSubscription,
} from "@/lib/legal/communicationPreferences"
import type { User } from "@/payload-types"
import { EmailPreferencesSection, type TenantNotificationMemberView } from "@/components/email/EmailPreferencesSection"

export default async function TenantSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ legal?: string; emailPreferences?: string }>
}) {
  const { user, ctx } = await requireAuth()
  if (ctx.mode === "super-admin") redirect("/sites")
  const t = await getAdminTranslations(user, "app")
  const payloadPromise = getPayload({ config })
  const isOwner = user.role === "owner"
  const [settings, legalRequirements, acceptanceHistory, query, personalPreference, tenantMembers] = await Promise.all([
    isOwner ? getOrCreateSiteSettings(ctx.tenant.id) : Promise.resolve(null),
    isOwner ? payloadPromise.then((payload) => getTenantLegalRequirements(payload, ctx.tenant.id)) : Promise.resolve([]),
    isOwner ? payloadPromise.then((payload) => getTenantLegalAcceptanceHistory(payload, ctx.tenant.id)) : Promise.resolve([]),
    searchParams,
    payloadPromise.then((payload) => findCommunicationPreference(payload, user.email)),
    isOwner
      ? payloadPromise.then((payload) => payload.find({
          collection: "users",
          where: { "tenants.tenant": { equals: ctx.tenant.id } },
          limit: 100,
          sort: "name",
          depth: 0,
          user,
        }))
      : Promise.resolve({ docs: [] }),
  ])

  const payload = await payloadPromise
  const members: TenantNotificationMemberView[] = await Promise.all(tenantMembers.docs
    .filter((member: User) => member.role === "owner" || member.role === "editor" || member.role === "viewer")
    .map(async (member) => {
    const subscription = await findTenantNotificationSubscription(payload, ctx.tenant.id, member.id)
    return {
      userId: String(member.id),
      name: member.name || member.email,
      email: member.email,
      role: member.role as "owner" | "editor" | "viewer",
      categories: {
        formSubmissions: subscription?.formSubmissions === true,
        publishingAndSiteStatus: subscription?.publishingAndSiteStatus === true,
        domainAndDns: subscription?.domainAndDns === true,
        billingAndPayments: subscription?.billingAndPayments === true,
        teamAndAccess: subscription?.teamAndAccess === true,
      },
    }
  }))
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("settings")} />
      <EmailPreferencesSection
        personal={{
          marketing: personalPreference?.marketing === true,
          productNotifications: personalPreference?.productNotifications === true,
          locale: personalPreference?.locale === "en" ? "en" : resolveLocale(user.language),
          updatedAt: personalPreference?.updatedAt,
        }}
        members={members}
        canManageTenantNotifications={isOwner}
        result={query.emailPreferences}
      />
      {isOwner && settings && (
        <SettingsForm
          initial={settings}
          canEdit
          settingsContract={resolveSettingsContract(ctx.tenant.siteManifest)}
        />
      )}
      {isOwner && <LegalAgreementsSection requirements={legalRequirements} acceptanceHistory={acceptanceHistory} locale={resolveLocale(user.language)} result={query.legal} />}
    </div>
  )
}
