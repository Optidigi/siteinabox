import { requireSuperAdminSelectedSite } from "@/lib/routePolicy"
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist"
import { PageHeader } from "@/components/page-header"
import { TenantPill } from "@/components/layout/TenantPill"
import { getAdminTranslations } from "@/i18n/admin"
import { getPayload } from "payload"
import config from "@/payload.config"

export default async function OnboardingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { user, tenant } = await requireSuperAdminSelectedSite(slug)
  const t = await getAdminTranslations(user, "onboarding")
  const payload = await getPayload({ config })
  const domains = await payload.find({
    collection: "managed-domains",
    where: {
      and: [
        { tenant: { equals: tenant.id } },
        { domainNameAscii: { equals: tenant.domain ?? "" } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const routing = domains.docs[0] ?? null
  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <PageHeader
        title={t("title")}
        beforeTitle={<TenantPill tenant={{ name: tenant.name, slug: tenant.slug }} />}
        subtitle={t("subtitle", { domain: tenant.domain })}
      />
      <OnboardingChecklist
        tenant={{ id: tenant.id, domain: tenant.domain ?? "" }}
        routing={routing ? {
          authoritativeDnsStatus: routing.authoritativeDnsStatus,
          edgeRoutingStatus: routing.edgeRoutingStatus,
          httpsStatus: routing.httpsStatus,
          adminHttpsStatus: routing.adminHttpsStatus,
          customerStatus: routing.customerStatus,
        } : null}
      />
    </div>
  )
}
