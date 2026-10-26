import { mailProviderAnnualCostMinor } from "./quote"
import { requireCommerceProviderWritesAllowed } from "../commerce/releaseGate"
import "server-only"
import { createHash, randomUUID } from "node:crypto"
import type { Payload } from "payload"
import type { Order, Tenant, User } from "@/payload-types"
import { withCommerceOrderLock } from "../commerce/orderLock"
import { relationshipId } from "../relationshipId"
import { checkoutLegalDocuments, checkoutLegalIdentity } from "../legal/checkoutLegal"
import { createMolliePayment, mollieApiKeyMode, MollieApiError, type MolliePayment } from "../payments/mollieAdapter"
import { queueOrderFulfillment } from "../jobs/fulfillOrderTask"
import { ensureInvoiceEvidence } from "../payments/accountingEvidence"
import { hasWorkspaceService } from "../tenants/services"
import { mailPrice, mailQuoteSchema, proratedMailUnit, type MailQuote } from "./quote"
import { createPax8MailClient, PAX8_MICROSOFT_BUSINESS_BASIC_EEA_NO_TEAMS_ID } from "./pax8Preflight"
import type { MicrosoftMailProvisioningRequest } from "./model"
import { mailProvisioningIntent, mailProvisioningIntentHash } from "./model"
import { PayloadMicrosoftMailProvisioningStore } from "./payloadStore"
import { CloudflareMailDnsClient } from "./cloudflare"
import { inspectExistingMailRouting } from "./infoRouting"
import { inspectMicrosoftMailReadiness } from "./readiness"
import { createPartnerTokenProvider } from "./partnerConnection"
import { ExchangeWorkerClient } from "./exchangeWorker"

const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
export const mailOrderContext = { legalOrderLifecycleMutation: true }
export const mailAttemptContext = { paymentAttemptLifecycleMutation: true }
export const mailServiceContext = { microsoftMailServiceMutation: true }
export const mailRunContext = { microsoftMailProvisioningLifecycle: true }

export async function loadMailService(payload: Payload, tenantId: number) {
  const result = await payload.find({ collection: "microsoft-mail-services", where: { tenant: { equals: tenantId } }, depth: 0, limit: 1, overrideAccess: true })
  if (!result.docs[0]) throw new Error("This workspace has no authorized email domain. Contact Siteinabox.")
  return result.docs[0]
}

