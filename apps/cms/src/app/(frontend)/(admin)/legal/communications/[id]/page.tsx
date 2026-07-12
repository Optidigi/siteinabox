import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import { Button } from "@siteinabox/ui/components/button"
import { PageHeader } from "@/components/page-header"
import { CommunicationPreferenceEventsTable, LegalRecordDetail, LegalRouteTabs } from "@/components/legal-operations"
import { requireRole } from "@/lib/authGate"
import { getCommunicationPreferenceRecord } from "@/lib/queries/legalOperations"

export const dynamic = "force-dynamic"
const relationLabel = (value: unknown) => value && typeof value === "object" ? String((value as any).name || (value as any).slug || (value as any).email || "") : ""
const yesNo = (value: unknown, locale: string) => value === true ? (locale === "nl" ? "Ja" : "Yes") : (locale === "nl" ? "Nee" : "No")

export default async function CommunicationPreferenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["super-admin"])
  const { id } = await params
  const [record, t, locale] = await Promise.all([getCommunicationPreferenceRecord(id), getTranslations("legalOperations"), getLocale()])
  if (!record) notFound()
  const preference = record.preference
  return <div className="flex flex-col gap-4">
    <PageHeader title={t("communicationsUi.detailTitle")} subtitle={relationLabel(preference.tenant) || preference.email} beforeTitle={<Button asChild variant="ghost" size="sm"><Link href="/legal/communications"><ArrowLeft />{t("detail.back")}</Link></Button>} />
    <LegalRouteTabs activePath="/legal/communications" />
    <LegalRecordDetail title={t("communicationsUi.recordTitle")} fields={[
      { label: t("communicationsUi.fields.account"), value: preference.email }, { label: t("communicationsUi.fields.tenant"), value: relationLabel(preference.tenant) || "-" },
      { label: t("communicationsUi.fields.marketing"), value: yesNo(preference.marketing, locale) }, { label: t("communicationsUi.fields.productNotifications"), value: yesNo(preference.productNotifications, locale) },
      { label: t("communicationsUi.fields.suppressed"), value: yesNo(preference.suppressed, locale) }, { label: t("communicationsUi.fields.suppressionReason"), value: preference.suppressionReason || "-" },
      { label: t("communicationsUi.fields.consentSource"), value: preference.marketingConsentSource || "-" }, { label: t("communicationsUi.fields.consentVersion"), value: preference.marketingConsentVersion || "-", mono: true },
      { label: t("communicationsUi.fields.consentAt"), value: preference.marketingConsentAt ? new Date(preference.marketingConsentAt).toLocaleString(locale) : "-" },
      { label: t("communicationsUi.fields.language"), value: preference.locale }, { label: t("communicationsUi.fields.updated"), value: new Date(preference.updatedAt).toLocaleString(locale) },
    ]} />
    <CommunicationPreferenceEventsTable rows={record.events} />
  </div>
}
