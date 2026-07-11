import { PageHeader } from "@/components/page-header"
import { LegalAttentionTable, LegalRouteTabs, LegalStatusStrip } from "@/components/legal-operations"
import { requireRole } from "@/lib/authGate"
import { getLegalOperationsOverview } from "@/lib/queries/legalOperations"
import { getAdminTranslations } from "@/i18n/admin"

export const dynamic = "force-dynamic"

export default async function LegalOperationsOverviewPage() {
  const { user } = await requireRole(["super-admin"])
  const t = await getAdminTranslations(user, "legalOperations")
  const overview = await getLegalOperationsOverview()
  return <div className="flex flex-col gap-4">
    <PageHeader title={t("pages.overview.title")} subtitle={t("pages.overview.subtitle")} />
    <LegalRouteTabs activePath="/legal" />
    <LegalStatusStrip metrics={overview.metrics} />
    <LegalAttentionTable rows={overview.attention} />
  </div>
}
