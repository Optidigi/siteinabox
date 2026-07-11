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

const label = (value: any, keys: string[]) => value && typeof value === "object" ? keys.map((key) => value[key]).find(Boolean) : value
export const dynamic = "force-dynamic"

export default async function LegalDeliveryDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ retry?: string }> }) {
  await requireRole(["super-admin"])
  const { id } = await params
  const record = await getLegalRecord("legal-notification-deliveries", id)
  if (!record) notFound()
  const query = await searchParams
  const canRetry = record.status === "failed" && record.retryState !== "permanent"
  return <div className="flex flex-col gap-4">
    <PageHeader title="Juridische verzending" subtitle={label(record.tenant, ["name", "slug"]) || "Onbekende tenant"} beforeTitle={<Button asChild variant="ghost" size="sm"><Link href="/legal/deliveries"><ArrowLeft />Terug</Link></Button>} />
    <LegalRouteTabs activePath="/legal/deliveries" />
    {query.retry === "queued" && <Alert><AlertTitle>Opnieuw ingepland</AlertTitle><AlertDescription>De verzending staat opnieuw in de wachtrij. De worker verwerkt de nieuwe poging.</AlertDescription></Alert>}
    {query.retry === "failed" && <Alert variant="destructive"><AlertTitle>Niet opnieuw ingepland</AlertTitle><AlertDescription>De herstelactie is niet uitgevoerd. Controleer de actuele status en probeer het indien toegestaan opnieuw.</AlertDescription></Alert>}
    <LegalRecordDetail title="Provider-overdracht" fields={[
      { label: "Tenant", value: label(record.tenant, ["name", "slug", "domain"]) }, { label: "Ontvanger", value: record.recipient },
      { label: "Type", value: record.kind }, { label: "Status", value: record.status },
      { label: "Pogingen", value: record.attemptCount }, { label: "Herstelstatus", value: record.retryState },
      { label: "Laatste poging", value: record.lastAttemptAt }, { label: "Volgende poging", value: record.nextAttemptAt },
      { label: "Naar provider verzonden", value: record.sentAt }, { label: "Provider", value: record.provider },
      { label: "Providerbericht", value: record.providerMessageId, mono: true }, { label: "Laatste fout", value: record.lastError },
      { label: "Verzendsleutel", value: record.notificationKey, mono: true }, { label: "Sjabloonversie", value: record.templateVersion },
    ]} footer={canRetry ? <form action={retryLegalDeliveryAction.bind(null, id)} className="grid gap-3 border-t pt-5">
      <div><h3 className="font-medium">Opnieuw proberen</h3><p className="text-sm text-muted-foreground">Deze actie wordt onveranderlijk vastgelegd. Definitieve providerweigeringen kunnen niet opnieuw worden ingepland.</p></div>
      <Textarea name="reason" required minLength={8} maxLength={500} placeholder="Reden voor de handmatige herstelactie" aria-label="Reden voor opnieuw proberen" />
      <Button type="submit" variant="warning" className="w-fit">Opnieuw inplannen</Button>
    </form> : undefined} />
  </div>
}
