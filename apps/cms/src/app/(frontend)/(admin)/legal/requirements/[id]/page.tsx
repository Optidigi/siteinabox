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

export default async function LegalRequirementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["super-admin"])
  const [t, locale] = await Promise.all([getTranslations("legalOperations"), getLocale()])
  const { id } = await params
  const record = await getLegalRecord("legal-requirements", id)
  if (!record) notFound()
  return <div className="flex flex-col gap-4">
    <PageHeader title={t("requirementDetail.title")} subtitle={label(record.tenant, ["name", "slug"]) || t("unknownTenant")} beforeTitle={<Button asChild variant="ghost" size="sm"><Link href="/legal/requirements"><ArrowLeft />{t("detail.back")}</Link></Button>} />
    <LegalRouteTabs activePath="/legal/requirements" />
    <LegalRecordDetail title={t("requirementDetail.recordTitle")} fields={[
      { label: t("fields.tenant"), value: label(record.tenant, ["name", "slug", "domain"]) }, { label: t("fields.account"), value: record.subjectEmail },
      { label: t("fields.document"), value: label(record.document, ["title", "releaseKey"]) }, { label: t("fields.action"), value: record.action },
      { label: t("fields.status"), value: record.status }, { label: t("fields.enforcementDeadline"), value: formatDate(record.enforceAt, locale) },
      { label: t("fields.responseDeadline"), value: formatDate(record.objectionDeadlineAt, locale) }, { label: t("fields.notified"), value: formatDate(record.notifiedAt, locale) },
      { label: t("fields.noticeDelivered"), value: formatDate(record.noticeDeliveredAt, locale) }, { label: t("fields.objectionReceived"), value: formatDate(record.objectedAt, locale) },
      { label: t("fields.qualifyingUse"), value: formatDate(record.qualifyingUseAt, locale) }, { label: t("fields.deemedAccepted"), value: formatDate(record.deemedAcceptedAt, locale) },
      { label: t("fields.resolution"), value: record.resolutionBasis }, { label: t("fields.completed"), value: formatDate(record.satisfiedAt, locale) },
      { label: t("fields.acceptanceEvidence"), value: label(record.acceptance, ["evidenceKey", "id"]) }, { label: t("fields.requirementKey"), value: record.requirementKey, mono: true },
      { label: t("fields.lastError"), value: record.lastError },
    ]} />
  </div>
}

const formatDate = (value: unknown, locale: string) => value ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(String(value))) : null