export async function prepareMailQuote(payload: Payload, tenant: Tenant, request: MicrosoftMailProvisioningRequest, env: NodeJS.ProcessEnv = process.env, renewal = false): Promise<MailQuote> {
  if (!hasWorkspaceService(tenant, "email") || tenant.status !== "active" || request.tenantId !== tenant.id) throw new Error("Email ordering is unavailable for this workspace.")
  const service = await loadMailService(payload, tenant.id)
  if (service.domain !== request.domain) throw new Error("Choose the authorized email domain for this workspace.")
  if (!["draft", "active"].includes(service.status)) throw new Error("Finish the current email setup before placing another order.")
  if (request.customer.address.country !== "NL") throw new Error("Email checkout currently supports businesses registered in the Netherlands.")
  const operation = renewal ? "renewal" : service.status === "active" ? "seats" : "initial"
  const now = new Date()
  const client = createPax8MailClient(env)
  const baseQuantity = operation === "initial" ? 0 : service.quantity ?? 0
  const targetQuantity = operation === "seats" ? baseQuantity + request.quantity : request.quantity
  if (targetQuantity > 300 || targetQuantity < 1) throw new Error("Business Basic supports at most 300 mailboxes.")
  let periodStart: string | null = null, periodEnd: string | null = null, providerTermStart: string | null = null, providerTermEnd: string | null = null
  if (operation !== "initial") {
    if (!service.pax8SubscriptionId || !service.microsoftTenantId || !service.pax8CompanyId) throw new Error("The existing email subscription requires review.")
    if (asRecord(service.renewalData).cancellationState) throw new Error("Subscription renewal is under review. Contact Siteinabox before ordering.")
    const subscription = await client.getSubscription(service.pax8SubscriptionId)
    if (subscription.companyId !== service.pax8CompanyId || subscription.quantity !== baseQuantity) throw new Error("The provider seat count changed. Contact Siteinabox.")
    providerTermStart = subscription.commitmentTermStartDate ?? subscription.startDate ?? null
    if (!service.currentPeriodEndsAt || subscription.commitmentTermEndDate && Date.parse(subscription.commitmentTermEndDate) !== Date.parse(service.currentPeriodEndsAt)) throw new Error("The provider commitment changed. Its paid coverage must be verified before quoting.")
    periodEnd = service.currentPeriodEndsAt
    providerTermEnd = periodEnd
    if (!periodEnd || !Number.isFinite(Date.parse(periodEnd))) throw new Error("The provider commitment end date must be verified before ordering.")
    if (operation === "renewal") {
      periodStart = new Date(periodEnd).toISOString()
      const next = new Date(periodEnd); next.setUTCFullYear(next.getUTCFullYear() + 1); periodEnd = next.toISOString()
      if (request.quantity !== baseQuantity) throw new Error("Renewal must cover the current mailbox count.")
    } else {
      periodStart = now.toISOString()
      const existing = Array.isArray(service.mailboxes) ? service.mailboxes.map(asRecord) : []
      if (request.mailboxUsers.some(user => existing.some(mailbox => mailbox.address === user.userPrincipalName))) throw new Error("One of these mailboxes already exists.")
      if (request.infoAliasTarget && (service.infoAliasTarget || service.infoForwardTo)) throw new Error("The existing info@ address must be managed separately.")
    }
  }
  const productId = PAX8_MICROSOFT_BUSINESS_BASIC_EEA_NO_TEAMS_ID
  const [product, pricing, dependencies] = await Promise.all([
    client.getProduct(productId), client.getPricing(productId, service.pax8CompanyId ?? undefined), client.getDependencies(productId),
  ])
  if (product.id !== productId) throw new Error("The configured Microsoft offer is unavailable.")
  const terms = Array.isArray(dependencies.commitmentDependencies) ? dependencies.commitmentDependencies.map(asRecord) : []
  const term = terms.find(value => typeof value.term === "string" && /^(1[ -]?year|12[ -]?months?|annual)$/i.test(value.term))
  if (!term) throw new Error("The annual Microsoft commitment is unavailable.")
  const productDependencies = Array.isArray(dependencies.productDependencies) ? dependencies.productDependencies.map(asRecord) : []
  if (productDependencies.some(value => !["UpgradesTo", "UpgradesFrom"].includes(String(value.name)))) throw new Error("Microsoft product dependencies require review.")
  const rows = Array.isArray(pricing.content) ? pricing.content.map(asRecord) : []
  const row = rows.find(value => value.billingTerm === "Annual" && value.commitmentTerm === "1-Year")
  const rates = Array.isArray(row?.rates) ? row.rates.map(asRecord) : []
  const applicableRate = rates.filter(rate => Number(rate.startQuantityRange ?? 0) <= targetQuantity &&
    (rate.endQuantityRange == null || Number(rate.endQuantityRange) >= targetQuantity)).sort((a, b) => Number(b.startQuantityRange ?? 0) - Number(a.startQuantityRange ?? 0))[0]
  const providerAnnualUnitCostMinor = mailProviderAnnualCostMinor(applicableRate?.partnerBuyRate)
  const annualUnitNetMinor = Number(env.MICROSOFT_MAIL_ANNUAL_SEAT_NET_MINOR)
  const platformNetMinor = Number(env["MICROSOFT_MAIL_PLATFORM_FEE_NET_MINOR"] ?? "0")
  if (env.MICROSOFT_MAIL_CURRENCY !== "EUR" || !Number.isSafeInteger(annualUnitNetMinor) || !Number.isSafeInteger(providerAnnualUnitCostMinor)) throw new Error("Email pricing is not configured.")
  const unitNetMinor = operation === "seats" ? proratedMailUnit(annualUnitNetMinor, providerTermStart ?? "", periodEnd!, now) : annualUnitNetMinor
  const providerUnitCostMinor = operation === "seats" ? proratedMailUnit(providerAnnualUnitCostMinor, providerTermStart ?? "", periodEnd!, now) : providerAnnualUnitCostMinor
  const price = mailPrice({ quantity: request.quantity, unitNetMinor, providerUnitCostMinor, platformNetMinor, policy: tenant.platformPricing })
  let routing = { legacyInfoForwardTo: null as string | null, routingHash: createHash("sha256").update("existing-microsoft-service").digest("hex") }
  if (operation === "initial") {
    const dns = new CloudflareMailDnsClient({ token: env.CLOUDFLARE_API_TOKEN ?? "", accountId: env.CLOUDFLARE_ACCOUNT_ID ?? "" })
    const zone = await dns.findZone(request.domain)
    if (!zone || zone.status !== "active") throw new Error("The email domain is not ready for setup.")
    routing = inspectExistingMailRouting(request.domain, request.mailboxUsers.map(user => user.userPrincipalName), await dns.listEmailRoutingRules(zone.id))
  }
  return mailQuoteSchema.parse({ version: 2, operation, baseQuantity, targetQuantity, annualUnitNetMinor, providerAnnualUnitCostMinor,
    servicePeriodStartsAt: periodStart, servicePeriodEndsAt: periodEnd, providerCommitmentStartsAt: providerTermStart ? new Date(providerTermStart).toISOString() : null, providerCommitmentEndsAt: providerTermEnd ? new Date(providerTermEnd).toISOString() : null,
    serviceId: service.id, productId, commitmentTermId: term.id, quantity: request.quantity,
    currency: "EUR", unitNetMinor, providerUnitCostMinor, platformNetMinor: price.platformNetMinor, platformDiscountNetMinor: price.platformDiscountNetMinor,
    subtotalNetMinor: price.subtotalNetMinor, vatAmountMinor: price.vatAmountMinor, totalGrossMinor: price.totalGrossMinor,
    issuedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 900_000).toISOString(),
    pricingHash: createHash("sha256").update(JSON.stringify({ row, termId: term.id })).digest("hex"),
    paymentProvider: tenant.emailPaymentMethod === "manual" ? "manual" : "mollie", ...routing })
}

