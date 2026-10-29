import Link from "next/link"
import { getPayload } from "payload"
import { getTranslations } from "next-intl/server"
import { Badge } from "@siteinabox/ui/components/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { PageHeader } from "@/components/page-header"
import { requireRole } from "@/lib/authGate"
import { resolveLocale } from "@/i18n/config"
import config from "@/payload.config"
import { CustomerMailOrderForm } from "./CustomerMailOrderForm"
import { Button } from "@siteinabox/ui/components/button"
import { hasWorkspaceService } from "@/lib/tenants/services"
import { checkoutLegalDocuments } from "@/lib/legal/checkoutLegal"
import { mailQuoteSchema } from "@/lib/microsoftMailProvisioning/quote"
import { refreshCustomerMailQuote } from "./actions"
import { MailOrderConfirmation } from "./MailOrderConfirmation"
import { MailProgressRefresh } from "./MailProgressRefresh"
import { PayloadMicrosoftMailProvisioningStore } from "@/lib/microsoftMailProvisioning/payloadStore"
import { relationshipId } from "@/lib/relationshipId"

export const dynamic = "force-dynamic"

type MailboxRequest = { userPrincipalName: string; displayName: string }

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null

const mailboxRows = (request: unknown): MailboxRequest[] => {
  const record = asRecord(request)
  if (!Array.isArray(record?.mailboxUsers)) return []
  return record.mailboxUsers.flatMap((value) => {
    const row = asRecord(value)
    return typeof row?.userPrincipalName === "string" && typeof row.displayName === "string"
      ? [{ userPrincipalName: row.userPrincipalName, displayName: row.displayName }]
      : []
  })
}

