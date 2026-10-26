import Link from "next/link"
import { notFound } from "next/navigation"
import { getPayload } from "payload"
import { Badge } from "@siteinabox/ui/components/badge"
import { Button } from "@siteinabox/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { OperationsRouteTabs } from "@/components/generation/OperationsRouteTabs"
import { PageHeader } from "@/components/page-header"
import { requireRole } from "@/lib/authGate"
import { LiveRunControls } from "./LiveRunControls"
import { PayloadMicrosoftMailProvisioningStore } from "@/lib/microsoftMailProvisioning/payloadStore"
import type { MicrosoftMailProvisioningRun } from "@/lib/microsoftMailProvisioning/workflow"
import config from "@/payload.config"
import { recordExternalEmailPayment, reconcilePax8EmailOrder } from "../actions"
import { Input } from "@siteinabox/ui/components/input"
import { Label } from "@siteinabox/ui/components/label"

export const dynamic = "force-dynamic"

export default async function MicrosoftMailRunPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["super-admin"])
  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()
  const payload = await getPayload({ config })
  const run = await new PayloadMicrosoftMailProvisioningStore(payload).get(Number(id))
  if (!run) notFound()
  const order = run.data.commerceOrderId ? await payload.findByID({ collection: "orders", id: Number(run.data.commerceOrderId), depth: 0, overrideAccess: true }) : null
  const customerConsent = run.data.customerConsent && typeof run.data.customerConsent === "object" && !Array.isArray(run.data.customerConsent)
    ? run.data.customerConsent as Record<string, unknown>
    : null
  const calls = Array.isArray(run.data.mockProviderCalls) ? run.data.mockProviderCalls as Array<Record<string, unknown>> : []
  const pax8Lines = Array.isArray(run.data.pax8OrderLineItems) ? run.data.pax8OrderLineItems as Array<Record<string, unknown>> : []
  const dnsStages = [
    ["Domain verification", run.data.dnsVerificationChanges],
    ["Mail DNS preparation", run.data.dnsPreparationChanges],
    ["MX cutover", run.data.dnsCutoverChanges],
  ].flatMap(([title, value]) => Array.isArray(value) && value.length ? [{ title: String(title), changes: value as Array<Record<string, unknown>> }] : [])
  return <div className="flex flex-col gap-5">
    <PageHeader title={`Mailbox provisioning: ${run.domain}`} subtitle={`${run.request.customer.companyName} · ${run.request.quantity} annual seat${run.request.quantity === 1 ? "" : "s"}`} beforeTitle={<Button asChild variant="outline" size="sm"><Link href="/operations/microsoft-mail">Back to Microsoft mail</Link></Button>} />
    <OperationsRouteTabs activePath="/operations/microsoft-mail" />
    <div className="flex flex-wrap gap-2"><Badge variant="outline">{run.state}</Badge><Badge variant="secondary">{run.mode}</Badge>{run.issueCode ? <Badge variant="destructive">{run.issueCode}</Badge> : null}</div>
    {order ? <Card><CardHeader><CardTitle>Order and payment</CardTitle></CardHeader><CardContent className="grid gap-4 text-sm">
      <p>{order.orderNumber} · {order.paymentProvider} · {order.paymentStatus} · {order.currency} {((order.totalGrossMinor ?? 0) / 100).toFixed(2)}</p>
      {order.paymentProvider === "manual" && order.state === "accepted" ? <form action={recordExternalEmailPayment} className="grid max-w-xl gap-3">
        <input type="hidden" name="orderId" value={order.id} /><input type="hidden" name="runId" value={run.id} /><input type="hidden" name="amountMinor" value={order.totalGrossMinor ?? ""} /><input type="hidden" name="currency" value={order.currency} />
        <Label htmlFor="payment-reference">External invoice / bank reference</Label><Input id="payment-reference" name="reference" required />
        <Label htmlFor="payment-received">Payment received</Label><Input id="payment-received" type="date" name="receivedAt" required max={new Date().toISOString().slice(0,10)} />
        <p>This records payment of this exact annual order and starts its provisioning. Platform-fee exemptions do not waive Microsoft license costs.</p>
        <Button type="submit" className="w-fit">Record external payment and provision</Button>
      </form> : null}
    </CardContent></Card> : null}
    {run.state === "manual_review" && ["EXISTING_PAX8_COMPANY_BINDING_REQUIRED", "PROVIDER_WRITE_RECONCILIATION_REQUIRED", "EMAIL_PROVISIONING_REQUIRES_REVIEW"].includes(run.issueCode ?? "") ? <Card><CardHeader><CardTitle>Reconcile provider records</CardTitle></CardHeader><CardContent>
      <form action={reconcilePax8EmailOrder} className="grid max-w-xl gap-3"><input type="hidden" name="runId" value={run.id} />
        <Label htmlFor="provider-company">Verified Pax8 company ID</Label><Input id="provider-company" name="companyId" defaultValue={String(run.data.pax8CompanyId ?? "")} required />
        <Label htmlFor="provider-order">Existing Pax8 order ID (required for an uncertain purchase)</Label><Input id="provider-order" name="providerOrderId" defaultValue={String(run.data.pax8OrderId ?? "")} />
        <Button type="submit" className="w-fit">Verify records and resume</Button>
      </form>
    </CardContent></Card> : null}
    {run.mode === "live" && run.state !== "prepared" ? <LiveRunControls
      runId={String(run.id)}
      state={run.state}
      currentStep={run.currentStep}
      customerTenantId={typeof run.data.customerTenantId === "string" ? run.data.customerTenantId : null}
      initialDomain={typeof run.data.bootstrapInitialDomain === "string" ? run.data.bootstrapInitialDomain : null}
      issueCode={run.issueCode}
    /> : null}
    {dnsStages.length ? <Card>
      <CardHeader><CardTitle>DNS changes awaiting review</CardTitle></CardHeader>
      <CardContent className="grid gap-4">{dnsStages.map((stage) => <section key={stage.title} className="grid gap-2 text-sm">
        <h3 className="font-medium">{stage.title}</h3>
        <ul className="grid gap-2">{stage.changes.map((change, index) => <li key={index} className="rounded-base border p-3">
          <strong>{String(change.action).toUpperCase()} {String(change.type)}</strong> {String(change.name)} → <code className="break-all">{String(change.content)}</code>{change.priority != null ? ` (priority ${String(change.priority)})` : ""}
        </li>)}</ul>
      </section>)}</CardContent>
    </Card> : null}
    <Card>
      <CardHeader><CardTitle>Provisioning status</CardTitle></CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <p>Domain: <strong>{run.domain}</strong></p>
        <p>Product: <strong>Microsoft 365 Business Basic EEA (no Teams)</strong></p>
        <p>Commitment and billing: <strong>Annual</strong></p>
        <p>Quantity: <strong>{run.request.quantity}</strong></p>
        <p>Current step: <strong>{run.state === "prepared" ? "Awaiting Pax8 preflight" : run.currentStep ?? "Complete"}</strong></p>
        {run.actionUrl ? <p>Internal operator action: <a className="underline" href={run.actionUrl} target="_blank" rel="noopener noreferrer">Open Microsoft approval</a></p> : null}
        {run.data.pax8CompanyId ? <p>Pax8 company: <strong>{String(run.data.pax8CompanyId)}</strong></p> : null}
        {run.data.pax8OrderId ? <p>Pax8 order: <strong>{String(run.data.pax8OrderId)}</strong></p> : null}
        {pax8Lines.map((line, index) => <p key={`${String(line.subscriptionId ?? "order-line")}-${index}`}>Pax8 subscription: <strong>{String(line.subscriptionId ?? "provisioning")}</strong> · {String(line.billingTerm)} · {String(line.quantity)} seats</p>)}
        {run.data.customerTenantId ? <p>Microsoft customer tenant: <strong>{String(run.data.customerTenantId)}</strong>{run.data.customerOrganizationDomain ? ` (${String(run.data.customerOrganizationDomain)})` : ""}</p> : null}
        {run.data.gdapRelationshipId ? <p>GDAP relationship: <strong>{String(run.data.gdapRelationshipId)}</strong></p> : null}
      </CardContent>
    </Card>
    {customerConsent ? <Card>
      <CardHeader><CardTitle>Customer consent record</CardTitle><p className="text-sm text-muted-foreground">This records the customer's authorization in Siteinabox. It is not proof that Pax8 or Microsoft has completed their agreement/relationship processing.</p></CardHeader>
      <CardContent className="grid gap-2 text-sm">
        <p>MCA acknowledgement: <strong>{customerConsent.mcaAccepted === true ? "Captured in Siteinabox" : "Not captured"}</strong></p>
        <p>Service authorization: <strong>{customerConsent.serviceAuthorized === true ? "Captured" : "Not captured"}</strong></p>
        <p>Authorized signatory: <strong>{String(customerConsent.signatoryFirstName ?? "")} {String(customerConsent.signatoryLastName ?? "")}</strong> · {String(customerConsent.signatoryEmail ?? "")}</p>
        <p>Submitted by: <strong>{String(customerConsent.actorName ?? "")}</strong> · {String(customerConsent.actorEmail ?? "")}</p>
        <p>Recorded at: <strong>{String(customerConsent.acceptedAt ?? "")}</strong></p>
        {typeof customerConsent.mcaDocumentUrl === "string" ? <p><a className="underline" href={customerConsent.mcaDocumentUrl} target="_blank" rel="noopener noreferrer">Agreement document reference</a></p> : null}
        {run.state === "prepared" && run.data.requestSource === "customer_dashboard" ? <Button asChild variant="outline" className="w-fit"><Link href={`/operations/microsoft-mail?request=${run.id}`}>Continue Pax8 preflight</Link></Button> : null}
      </CardContent>
    </Card> : null}
    <Card>
      <CardHeader><CardTitle>Mailboxes and one-time setup delivery</CardTitle></CardHeader>
      <CardContent><ul className="grid gap-2 text-sm">{run.request.mailboxUsers.map((user) => <li key={user.userPrincipalName} className="flex flex-wrap justify-between gap-2 border-b pb-2 last:border-0"><span>{user.displayName} — <strong>{user.userPrincipalName}</strong></span><span>Setup message: {String((run.data.setupEmailStates as Record<string, string> | undefined)?.[user.userPrincipalName] ?? "not sent")}</span></li>)}</ul>
        {run.request.infoAliasTarget ? <p className="mt-4 text-sm">Info alias: <strong>info@{run.domain}</strong> → {run.request.infoAliasTarget}</p> : run.request.retainInfoForward ? <p className="mt-4 text-sm">Info mailbox: <strong>info@{run.domain}</strong> → {run.request.infoForwardTo} (shared mailbox; external forwarding scoped to info@)</p> : <p className="mt-4 text-sm">No info@ forwarding requested.</p>}
      </CardContent>
    </Card>
    {run.mode === "mock" ? <Card>
      <CardHeader><CardTitle>Provider call trace (mock)</CardTitle></CardHeader>
      <CardContent><ol className="grid gap-2 text-sm">{calls.map((call, index) => <li key={index} className="rounded-base border p-3"><strong>{String(call.provider)}</strong>: {String(call.operation)}{call.userPrincipalName ? ` — ${String(call.userPrincipalName)}` : ""}{call.quantity ? ` — quantity ${String(call.quantity)}` : ""}</li>)}</ol></CardContent>
    </Card> : <Card>
      <CardHeader><CardTitle>Completed steps</CardTitle></CardHeader>
      <CardContent><ol className="grid gap-2 text-sm">{run.completedSteps.map((step, index) => <li key={`${step}-${index}`} className="rounded-base border p-3"><Badge variant="outline">Done</Badge> <span className="ml-2">{step.replaceAll("_", " ")}</span></li>)}</ol></CardContent>
    </Card>}
  </div>
}