export async function acceptMailOrder(payload: Payload, input: { runId: number; tenantId: number; actor: User; legalAccepted: boolean; legalVersion: string }) {
  if (input.actor.role !== "owner" || input.actor.tenants?.length !== 1 || relationshipId(input.actor.tenants[0]?.tenant) !== String(input.tenantId)) throw new Error("Only this workspace's owner can confirm the email order.")
  if (!input.legalAccepted) throw new Error("Accept the agreement and annual commitment to continue.")
  return withCommerceOrderLock(payload, `mail-service:${input.tenantId}`, async () => {
    const store = new PayloadMicrosoftMailProvisioningStore(payload)
    const run = await store.get(input.runId)
    if (!run || run.tenantId !== input.tenantId || run.mode !== "live" || !run.data.customerConsent) throw new Error("Email request not found.")
    const tenant = await payload.findByID({ collection: "tenants", id: input.tenantId, depth: 0, overrideAccess: true })
    if (!hasWorkspaceService(tenant, "email") || tenant.status !== "active") throw new Error("Email ordering is unavailable.")
    const service = await loadMailService(payload, tenant.id)
    const number = `MAIL-${run.id}`
    const existing = await payload.find({ collection: "orders", where: { orderNumber: { equals: number } }, limit: 1, depth: 0, overrideAccess: true })
    if (existing.docs[0]) {
      if (existing.docs[0].orderKind === "microsoft_mail_renewal" && asRecord(service.renewalData).cancellationState) throw new Error("This renewal requires internal recovery before taking payment.")
      return existing.docs[0]
    }
    const pending = await payload.find({ collection: "orders", where: { and: [{ tenant: { equals: tenant.id } },
      { orderKind: { in: ["microsoft_mail_initial", "microsoft_mail_seats", "microsoft_mail_renewal"] } }, { state: { in: ["accepted", "fulfillment_pending"] } }] }, limit: 1, overrideAccess: true })
    if (pending.docs[0]) throw new Error("Finish or cancel the existing email order before placing another.")
    const quote = mailQuoteSchema.parse(run.data.quote)
    if (quote.quantity !== run.request.quantity || quote.quantity !== run.request.mailboxUsers.length) throw new Error("The mailbox request changed. Prepare a new quote.")
    if (quote.serviceId !== service.id || run.domain !== service.domain || Date.parse(quote.expiresAt) <= Date.now()) throw new Error("This quote has expired. Submit the mailbox details again.")
    if (quote.operation === "initial" && service.status !== "draft" || quote.operation !== "initial" && service.status !== "active") throw new Error("This email service changed. Request an updated quote.")
    if (process.env.MICROSOFT_MAIL_CHECKOUT_ENABLED !== "true" || process.env.MICROSOFT_MAIL_LIVE_PROVISIONING_ENABLED !== "true" || !inspectMicrosoftMailReadiness().readyForLiveProvisioning) throw new Error("Email ordering is not available until provider setup is complete.")
    await createPartnerTokenProvider(payload)({ tenantId: process.env.MICROSOFT_PARTNER_TENANT_ID ?? "", resource: "partner_center" })
    await new ExchangeWorkerClient({ endpoint: process.env.EXCHANGE_WORKER_URL ?? "", sharedSecret: process.env.EXCHANGE_WORKER_SHARED_SECRET ?? "" }).health()
    const legal = await checkoutLegalDocuments(payload, input.actor.language === "nl" ? "nl" : "en")
    if (!legal || !("id" in legal.terms) || !("id" in legal.privacy)) throw new Error("The current agreements are unavailable. Contact Siteinabox.")
    if (input.legalVersion !== `${legal.terms.id}:${legal.terms.contentHash}:${legal.privacy.id}:${legal.privacy.contentHash}`) throw new Error("The agreements changed. Reload and review them before confirming.")
    const now = new Date().toISOString()
    const lines = [{ code: "microsoft-365-business-basic-eea-no-teams", description: "Microsoft 365 Business Basic EEA (no Teams)", quantity: quote.quantity, netAmountMinor: quote.unitNetMinor * quote.quantity },
      ...(quote.platformNetMinor ? [{ code: "siteinabox-email-service", description: "Siteinabox email service", quantity: 1, netAmountMinor: quote.platformNetMinor }] : [])]
    const transactionID = await payload.db.beginTransaction()
    if (!transactionID) throw new Error("The order transaction could not start.")
    const req = { transactionID }
    try {
    const order = await payload.create({ collection: "orders", req, overrideAccess: true, data: {
      orderNumber: number, tenant: tenant.id, state: "accepted", orderKind: quote.operation === "seats" ? "microsoft_mail_seats" : quote.operation === "renewal" ? "microsoft_mail_renewal" : "microsoft_mail_initial", servicePeriodStartsAt: quote.servicePeriodStartsAt, servicePeriodEndsAt: quote.servicePeriodEndsAt, catalogVersion: "microsoft-mail-v1",
      billingCycleKey: quote.operation === "renewal" ? `mail-service:${service.id}:renewal:${quote.servicePeriodStartsAt}` : null,
      customerName: input.actor.name ?? input.actor.email, customerEmail: input.actor.email, companyName: run.request.customer.companyName,
      billingAddress: run.request.customer.address, packageCode: run.request.product, billingPeriod: "annual",
      renewalTerms: "One-year commitment billed annually. Renewal is invoiced separately unless a recurring payment mandate has been established.",
      lineItems: lines, netLineItems: lines, currency: quote.currency, subtotalNet: quote.subtotalNetMinor / 100, vatAmount: quote.vatAmountMinor / 100, totalGross: quote.totalGrossMinor / 100,
      subtotalNetMinor: quote.subtotalNetMinor, vatAmountMinor: quote.vatAmountMinor, totalGrossMinor: quote.totalGrossMinor, vatRateBasisPoints: 2100,
      domain: run.domain, domainRegistrant: run.request.customer, legalDocuments: [legal.terms.id, legal.privacy.id],
      termsVersion: legal.terms.documentVersion, privacyVersion: legal.privacy.documentVersion, acceptedAt: now,
      paymentProvider: quote.paymentProvider, paymentStatus: "pending", createdAt: now,
      quoteEvidence: { kind: "microsoft_mail", quote, runId: run.id, serviceId: service.id, requestIntent: mailProvisioningIntent(run.request), requestIntentHash: mailProvisioningIntentHash(run.request), customerConsent: run.data.customerConsent, legal: checkoutLegalIdentity(legal), confirmedBy: String(input.actor.id), confirmedAt: now },
    } })
    for (const document of [legal.terms, legal.privacy]) {
      await payload.create({ collection: "agreement-acceptances", req, overrideAccess: true, data: {
        evidenceKey: `mail-order:${order.id}:${document.id}`, tenant: tenant.id, order: order.id, document: document.id,
        documentVersion: document.documentVersion, acceptanceVersion: document.acceptanceVersion ?? document.documentVersion,
        contentHash: document.contentHash, statementVersion: legal.statement.version, statementText: legal.statement.text,
        actorUser: input.actor.id, actorEmail: input.actor.email, acceptedAt: now, requestId: randomUUID(),
      } })
    }
    await payload.update({ collection: "microsoft-mail-provisioning-runs", id: Number(run.id), data: {
      commerceOrder: order.id, mailService: service.id, data: { ...run.data, commerceOrderId: order.id, mailServiceId: service.id },
    }, req, overrideAccess: true, context: mailRunContext })
    await payload.db.commitTransaction(transactionID)
    return order
    } catch (error) {
      await payload.db.rollbackTransaction(transactionID)
      throw error
    }
  })
}

