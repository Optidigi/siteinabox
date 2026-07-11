import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@siteinabox/ui/components/button"
import { LegalRecordDetail, LegalRouteTabs } from "@/components/legal-operations"
import { PageHeader } from "@/components/page-header"
import { requireRole } from "@/lib/authGate"
import { getLegalRecord } from "@/lib/queries/legalOperations"

export const dynamic = "force-dynamic"

export default async function LegalReleaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["super-admin"])
  const { id } = await params
  const record = await getLegalRecord("legal-documents", id)
  if (!record) notFound()
  return <div className="flex flex-col gap-4">
    <PageHeader title={record.title || "Juridische publicatie"} subtitle={record.changeSummary} beforeTitle={<Button asChild variant="ghost" size="sm"><Link href="/legal/releases"><ArrowLeft />Terug</Link></Button>} />
    <LegalRouteTabs activePath="/legal/releases" />
    <LegalRecordDetail title="Publicatieregister" fields={[
      { label: "Documenttype", value: record.documentType }, { label: "Taal", value: record.locale },
      { label: "Documentversie", value: record.documentVersion }, { label: "Acceptatieversie", value: record.acceptanceVersion },
      { label: "Wijzigingscategorie", value: record.changeCategory }, { label: "Klantactie", value: record.customerAction },
      { label: "Gepubliceerd", value: record.publishedAt }, { label: "Ingangsdatum", value: record.effectiveAt },
      { label: "Doelgroep", value: record.audience }, { label: "Kennisgevingstermijn", value: record.noticeDays == null ? "-" : `${record.noticeDays} dagen` },
      { label: "Reden", value: record.changeRationale }, { label: "Vervangt", value: record.replaces },
      { label: "Broncommit", value: record.sourceCommit, mono: true }, { label: "Inhoudshash", value: record.contentHash, mono: true },
    ]} />
  </div>
}
