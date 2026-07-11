import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@siteinabox/ui/components/button"
import { LegalRecordDetail, LegalRouteTabs } from "@/components/legal-operations"
import { PageHeader } from "@/components/page-header"
import { requireRole } from "@/lib/authGate"
import { getLegalRecord } from "@/lib/queries/legalOperations"

const label = (value: any, keys: string[]) => value && typeof value === "object" ? keys.map((key) => value[key]).find(Boolean) : value
export const dynamic = "force-dynamic"

export default async function LegalAcceptanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["super-admin"])
  const { id } = await params
  const record = await getLegalRecord("agreement-acceptances", id)
  if (!record) notFound()
  return <div className="flex flex-col gap-4">
    <PageHeader title="Acceptatiebewijs" subtitle={label(record.tenant, ["name", "slug"]) || "Onbekende tenant"} beforeTitle={<Button asChild variant="ghost" size="sm"><Link href="/legal/acceptances"><ArrowLeft />Terug</Link></Button>} />
    <LegalRouteTabs activePath="/legal/acceptances" />
    <LegalRecordDetail title="Onveranderlijk bewijs" fields={[
      { label: "Tenant", value: label(record.tenant, ["name", "slug", "domain"]) }, { label: "Geaccepteerd door", value: record.actorEmail },
      { label: "Document", value: label(record.document, ["title", "releaseKey"]) }, { label: "Documentversie", value: record.documentVersion },
      { label: "Acceptatieversie", value: record.acceptanceVersion }, { label: "Geaccepteerd", value: record.acceptedAt },
      { label: "Verklaring", value: record.statementText }, { label: "Verklaringsversie", value: record.statementVersion },
      { label: "Inhoudshash", value: record.contentHash, mono: true }, { label: "Bewijssleutel", value: record.evidenceKey, mono: true },
    ]} />
  </div>
}