export async function createMailPayment(payload: Payload, orderId: string | number) {
  return withCommerceOrderLock(payload, orderId, async () => {
    const order = await payload.findByID({ collection: "orders", id: orderId, depth: 0, overrideAccess: true })
    if (!(["microsoft_mail_initial", "microsoft_mail_seats", "microsoft_mail_renewal"].includes(order.orderKind ?? "")) || order.paymentProvider !== "mollie" || order.state !== "accepted" || order.paymentStatus === "paid") throw new Error("This order cannot start an online payment.")
    if (order.orderKind === "microsoft_mail_renewal" && asRecord((await loadMailService(payload, Number(relationshipId(order.tenant)))).renewalData).cancellationState) throw new Error("This renewal requires internal recovery before taking payment.")
    const mode = mollieApiKeyMode()
    if (!["test", "live"].includes(mode) || process.env.NODE_ENV === "production" && mode !== "live") throw new Error("Online payment is not configured for this environment.")
    if (process.env.MICROSOFT_MAIL_CHECKOUT_ENABLED !== "true") throw new Error("Email checkout has not been enabled.")
    requireCommerceProviderWritesAllowed("Mollie email-payment creation")
    const origin = new URL(process.env.SITE_URL ?? "")
    if (origin.username || origin.password || origin.protocol !== "https:" && !(origin.protocol === "http:" && process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(origin.hostname))) throw new Error("Payment callbacks require HTTPS.")
    const attempts = await payload.find({ collection: "payment-attempts", where: { order: { equals: order.id } }, sort: "-attemptNumber", limit: 1, depth: 0, overrideAccess: true })
    let attempt = attempts.docs[0]
    if (attempt?.checkoutUrl && ["pending_provider", "created"].includes(attempt.state)) return attempt.checkoutUrl
    if (attempt?.reconciliationRequired || attempt?.state === "pending_provider") throw new Error("The payment outcome is being checked. Please wait.")
    if (!attempt || ["failed", "expired", "cancelled"].includes(attempt.state)) {
      const number = (attempt?.attemptNumber ?? 0) + 1
      attempt = await payload.create({ collection: "payment-attempts", overrideAccess: true, data: {
        idempotencyKey: `mollie:mail:order:${order.id}:authority-v3:${number}`, order: order.id, tenant: Number(relationshipId(order.tenant)), attemptNumber: number,
        state: "created", provider: "mollie", providerMode: mollieApiKeyMode() === "live" ? "live" : "test", purpose: "first_payment", sequenceType: "oneoff", currency: order.currency, reconciliationRequired: false,
        netAmountMinor: order.subtotalNetMinor!, vatAmountMinor: order.vatAmountMinor!, grossAmountMinor: order.totalGrossMinor!, createdAt: new Date().toISOString(),
      } })
    }
    await payload.update({ collection: "payment-attempts", id: attempt.id, data: { state: "pending_provider", reconciliationRequired: true }, overrideAccess: true, context: mailAttemptContext })
    let payment: MolliePayment
    try { payment = await createMolliePayment({ amount: { value: (attempt.grossAmountMinor / 100).toFixed(2), currency: attempt.currency }, sequenceType: "oneoff",
      description: `Siteinabox email ${order.orderNumber}`, redirectUrl: new URL("/email", origin).href,
      webhookUrl: new URL("/api/payments/mollie/webhook", origin).href, idempotencyKey: attempt.idempotencyKey,
      metadata: { orderId: String(order.id), paymentAttemptId: String(attempt.id), idempotencyKey: attempt.idempotencyKey, purpose: attempt.purpose } }) }
    catch (error) {
      if (error instanceof MollieApiError && error.status >= 400 && error.status < 500 && ![408,409].includes(error.status)) {
        await payload.update({ collection: "payment-attempts", id: attempt.id, data: { state: "failed", reconciliationRequired: false, failureCode: "payment_creation_rejected" }, overrideAccess: true, context: mailAttemptContext })
        await payload.update({ collection: "orders", id: order.id, data: { paymentStatus: "failed" }, overrideAccess: true, context: mailOrderContext })
      }
      throw new Error("The payment could not be started. Its status will be checked before retrying.")
    }
    const checkout = payment._links?.checkout?.href
    if (!payment.id || !checkout || payment.mode !== attempt.providerMode || new URL(checkout).protocol !== "https:") throw new Error("Payment confirmation is being checked.")
    await payload.update({ collection: "payment-attempts", id: attempt.id, data: { providerPaymentId: payment.id, providerStatus: payment.status, checkoutUrl: checkout, reconciliationRequired: false }, overrideAccess: true, context: mailAttemptContext })
    await payload.update({ collection: "orders", id: order.id, data: { paymentStatus: "open", providerPaymentId: payment.id }, overrideAccess: true, context: mailOrderContext })
    return checkout
  })
}