export default async function CustomerEmailPage({ searchParams }: {
  searchParams: Promise<{ request?: string | string[]; new?: string }>
}) {
  const { user, ctx } = await requireRole(["owner"])
  if (ctx.mode !== "tenant") throw new Error("Email setup requires a customer workspace.")
  const t = await getTranslations({ locale: resolveLocale(user.language), namespace: "emailService" })
  const params = await searchParams
  const requestedId = typeof params.request === "string" && /^\d+$/.test(params.request)
    ? Number(params.request)
    : null
  const payload = await getPayload({ config })
  const nl = user.language === "nl"
  const serviceResult = await payload.find({ collection: "microsoft-mail-services", where: { tenant: { equals: ctx.tenant.id } }, limit: 1, depth: 0, overrideAccess: true })
  const mailService = serviceResult.docs[0]
  const pendingOrders = await payload.find({ collection: "orders", where: { and: [
    { tenant: { equals: ctx.tenant.id } }, { orderKind: { in: ["microsoft_mail_initial", "microsoft_mail_seats", "microsoft_mail_renewal"] } },
    { state: { in: ["accepted", "fulfillment_pending"] } },
  ] }, limit: 1, depth: 0, overrideAccess: true })
  const pendingMailOrder = pendingOrders.docs[0]
  if (!hasWorkspaceService(ctx.tenant, "email") || !mailService) return <div className="grid gap-4"><PageHeader title={t("title")} /><p>{nl ? "E-mail is nog niet beschikbaar voor deze klantomgeving. Neem contact op met Siteinabox." : "Email is not enabled for this workspace. Contact Siteinabox."}</p></div>
  // Collection access remains super-admin-only. This server query is scoped to
  // the tenant derived from the authenticated owner, then the page exposes only
  // a customer-safe projection of matching runs.
  const result = await payload.find({
    collection: "microsoft-mail-provisioning-runs",
    where: { tenantId: { equals: ctx.tenant.id } },
    limit: 50,
    sort: "-updatedAt",
    depth: 0,
    overrideAccess: true,
  })
  const requests = result.docs.filter((run) => Boolean(asRecord(run.data)?.customerConsent))
  const selected = params.new === "1" ? null : (requestedId ? requests.find((run) => Number(run.id) === requestedId) : null) ?? requests[0]
  const lastCompleted = mailService.latestRun ? await new PayloadMicrosoftMailProvisioningStore(payload).get(Number(relationshipId(mailService.latestRun))) : null
  const profile = lastCompleted?.tenantId === ctx.tenant.id ? lastCompleted.request.customer : undefined
  const organization = profile ? { companyName: profile.companyName, website: profile.website, phone: profile.phone, registrationNumber: profile.registrationNumber, address: profile.address } : undefined
  const selectedRequest = selected ? asRecord(selected.request) : null
  const selectedData = selected ? asRecord(selected.data) : null
  const quoteResult = mailQuoteSchema.safeParse(selectedData?.quote)
  const quote = quoteResult.success ? quoteResult.data : null
  const orderId = selectedData?.commerceOrderId
  const orders = orderId ? await payload.find({ collection: "orders", where: { and: [{ id: { equals: orderId } }, { tenant: { equals: ctx.tenant.id } }] }, depth: 0, limit: 1, overrideAccess: true }) : null
  const order = orders?.docs[0]
  const legal = quote && (!order || order.state === "accepted") ? await checkoutLegalDocuments(payload, nl ? "nl" : "en") : null
  const legalVersion = legal && "id" in legal.terms && "id" in legal.privacy ? `${legal.terms.id}:${legal.terms.contentHash}:${legal.privacy.id}:${legal.privacy.contentHash}` : null
  const money = (minor: number) => new Intl.NumberFormat(nl ? "nl-NL" : "en-GB", { style: "currency", currency: "EUR" }).format(minor / 100)
  let status: { title: string; description: string; label: string } | null = null
  if (selected) {
    switch (selected.state) {
      case "ready": status = { title: t("readyTitle"), description: t("readyDescription"), label: t("stateReady") }; break
      case "prepared": status = { title: t("preparedTitle"), description: t("preparedDescription"), label: t("statePrepared") }; break
      case "manual_review": status = { title: t("manualReviewTitle"), description: t("manualReviewDescription"), label: t("stateManualReview") }; break
      case "failed": status = { title: t("failedTitle"), description: t("failedDescription"), label: t("stateFailed") }; break
      case "cancelled": status = { title: t("cancelledTitle"), description: t("cancelledDescription"), label: t("stateCancelled") }; break
      case "tenant_pending": status = { title: t("progressTitle"), description: t("progressDescription"), label: t("stateTenantPending") }; break
      case "consent_pending": status = { title: t("progressTitle"), description: t("progressDescription"), label: t("stateConsentPending") }; break
      case "subscription_pending": status = { title: t("progressTitle"), description: t("progressDescription"), label: t("stateSubscriptionPending") }; break
      case "domain_pending": status = { title: t("progressTitle"), description: t("progressDescription"), label: t("stateDomainPending") }; break
      case "dns_pending": status = { title: t("progressTitle"), description: t("progressDescription"), label: t("stateDnsPending") }; break
      case "mailboxes_pending": status = { title: t("progressTitle"), description: t("progressDescription"), label: t("stateMailboxesPending") }; break
      case "exchange_pending": status = { title: t("progressTitle"), description: t("progressDescription"), label: t("stateExchangePending") }; break
      case "setup_mail_pending": status = { title: t("progressTitle"), description: t("progressDescription"), label: t("stateSetupMailPending") }; break
      default: status = { title: t("progressTitle"), description: t("progressDescription"), label: String(selected.state) }
    }
  }

  return <div className="flex min-w-0 flex-col gap-5">
    <PageHeader title={t("title")} subtitle={t("subtitle")} />
    {mailService.status === "active" && !pendingMailOrder && params.new !== "1" ? <Button asChild variant="outline" className="w-fit"><Link href="/email?new=1">+ {t("addMailbox")}</Link></Button> : null}
    <MailProgressRefresh active={Boolean(order && ["open", "pending"].includes(order.paymentStatus) || order?.state === "fulfillment_pending")} />
    {selected && status ? <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2"><CardTitle>{status.title}</CardTitle><Badge variant={selected.state === "ready" ? "default" : "outline"}>{status.label}</Badge></div>
        <p className="text-sm text-muted-foreground">{status.description}</p>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <p>{t("orderStatus", { domain: selected.domain, quantity: mailboxRows(selectedRequest).length })}</p>
        <ul className="grid gap-2 sm:grid-cols-2">{mailboxRows(selectedRequest).map((mailbox) => <li key={mailbox.userPrincipalName} className="rounded-base border p-3">{mailbox.displayName} · <strong>{mailbox.userPrincipalName}</strong></li>)}</ul>
        {typeof selectedRequest?.infoAliasTarget === "string" ? <p>{t("infoAliasSummary", { domain: selected.domain, target: selectedRequest.infoAliasTarget })}</p> : null}
        {selected.state === "ready" && selectedData?.setupEmailStates ? <p className="text-muted-foreground">{t("readyDescription")}</p> : null}
        {selected.state !== "ready" ? <p className="text-xs text-muted-foreground">{t("requestRecordedAt", { date: new Intl.DateTimeFormat(user.language === "nl" ? "nl-NL" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(selected.createdAt)) })}</p> : null}
        {requests.length > 1 ? <div className="flex flex-wrap gap-2">{requests.map((run) => <Link key={run.id} className="underline" href={`/email?request=${run.id}`}>{t("requestHistory", { domain: run.domain, state: run.state === "ready" ? t("stateReady") : t("progressTitle") })}</Link>)}</div> : null}
      </CardContent>
    </Card> : null}

    {selected && quote && (!order || order.state === "accepted") ? <Card><CardHeader><CardTitle>{quote.operation === "renewal" ? (nl ? "Jaarabonnement verlengen" : "Renew your annual plan") : (nl ? "Bestelling controleren" : "Review your order")}</CardTitle></CardHeader><CardContent className="grid gap-4">
      <dl className="grid grid-cols-2 gap-2 text-sm"><dt>{quote.quantity} {nl ? "mailboxen" : "mailboxes"}{quote.operation === "seats" && quote.servicePeriodEndsAt ? ` · ${nl ? "tot" : "until"} ${new Date(quote.servicePeriodEndsAt).toLocaleDateString(nl ? "nl-NL" : "en-GB")}` : ` · ${nl ? "jaarcontract" : "annual commitment"}`}</dt><dd className="text-right">{money(quote.unitNetMinor * quote.quantity)}</dd>
        {quote.platformNetMinor > 0 ? <><dt>Siteinabox</dt><dd className="text-right">{money(quote.platformNetMinor)}</dd></> : null}
        <dt>{nl ? "Btw" : "VAT"}</dt><dd className="text-right">{money(quote.vatAmountMinor)}</dd><dt className="font-medium">{nl ? "Te betalen" : "Amount due"}</dt><dd className="text-right font-medium">{quote.sponsored ? money(0) : money(quote.totalGrossMinor)}</dd></dl>
      {quote.sponsored ? <p>{nl ? "Siteinabox betaalt dit abonnement. Je hoeft niet te betalen." : "Siteinabox covers this subscription. No customer payment is required."}</p> : null}
      {selectedRequest?.infoSharedMailbox === true ? <p>Shared info@{selected.domain} inbox · Full Access + Send As for all requested mailboxes. Existing info@ forwarding will be replaced.</p> : null}
      {!selectedRequest?.infoSharedMailbox && quote.legacyInfoForwardTo ? <p className="text-sm">{typeof selectedRequest?.infoAliasTarget === "string" ? (nl ? `info@${selected.domain} gaat voortaan naar ${selectedRequest.infoAliasTarget}.` : `info@${selected.domain} will now arrive in ${selectedRequest.infoAliasTarget}.`) : (nl ? `info@${selected.domain} blijft doorgestuurd naar ${quote.legacyInfoForwardTo}.` : `info@${selected.domain} keeps forwarding to ${quote.legacyInfoForwardTo}.`)}</p> : null}
      {order?.paymentProvider === "manual" && !quote.sponsored ? <p>{nl ? "Je bestelling is bevestigd en wacht op de afgesproken betaling." : "Your order is confirmed and awaiting the agreed payment."}</p> : !order && Date.parse(quote.expiresAt) <= Date.now() ? <form action={refreshCustomerMailQuote}><input type="hidden" name="runId" value={selected.id} /><Button type="submit">{nl ? "Prijs vernieuwen" : "Refresh price"}</Button></form> : legal && legalVersion ? <MailOrderConfirmation runId={selected.id} legalVersion={legalVersion} termsHref={legal.termsHref} privacyHref={legal.privacyHref} manual={quote.paymentProvider === "manual"} nl={nl} additionalSeats={quote.operation === "seats"} /> : <p>{nl ? "Bestellen is tijdelijk niet beschikbaar." : "Ordering is temporarily unavailable."}</p>}
      {order?.paymentProvider === "manual" && !quote.sponsored ? <p className="text-sm text-muted-foreground">{nl ? "Siteinabox registreert de afgesproken betaling. Daarna gaat de inrichting verder." : "Siteinabox will record the agreed payment, then setup continues."}</p> : null}
    </CardContent></Card> : null}

    {!selected && pendingMailOrder ? <p>{nl ? "Rond eerst je lopende e-mailbestelling af." : "Complete your pending email order first."}</p> : null}
    {!selected && !pendingMailOrder ? <CustomerMailOrderForm
      tenantName={ctx.tenant.name}
      tenantDomain={mailService.domain}
      userName={user.name ?? ""}
      userEmail={user.email ?? ""}
      organization={organization}
      allowInfoAlias={!mailService.infoAliasTarget && !mailService.infoForwardTo && !asRecord(mailService.renewalData)?.infoSharedMailbox}
    /> : null}
  </div>
}
