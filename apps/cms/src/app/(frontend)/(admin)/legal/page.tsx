import { PageHeader } from "@/components/page-header"
import { LegalAttentionTable, LegalRouteTabs, LegalStatusStrip } from "@/components/legal-operations"
import { requireRole } from "@/lib/authGate"
import { getLegalOperationsOverview } from "@/lib/queries/legalOperations"

export const dynamic = "force-dynamic"

export default async function LegalOperationsOverviewPage() {
  await requireRole(["super-admin"])
  const overview = await getLegalOperationsOverview()
  return <div className="flex flex-col gap-4">
    <PageHeader title="Juridisch" subtitle="Publicaties, klantacties, kennisgevingen en onveranderlijk acceptatiebewijs." />
    <LegalRouteTabs activePath="/legal" />
    <LegalStatusStrip metrics={overview.metrics} />
    <LegalAttentionTable rows={overview.attention} />
  </div>
}
