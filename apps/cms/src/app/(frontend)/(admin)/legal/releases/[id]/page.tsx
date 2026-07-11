import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@siteinabox/ui/components/button"
import { LegalRecordDetail, LegalRouteTabs } from "@/components/legal-operations"
import { PageHeader } from "@/components/page-header"
import { requireRole } from "@/lib/authGate"
import { getLegalRecord } from "@/lib/queries/legalOperations"
import { getLocale, getTranslations } from "next-intl/server"

export const dynamic = "force-dynamic"

export default async function LegalReleaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["super-admin"])
  const [t, locale] = await Promise.all([getTranslations("legalOperations"), getLocale()])
  const { id } = await params
  const record = await getLegalRecord("legal-documents", id)
  if (!record) notFound()
  return <div className="flex flex-col gap-4">
    <PageHeader title={record.title || t("releaseDetail.title")} subtitle={record.changeSummary} beforeTitle={<Button asChild variant="ghost" size="sm"><Link href="/legal/releases"><ArrowLeft />{t("detail.back")}</Link></Button>} />
    <LegalRouteTabs activePath="/legal/releases" />
    <LegalRecordDetail title={t("releaseDetail.recordTitle")} fields={[
      { label: t("fields.documentType"), value: record.documentType }, { label: t("fields.language"), value: record.locale },
      { label: t("fields.documentVersion"), value: record.documentVersion }, { label: t("fields.acceptanceVersion"), value: record.acceptanceVersion },
      { label: t("fields.changeCategory"), value: record.changeCategory }, { label: t("fields.customerAction"), value: record.customerAction },
      { label: t("fields.published"), value: formatDate(record.publishedAt, locale) }, { label: t("fields.effectiveAt"), value: formatDate(record.effectiveAt, locale) },
      { label: t("fields.audience"), value: record.audience }, { label: t("fields.noticePeriod"), value: record.noticeDays == null ? null : t("detail.days", { count: record.noticeDays }) },
      { label: t("fields.reason"), value: record.changeRationale }, { label: t("fields.replaces"), value: record.replaces },
      { label: t("fields.sourceCommit"), value: record.sourceCommit, mono: true }, { label: t("fields.contentHash"), value: record.contentHash, mono: true },
    ]} />
  </div>
}

const formatDate = (value: unknown, locale: string) => value ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(String(value))) : null
