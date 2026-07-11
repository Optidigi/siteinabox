import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@siteinabox/ui/components/button"
import { LegalRecordDetail, LegalRouteTabs } from "@/components/legal-operations"
import { PageHeader } from "@/components/page-header"
import { requireRole } from "@/lib/authGate"
import { getLegalRecord } from "@/lib/queries/legalOperations"
import { getLocale, getTranslations } from "next-intl/server"

const label = (value: any, keys: string[]) => value && typeof value === "object" ? keys.map((key) => value[key]).find(Boolean) : value
export const dynamic = "force-dynamic"

export default async function LegalAcceptanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["super-admin"])
  const [t, locale] = await Promise.all([getTranslations("legalOperations"), getLocale()])
  const { id } = await params
  const record = await getLegalRecord("agreement-acceptances", id)
  if (!record) notFound()
  return <div className="flex flex-col gap-4">
    <PageHeader title={t("acceptanceDetail.title")} subtitle={label(record.tenant, ["name", "slug"]) || t("unknownTenant")} beforeTitle={<Button asChild variant="ghost" size="sm"><Link href="/legal/acceptances"><ArrowLeft />{t("detail.back")}</Link></Button>} />
    <LegalRouteTabs activePath="/legal/acceptances" />
    <LegalRecordDetail title={t("acceptanceDetail.recordTitle")} fields={[
      { label: t("fields.tenant"), value: label(record.tenant, ["name", "slug", "domain"]) }, { label: t("fields.acceptedBy"), value: record.actorEmail },
      { label: t("fields.document"), value: label(record.document, ["title", "releaseKey"]) }, { label: t("fields.documentVersion"), value: record.documentVersion },
      { label: t("fields.acceptanceVersion"), value: record.acceptanceVersion }, { label: t("fields.accepted"), value: formatDate(record.acceptedAt, locale) },
      { label: t("fields.statement"), value: record.statementText }, { label: t("fields.statementVersion"), value: record.statementVersion },
      { label: t("fields.contentHash"), value: record.contentHash, mono: true }, { label: t("fields.evidenceKey"), value: record.evidenceKey, mono: true },
    ]} />
  </div>
}

const formatDate = (value: unknown, locale: string) => value ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(String(value))) : null
