import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@siteinabox/ui/components/button"
import { Alert, AlertDescription, AlertTitle } from "@siteinabox/ui/components/alert"
import { Textarea } from "@siteinabox/ui/components/textarea"
import { LegalRecordDetail, LegalRouteTabs } from "@/components/legal-operations"
import { PageHeader } from "@/components/page-header"
import { requireRole } from "@/lib/authGate"
import { getLegalRecord } from "@/lib/queries/legalOperations"
import { retryLegalDeliveryAction } from "../actions"
import { getLocale, getTranslations } from "next-intl/server"

const label = (value: any, keys: string[]) => value && typeof value === "object" ? keys.map((key) => value[key]).find(Boolean) : value
export const dynamic = "force-dynamic"

export default async function LegalDeliveryDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ retry?: string }> }) {
  await requireRole(["super-admin"])
  const [t, locale] = await Promise.all([getTranslations("legalOperations"), getLocale()])
  const { id } = await params
  const record = await getLegalRecord("legal-notification-deliveries", id)
  if (!record) notFound()
  const query = await searchParams
  const canRetry = record.status === "failed" && record.retryState !== "permanent"
  return <div className="flex flex-col gap-4">
    <PageHeader title={t("deliveryDetail.title")} subtitle={label(record.tenant, ["name", "slug"]) || t("unknownTenant")} beforeTitle={<Button asChild variant="ghost" size="sm"><Link href="/legal/deliveries"><ArrowLeft />{t("detail.back")}</Link></Button>} />
    <LegalRouteTabs activePath="/legal/deliveries" />
    {query.retry === "queued" && <Alert><AlertTitle>{t("deliveryDetail.retryQueuedTitle")}</AlertTitle><AlertDescription>{t("deliveryDetail.retryQueuedDescription")}</AlertDescription></Alert>}
    {query.retry === "failed" && <Alert variant="destructive"><AlertTitle>{t("deliveryDetail.retryFailedTitle")}</AlertTitle><AlertDescription>{t("deliveryDetail.retryFailedDescription")}</AlertDescription></Alert>}
    <LegalRecordDetail title={t("deliveryDetail.recordTitle")} fields={[
      { label: t("fields.tenant"), value: label(record.tenant, ["name", "slug", "domain"]) }, { label: t("fields.recipient"), value: record.recipient },
      { label: t("fields.type"), value: record.kind }, { label: t("fields.status"), value: record.status },
      { label: t("fields.attempts"), value: record.attemptCount }, { label: t("fields.retryStatus"), value: record.retryState },
      { label: t("fields.lastAttempt"), value: formatDate(record.lastAttemptAt, locale) }, { label: t("fields.nextAttempt"), value: formatDate(record.nextAttemptAt, locale) },
      { label: t("fields.sentToProvider"), value: formatDate(record.sentAt, locale) }, { label: t("fields.provider"), value: record.provider },
      { label: t("fields.providerMessage"), value: record.providerMessageId, mono: true }, { label: t("fields.lastError"), value: record.lastError },
      { label: t("fields.notificationKey"), value: record.notificationKey, mono: true }, { label: t("fields.templateVersion"), value: record.templateVersion },
    ]} footer={canRetry ? <form action={retryLegalDeliveryAction.bind(null, id)} className="grid gap-3 border-t pt-5">
      <div><h3 className="font-medium">{t("deliveryDetail.retryTitle")}</h3><p className="text-sm text-muted-foreground">{t("deliveryDetail.retryDescription")}</p></div>
      <Textarea name="reason" required minLength={8} maxLength={500} placeholder={t("deliveryDetail.retryReasonPlaceholder")} aria-label={t("deliveryDetail.retryReasonLabel")} />
      <Button type="submit" variant="warning" className="w-fit">{t("deliveryDetail.retrySubmit")}</Button>
    </form> : undefined} />
  </div>
}

const formatDate = (value: unknown, locale: string) => value ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(String(value))) : null
