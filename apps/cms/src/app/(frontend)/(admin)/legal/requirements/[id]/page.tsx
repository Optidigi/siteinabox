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

export default async function LegalRequirementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["super-admin"])
  const { id } = await params
  const record = await getLegalRecord("legal-requirements", id)
  if (!record) notFound()
  return <div className="flex flex-col gap-4">
    <PageHeader title="Juridische klantactie" subtitle={label(record.tenant, ["name", "slug"]) || "Onbekende tenant"} beforeTitle={<Button asChild variant="ghost" size="sm"><Link href="/legal/requirements"><ArrowLeft />Terug</Link></Button>} />
    <LegalRouteTabs activePath="/legal/requirements" />
    <LegalRecordDetail title="Vereiste" fields={[
      { label: "Tenant", value: label(record.tenant, ["name", "slug", "domain"]) }, { label: "Account", value: record.subjectEmail },
      { label: "Document", value: label(record.document, ["title", "releaseKey"]) }, { label: "Actie", value: record.action },
      { label: "Status", value: record.status }, { label: "Handhaven vanaf", value: record.enforceAt },
      { label: "Genotificeerd", value: record.notifiedAt }, { label: "Voldaan", value: record.satisfiedAt },
      { label: "Acceptatiebewijs", value: label(record.acceptance, ["evidenceKey", "id"]) }, { label: "Vereistesleutel", value: record.requirementKey, mono: true },
      { label: "Laatste fout", value: record.lastError },
    ]} />
  </div>
}
