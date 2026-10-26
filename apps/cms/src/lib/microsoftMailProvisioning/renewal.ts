import { requireLiveMailWritesAllowed } from "./writeGate"
import "server-only"
import type { Payload } from "payload"
import { withCommerceOrderLock } from "../commerce/orderLock"
import { relationshipId } from "../relationshipId"
import { recordCommerceAdminException } from "../commerce/alerts"
import { sendEmail, asMailLogPayload } from "../email/sendEmail"
import { renderEmailLayout, renderEmailButton } from "../email/emailLayout"
import { createPax8MailClient } from "./pax8Preflight"
import { loadMailService, mailServiceContext, prepareMailQuote } from "./commerce"
import { PayloadMicrosoftMailProvisioningStore } from "./payloadStore"
import { assertPaidMailOrder, mailQuoteSchema } from "./quote"
import { mailRenewalRequest } from "./renewalRequest"
import { synchronizeMolliePayment } from "../payments/molliePayments"
import { queueOrderFulfillment } from "../jobs/fulfillOrderTask"

import { mailRenewalDecision } from "./renewalPolicy"
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}

export async function reconcileMicrosoftMailRenewals(payload: Payload, now = new Date()) {
  if (process.env.MICROSOFT_MAIL_LIVE_PROVISIONING_ENABLED !== "true") return { examined: 0 }
  try { requireLiveMailWritesAllowed() } catch { return { examined: 0 } }
  const client = createPax8MailClient()
  let examined = 0, cursor = 0
  while (true) {
  const services = await payload.find({ collection: "microsoft-mail-services", where: { and: [{ id: { greater_than: cursor } }, { status: { in: ["active", "provisioning", "attention"] } }, { pax8SubscriptionId: { exists: true } }] }, limit: 100, sort: "id", depth: 0, overrideAccess: true })
  if (!services.docs.length) break
  for (const selected of services.docs) {
    const tenantId = Number(relationshipId(selected.tenant))
    await withCommerceOrderLock(payload, `mail-service:${tenantId}`, async () => {
      const service = await loadMailService(payload, tenantId)
      const alert = (code: string) => recordCommerceAdminException({ payload, source: "payments", code,
        message: "Microsoft email renewal requires internal review. Check provider commitment dates, paid coverage and scheduled cancellation before retrying.", tenant: tenantId, subjectId: service.id, now: now.toISOString() })
      try {
        if (!service.pax8SubscriptionId) return
        const subscription = await client.getSubscription(service.pax8SubscriptionId)
        if (subscription.companyId !== service.pax8CompanyId || subscription.productId !== "1bdd7ebb-f994-421f-ae98-b6a57bd9f947") { await alert("email_renewal_provider_binding_mismatch"); return }
        const termEnd = service.currentPeriodEndsAt ?? subscription.commitmentTermEndDate
        const termStart = subscription.commitmentTermStartDate ?? subscription.startDate
        if (!termStart || !termEnd) { await alert("email_renewal_term_dates_missing"); return }
        let renewalData = record(service.renewalData)
        const saveData = async (patch: Record<string, unknown>) => {
          renewalData = { ...renewalData, ...patch }
          await payload.update({ collection: "microsoft-mail-services", id: service.id, data: { currentPeriodEndsAt: termEnd, renewalData }, overrideAccess: true, context: mailServiceContext })
        }
        if (Date.parse(termEnd) - now.getTime() <= 14 * 86_400_000 && !renewalData.cancellationState) {
          const pending = await payload.find({ collection: "orders", where: { and: [{ tenant: { equals: tenantId } }, { domain: { equals: service.domain } },
            { orderKind: { equals: "microsoft_mail_renewal" } }, { state: { equals: "accepted" } }, { paymentProvider: { equals: "mollie" } }, { servicePeriodStartsAt: { equals: new Date(termEnd).toISOString() } }] }, limit: 10, depth: 0, overrideAccess: true })
          for (const order of pending.docs) {
            const attempts = await payload.find({ collection: "payment-attempts", where: { order: { equals: order.id } }, sort: "-attemptNumber", limit: 1, depth: 0, overrideAccess: true })
            const attempt = attempts.docs[0]
            if (!attempt || ["failed", "cancelled", "expired"].includes(attempt.state)) continue
            if (attempt.state === "created" && !attempt.providerPaymentId && !attempt.reconciliationRequired) continue
            if (!attempt.providerPaymentId) { await alert("email_renewal_payment_sync_uncertain"); return }
            try {
              const synced = await synchronizeMolliePayment(payload, attempt.providerPaymentId)
              if (synced.fulfillmentRequired) await queueOrderFulfillment(payload, synced)
            } catch { await alert("email_renewal_payment_sync_uncertain"); return }
          }
        }
        const orders = await payload.find({ collection: "orders", where: { and: [{ tenant: { equals: tenantId } }, { domain: { equals: service.domain } },
          { orderKind: { equals: "microsoft_mail_renewal" } }, { servicePeriodStartsAt: { equals: new Date(termEnd).toISOString() } }, { paymentStatus: { equals: "paid" } }, { state: { in: ["fulfillment_pending", "fulfilled"] } }] }, depth: 0, limit: 2, overrideAccess: true })
        let covered = false
        if (orders.docs.length === 1) {
          const order = orders.docs[0]!
          const attempts = await payload.find({ collection: "payment-attempts", where: { and: [{ order: { equals: order.id } }, { state: { in: ["paid", "refund_failed"] } }] }, depth: 0, limit: 2, overrideAccess: true })
          if (attempts.docs.length === 1) {
            const attempt = attempts.docs[0]!
            const quote = mailQuoteSchema.safeParse(record(order.quoteEvidence).quote)
            if (!quote.success || quote.data.targetQuantity !== subscription.quantity || quote.data.targetQuantity !== service.quantity) await alert("email_renewal_seat_coverage_mismatch")
            else try { assertPaidMailOrder({ orderId: order.id, tenantId, orderTenantId: relationshipId(order.tenant), orderStatus: order.state ?? "", paymentStatus: order.paymentStatus,
              paymentOrderId: relationshipId(attempt.order), paymentTenantId: relationshipId(attempt.tenant), attemptState: attempt.state, purpose: attempt.purpose,
              grossMinor: order.totalGrossMinor ?? -1, paidGrossMinor: attempt.grossAmountMinor, currency: order.currency, paidCurrency: attempt.currency, provider: attempt.provider, providerMode: attempt.providerMode })
              covered = true
            } catch { await alert("email_renewal_payment_authority_invalid") }
          }
        }
        const decision = mailRenewalDecision({ now, termStartsAt: termStart, termEndsAt: termEnd, paidNextPeriod: covered, cancellationState: renewalData.cancellationState })
        if (decision === "covered") { await saveData({ paidNextPeriodConfirmedAt: now.toISOString(), paidRenewalOrderId: orders.docs[0]?.id }); return }
        if (decision === "reconcile_cancellation") {
          if (renewalData.cancellationState !== "scheduled" || Date.parse(termEnd) <= now.getTime() && !["cancelled", "canceled", "deleted"].includes(subscription.status.toLowerCase())) await alert("email_cancellation_reconciliation_required")
          return
        }
        if (decision === "review") { await alert("email_renewal_cutoff_review"); return }
        if (decision === "not_due") return
        if (decision === "schedule_term_end") {
          await saveData({ cancellationState: "started", cancellationDate: new Date(termEnd).toISOString(), cancellationRequestedAt: now.toISOString() })
          try {
            await client.scheduleEndOfTermCancellation(service.pax8SubscriptionId, termEnd)
            const confirmed = await client.getSubscription(service.pax8SubscriptionId)
            await saveData({ cancellationState: "scheduled", cancellationAcceptedAt: new Date().toISOString(), providerReadbackStatus: confirmed.status, providerReadbackEndDate: confirmed.endDate ?? null })
            await alert("email_unpaid_renewal_cancellation_scheduled")
          } catch {
            await saveData({ cancellationState: "uncertain" })
            await alert("email_cancellation_reconciliation_required")
          }
          return
        }
        const tenant = await payload.findByID({ collection: "tenants", id: tenantId, depth: 0, overrideAccess: true })
        const store = new PayloadMicrosoftMailProvisioningStore(payload)
        const key = `mail-renewal:${service.id}:${new Date(termEnd).toISOString()}`
        let draft = await store.findByIdempotencyKey(key)
        if (!draft) {
          const previous = service.latestRun ? await store.get(Number(relationshipId(service.latestRun))) : null
          const boxes = Array.isArray(service.mailboxes) ? service.mailboxes.map(record) : []
          if (!previous || boxes.length !== service.quantity || !boxes.length) { await alert("email_renewal_mailbox_snapshot_missing"); return }
          const request = mailRenewalRequest(previous.request, service.mailboxes, boxes.length)
          const quote = await prepareMailQuote(payload, tenant, request, process.env, true)
          draft = await store.create({ idempotencyKey: key, mode: "live", tenantId, domain: service.domain, tenantPrefix: previous.tenantPrefix, request,
            state: "prepared", currentStep: null, completedSteps: [], actionUrl: null, issueCode: null,
            data: { customerConsent: previous.data.customerConsent, quote, mailServiceId: service.id, isRenewal: true, requestSource: "renewal_draft" }, createdAt: now.toISOString(), updatedAt: now.toISOString() })
          await saveData({ renewalDraftId: draft.id, forPeriodStarting: termEnd })
        }
        if (draft.request.quantity !== service.quantity && !draft.data.commerceOrderId) {
          const request = mailRenewalRequest(draft.request, service.mailboxes, service.quantity ?? 0)
          const quote = await prepareMailQuote(payload, tenant, request, process.env, true)
          draft = await store.update(draft.id, { request, data: { ...draft.data, quote }, updatedAt: now.toISOString() })
        }
        if (decision === "prepare_renewal" && !renewalData.noticeState && service.billingEmail) {
          await saveData({ noticeState: "sending" })
          try {
            const link = new URL(`/email?request=${draft.id}`, process.env.SITE_URL).href
            const subject = "Je e-mailabonnement verlengen"
            await sendEmail({ to: service.billingEmail, subject, intent: "platform.operational", category: "transactional", tenant: tenantId, payload: asMailLogPayload(payload),
              html: renderEmailLayout({ locale: "nl", title: subject, intro: `Je jaarabonnement voor e-mail op ${service.domain} loopt af op ${new Date(termEnd).toLocaleDateString("nl-NL")}. Bevestig en betaal de verlenging op tijd om je mailboxen te behouden.`,
                body: renderEmailButton("Verlenging bekijken", link), notice: "De verlenging moet uiterlijk 14 dagen voor het einde van de looptijd zijn betaald. Heb je apart betaald? Neem contact op met Siteinabox.", footer: "security" }),
              text: `Verleng je e-mailabonnement vóór de betaaldeadline (14 dagen voor ${termEnd}): ${link}` })
            await saveData({ noticeState: "sent", noticeSentAt: now.toISOString() })
          } catch { await saveData({ noticeState: "manual_review" }); await alert("email_renewal_notice_delivery_review") }
        }

      } catch { await alert("email_renewal_reconciliation_failed") }
    })
  }
  examined += services.docs.length
  cursor = services.docs.at(-1)!.id
  if (services.docs.length < 100) break
  }
  return { examined }
}
