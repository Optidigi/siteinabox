import { PageHeader } from "@/components/page-header"
import { OperationsAttentionTable } from "@/components/generation/OperationsAttentionTable"
import { OperationsRouteTabs } from "@/components/generation/OperationsRouteTabs"
import { OperationsStatusStrip } from "@/components/generation/OperationsStatusStrip"
import { getAdminTranslations } from "@/i18n/admin"
import { requireRole } from "@/lib/authGate"
import { getGenerationOperationsOverview } from "@/lib/queries/generationOperations"

export const dynamic = "force-dynamic"

export default async function OperationsOverviewPage() {
  const { user } = await requireRole(["super-admin"])
  const t = await getAdminTranslations(user, "generationOperations")
  const overview = await getGenerationOperationsOverview()
  return <div className="flex flex-col gap-4">
    <PageHeader title={t("pages.overview.title")} subtitle={t("pages.overview.subtitle")} />
    <OperationsRouteTabs activePath="/operations" />
    <OperationsStatusStrip metrics={overview.metrics} />
    <OperationsAttentionTable rows={overview.attention} />
  </div>
}