export async function settleMailOrderExternally(payload: Payload, input: { orderId: number; actor: User; amountMinor: number; currency: string; reference: string; receivedAt: string }) {
  if (input.actor.role !== "super-admin" || !input.reference.trim() || !Number.isFinite(Date.parse(input.receivedAt)) || Date.parse(input.receivedAt) > Date.now()) throw new Error("A recorded external payment requires super-admin authority, reference and valid received date.")
  const selected = await payload.findByID({ collection: "orders", id: input.orderId, depth: 0, overrideAccess: true })
  const tenantId = relationshipId(selected.tenant)
  if (!tenantId) throw new Error("The email order has no customer workspace.")
  return withCommerceOrderLock(payload, `mail-service:${tenantId}`, () => withCommerceOrderLock(payload, input.orderId, async () => {
    const order = await payload.findByID({ collection: "orders", id: input.orderId, depth: 0, overrideAccess: true })
    if (!(["microsoft_mail_initial", "microsoft_mail_seats", "microsoft_mail_renewal"].includes(order.orderKind ?? "")) || order.paymentProvider !== "manual" || order.totalGrossMinor !== input.amountMinor || order.currency !== input.currency) throw new Error("The payment must match the exact externally billed email order.")
    const prior = await payload.find({ collection: "payment-attempts", where: { order: { equals: order.id } }, depth: 0, limit: 2, overrideAccess: true })
    if (prior.totalDocs > 1) throw new Error("Multiple payments require reconciliation.")
    if (prior.docs.some(value => value.provider !== "manual" || value.state !== "paid")) throw new Error("Reconcile the existing payment attempt first.")
    if (prior.docs[0]) {
      const history = Array.isArray(prior.docs[0].stateHistory) ? prior.docs[0].stateHistory.map(asRecord) : []
      if (history[0]?.reference !== input.reference.trim() || prior.docs[0].paidAt !== input.receivedAt) throw new Error("The recorded external payment is immutable. Reconcile differing receipt details internally.")
    }
    if (!["accepted", "fulfillment_pending", "fulfilled"].includes(order.state ?? "")) throw new Error("This order cannot be settled.")
    const now = new Date().toISOString()
    let attempt = prior.docs[0]
    const transactionID = await payload.db.beginTransaction()
    if (!transactionID) throw new Error("The settlement transaction could not start.")
    const req = { transactionID }
    try {
    attempt = attempt ?? await payload.create({ collection: "payment-attempts", req, overrideAccess: true, data: {
      idempotencyKey: `manual:mail:order:${order.id}`, order: order.id, tenant: Number(relationshipId(order.tenant)), attemptNumber: 1,
      provider: "manual", providerMode: "manual", state: "paid", purpose: "first_payment", sequenceType: "oneoff", currency: order.currency, reconciliationRequired: false,
      netAmountMinor: order.subtotalNetMinor!, vatAmountMinor: order.vatAmountMinor!, grossAmountMinor: order.totalGrossMinor!, paidAt: input.receivedAt, createdAt: now,
      stateHistory: [{ state: "paid", recordedAt: now, receivedAt: input.receivedAt, actorId: String(input.actor.id), reference: input.reference.trim(), coveredPeriod: "annual" }],
    } })
    if (order.state === "accepted") await payload.update({ collection: "orders", id: order.id, data: { state: "fulfillment_pending", paymentStatus: "paid", paidAt: input.receivedAt }, overrideAccess: true, context: mailOrderContext, req })
    await payload.db.commitTransaction(transactionID)
    } catch (error) { await payload.db.rollbackTransaction(transactionID); throw error }
    if (!attempt) throw new Error("The settlement could not be recorded.")
    await ensureInvoiceEvidence({ payload, order: { ...order, paymentStatus: "paid" }, paymentAttempt: attempt, issuedAt: now })
    await queueOrderFulfillment(payload, { orderId: order.id, paymentAttemptId: attempt.id })
    return order.id
  }))
}
