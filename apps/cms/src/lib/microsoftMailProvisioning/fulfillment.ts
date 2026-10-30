import { requireMailDomainEnabled } from "./rollout"
import { allocateMicrosoftInitialDomain, MicrosoftTenantDiscoveryError } from "./tenantDiscovery"
import { requireLiveMailWritesAllowed } from "./writeGate"
import "server-only"
import type { Payload } from "payload"
import type { Order, PaymentAttempt } from "@/payload-types"
import { relationshipId } from "../relationshipId"
import { withCommerceOrderLock } from "../commerce/orderLock"
import { mailProviderAnnualCostMinor, assertPaidMailOrder, mailQuoteSchema } from "./quote"
import { loadMailService, mailOrderContext, mailServiceContext } from "./commerce"
import { PayloadMicrosoftMailProvisioningStore } from "./payloadStore"
import { createPax8MailClient } from "./pax8Preflight"
import { Pax8ApiError, Pax8IndeterminateWriteError, type Pax8OrderInput } from "./pax8"
import { inspectMicrosoftMailReadiness } from "./readiness"
import { createMicrosoftMailLivePorts } from "./livePorts"
import { advanceMicrosoftMailProvisioning, type MicrosoftMailProvisioningRun } from "./workflow"
import type { FulfillOrderResult } from "../payments/fulfillOrder"
import { mailProvisioningIntentHash } from "./model"

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}

export async function fulfillMicrosoftMailOrder(payload: Payload, order: Order, attempt: PaymentAttempt): Promise<FulfillOrderResult> {
  const authoritative = await payload.findByID({ collection: "orders", id: order.id, depth: 0, overrideAccess: true })
  const tenantId = relationshipId(authoritative.tenant)
  if (!tenantId) throw new Error("The mail order has no customer workspace.")
  return withCommerceOrderLock(payload, `mail-service:${tenantId}`, () => withCommerceOrderLock(payload, authoritative.id, async () => {
    const [currentOrder, currentAttempt] = await Promise.all([
      payload.findByID({ collection: "orders", id: authoritative.id, depth: 0, overrideAccess: true }),
      payload.findByID({ collection: "payment-attempts", id: attempt.id, depth: 0, overrideAccess: true }),
    ])
    return fulfillMicrosoftMailOrderLocked(payload, currentOrder, currentAttempt)
  }))
}

async function fulfillMicrosoftMailOrderLocked(payload: Payload, order: Order, attempt: PaymentAttempt): Promise<FulfillOrderResult> {
  const evidence = record(order.quoteEvidence)
  const quote = mailQuoteSchema.parse(evidence.quote)
  const expectedKind = quote.operation === "seats" ? "microsoft_mail_seats" : quote.operation === "renewal" ? "microsoft_mail_renewal" : "microsoft_mail_initial"
  if (order.orderKind !== expectedKind) throw new Error("Email order type does not match its accepted quote.")
  const tenantId = Number(relationshipId(order.tenant))
  assertPaidMailOrder({ orderId: order.id, tenantId, orderTenantId: relationshipId(order.tenant), orderStatus: order.state ?? "",
    paymentStatus: order.paymentStatus, paymentOrderId: relationshipId(attempt.order), paymentTenantId: relationshipId(attempt.tenant),
    attemptState: attempt.state, purpose: attempt.purpose, grossMinor: order.totalGrossMinor ?? -1, paidGrossMinor: attempt.grossAmountMinor,
    currency: order.currency, paidCurrency: attempt.currency, provider: attempt.provider, providerMode: attempt.providerMode })
  if (quote.totalGrossMinor !== attempt.grossAmountMinor || evidence.kind !== "microsoft_mail") throw new Error("The paid email order has inconsistent quote evidence.")
  const service = await loadMailService(payload, tenantId)
  if (service.id !== quote.serviceId || service.domain !== order.domain) throw new Error("Email service does not match the paid order.")
  if (order.state === "fulfilled") return { status: "fulfilled", orderId: order.id }
  const tenant = await payload.findByID({ collection: "tenants", id: tenantId, depth: 0, overrideAccess: true })
  if (tenant.status !== "active") return { status: "waiting", orderId: order.id, message: "The customer workspace is not active." }
  if (process.env.MICROSOFT_MAIL_LIVE_PROVISIONING_ENABLED !== "true" || !inspectMicrosoftMailReadiness().readyForLiveProvisioning) {
    return { status: "waiting", orderId: order.id, message: "Email provider configuration is incomplete." }
  }
  try { requireMailDomainEnabled(service.domain); requireLiveMailWritesAllowed() } catch { return { status: "waiting", orderId: order.id, message: "Live email writes are disabled by the commerce release gate." } }
  const connections = await payload.find({ collection: "microsoft-partner-connections", where: { and: [
    { partnerTenantId: { equals: process.env.MICROSOFT_PARTNER_TENANT_ID } }, { clientId: { equals: process.env.MICROSOFT_PARTNER_APP_CLIENT_ID } }, { status: { equals: "connected" } },
  ] }, limit: 1, overrideAccess: true })
  if (!connections.docs[0]) return { status: "waiting", orderId: order.id, message: "The Microsoft partner connection requires sign-in." }

  return withCommerceOrderLock(payload, `mail-run:${evidence.runId}`, async () => {
    const store = new PayloadMicrosoftMailProvisioningStore(payload)
    let run = await store.get(Number(evidence.runId))
    if (!run || run.tenantId !== tenantId || run.domain !== service.domain || run.mode !== "live") throw new Error("The provisioning request is not bound to this paid order.")
    if (evidence.requestIntentHash !== mailProvisioningIntentHash(run.request)) throw new Error("The provisioning request does not match the accepted order.")
    const frozenConsent = record(evidence.customerConsent), currentConsent = record(run.data.customerConsent)
    const consentFields = ["mcaAccepted", "serviceAuthorized", "confirmSignatoryAuthority", "actorUserId", "signatoryFirstName", "signatoryLastName", "signatoryEmail", "acceptedAt", "mcaDocumentUrl", "mcaCountry", "mcaChannel", "mcaAudience", "consentCopyVersion"]
    if (consentFields.some(field => frozenConsent[field] !== currentConsent[field])) throw new Error("The customer agreement evidence changed after order acceptance.")

    if (String(run.data.commerceOrderId) !== String(order.id)) throw new Error("The provisioning request references a different order.")
    if (["manual_review", "failed", "cancelled"].includes(run.state)) return { status: "failed", orderId: order.id, message: "Email provisioning requires operator review." }
    const save = async (patch: Partial<MicrosoftMailProvisioningRun>) => { run = await store.update(run!.id, { ...patch, updatedAt: new Date().toISOString() }); return run }
    const client = createPax8MailClient()
    try {
      if (quote.operation === "initial" && !service.microsoftTenantId && !run.data.pax8OrderId && !run.data.bootstrapInitialDomainAbsentAt) {
        const allocation = await allocateMicrosoftInitialDomain({ tenantId, serviceId: service.id, domain: service.domain })
        await save({ data: { ...run.data, bootstrapInitialDomain: allocation.initialDomain, bootstrapInitialDomainAllocatorAttempt: allocation.attempt, mailServiceId: service.id, bootstrapInitialDomainAbsentAt: new Date().toISOString() } })
      }
      if (quote.operation === "renewal") {
        if (!service.pax8SubscriptionId || !quote.servicePeriodStartsAt || !quote.servicePeriodEndsAt || record(service.renewalData).cancellationState) throw new Error("RENEWAL_RECOVERY_REQUIRES_OPERATOR")
        if (Date.now() < Date.parse(quote.servicePeriodStartsAt)) {
          await save({ state: "subscription_pending", data: { ...run.data, nextCheckAt: new Date(Math.min(Date.parse(quote.servicePeriodStartsAt), Date.now() + 86_400_000)).toISOString() } })
          return { status: "waiting", orderId: order.id, message: "The next annual service period is paid and will be verified when it begins." }
        }
        const renewed = await client.getSubscription(service.pax8SubscriptionId)
        const actualStart = renewed.commitmentTermStartDate ?? renewed.startDate
        const actualEnd = renewed.commitmentTermEndDate
        if (renewed.companyId !== service.pax8CompanyId || renewed.productId !== quote.productId || renewed.billingTerm !== "Annual" || renewed.quantity !== quote.targetQuantity || !actualStart || !actualEnd || Math.abs(Date.parse(actualStart) - Date.parse(quote.servicePeriodStartsAt)) > 86_400_000 || Math.abs(Date.parse(actualEnd) - Date.parse(quote.servicePeriodEndsAt)) > 86_400_000) {
          await save({ state: "subscription_pending", issueCode: "RENEWAL_PROVIDER_CONFIRMATION_PENDING", data: { ...run.data, nextCheckAt: new Date(Date.now() + 3_600_000).toISOString() } })
          return { status: "waiting", orderId: order.id, message: "Waiting for the provider to confirm the next annual commitment." }
        }
        await payload.update({ collection: "microsoft-mail-services", id: service.id, data: { status: "active", currentPeriodEndsAt: actualEnd,
          renewalData: { lastPaidRenewalOrder: order.id, providerVerifiedAt: new Date().toISOString() }, issueCode: null }, overrideAccess: true, context: mailServiceContext })
        await save({ state: "ready", issueCode: null })
        if (order.state !== "fulfilled") await payload.update({ collection: "orders", id: order.id, data: { state: "fulfilled" }, overrideAccess: true, context: mailOrderContext })
        return { status: "fulfilled", orderId: order.id }
      }
      if (quote.operation === "seats" && !run.data.pax8CompanyId) {
        const previous = service.latestRun ? await store.get(Number(relationshipId(service.latestRun))) : null
        if (!previous || previous.tenantId !== tenantId || !service.pax8CompanyId || !service.microsoftTenantId || !service.microsoftInitialDomain) throw new Error("EXISTING_MICROSOFT_SERVICE_REQUIRES_REVIEW")
        await save({ state: "tenant_pending", data: { ...run.data, pax8CompanyId: service.pax8CompanyId, customerTenantId: service.microsoftTenantId,
          customerOrganizationDomain: service.microsoftInitialDomain, appConsentVersion: previous.data.appConsentVersion, mcaAccepted: previous.data.mcaAccepted,
          gdapRelationshipId: previous.data.gdapRelationshipId, gdapAccessAssignmentId: previous.data.gdapAccessAssignmentId,
          targetQuantity: quote.targetQuantity } })
      }
      if (!run.data.pax8CompanyId) {
        if (run.data.pax8CompanyCreationState === "started") throw new Pax8IndeterminateWriteError("company creation")
        let companyId = service.pax8CompanyId
        if (!companyId) {
          const existing = await client.findCompanyByWebsite(run.request.customer.website)
          if (existing) {
            await save({ state: "manual_review", issueCode: "EXISTING_PAX8_COMPANY_BINDING_REQUIRED" })
            return { status: "waiting", orderId: order.id, message: "An existing provider customer must be verified and linked internally." }
          }
          await save({ data: { ...run.data, pax8CompanyCreationState: "started" } })
          const customer = run.request.customer
          const company = await client.createCompany({ name: customer.companyName, website: customer.website, externalId: `siteinabox:${tenantId}`,
            phone: customer.phone, address: customer.address, contacts: [{ ...customer.primaryContact, types: ["Admin", "Billing", "Technical"].map(type => ({ type: type as "Admin" | "Billing" | "Technical", primary: true })) }] })
          companyId = company.id
        }
        const company = await client.getCompany(companyId)
        if (company.status?.toLowerCase() !== "active") throw new Error("PAX8_COMPANY_NOT_ACTIVE")
        await payload.update({ collection: "microsoft-mail-services", id: service.id, data: { pax8CompanyId: companyId, status: "provisioning", latestRun: Number(run.id), billingEmail: order.customerEmail }, overrideAccess: true, context: mailServiceContext })
        await save({ state: "tenant_pending", data: { ...run.data, pax8CompanyId: companyId, pax8CompanyCreationState: "complete" } })
      }
      if (quote.operation === "seats" && run.data.pax8QuantityUpdateConfirmed !== true) {
        if (run.data.pax8QuantityUpdateState === "started") throw new Pax8IndeterminateWriteError("subscription quantity update")
        if (!service.pax8SubscriptionId) throw new Error("PAX8_SUBSCRIPTION_REQUIRED")
        const before = await client.getSubscription(service.pax8SubscriptionId)
        if (before.companyId !== service.pax8CompanyId || before.productId !== quote.productId || before.quantity !== quote.baseQuantity) throw new Error("PAX8_SEAT_COUNT_CHANGED")
        const termStart = before.commitmentTermStartDate ?? before.startDate
        const termEnd = before.commitmentTermEndDate ?? service.currentPeriodEndsAt
        if (!quote.providerCommitmentStartsAt || !quote.providerCommitmentEndsAt || !termStart || !termEnd || Date.now() >= Date.parse(quote.providerCommitmentEndsAt) ||
          Date.parse(termStart) !== Date.parse(quote.providerCommitmentStartsAt) || Date.parse(termEnd) !== Date.parse(quote.providerCommitmentEndsAt)) throw new Error("PAX8_COMMITMENT_CHANGED_REQUOTE_REQUIRED")
        const price = await client.getPricing(quote.productId, service.pax8CompanyId ?? undefined)
        const rows = Array.isArray(price.content) ? price.content.map(record) : []
        const annual = rows.find(row => row.billingTerm === "Annual" && row.commitmentTerm === "1-Year")
        const rates = Array.isArray(annual?.rates) ? annual.rates.map(record) : []
        const rate = rates.filter(value => Number(value.startQuantityRange ?? 0) <= quote.targetQuantity && (value.endQuantityRange == null || Number(value.endQuantityRange) >= quote.targetQuantity)).sort((a,b) => Number(b.startQuantityRange ?? 0) - Number(a.startQuantityRange ?? 0))[0]
        if (!rate || mailProviderAnnualCostMinor(rate.partnerBuyRate) > quote.providerAnnualUnitCostMinor) throw new Error("PAX8_COST_CHANGED_AFTER_PAYMENT")
        await save({ data: { ...run.data, pax8QuantityUpdateState: "started" } })
        const changed = await client.updateSubscriptionQuantity(service.pax8SubscriptionId, quote.targetQuantity)
        if (changed.quantity !== quote.targetQuantity) throw new Pax8IndeterminateWriteError("subscription quantity confirmation")
        await save({ state: "subscription_pending", completedSteps: ["tenant_bootstrap", "subscription", "mca_acceptance", "domain_verification", "dkim_prepare", "dns_prepare", "dns_cutover", "dkim_enable"],
          data: { ...run.data, pax8QuantityUpdateState: "complete", pax8QuantityUpdateConfirmed: true, autoProvisionAuthorized: true,
            customerOrderAuthorized: true, targetQuantity: quote.targetQuantity,
            pax8OrderLineItems: [{ productId: quote.productId, subscriptionId: changed.id, quantity: quote.targetQuantity, billingTerm: "Annual" }] } })
      }
      if (quote.operation === "initial" && !run.data.pax8OrderId) {
        if (["started", "uncertain"].includes(String(run.data.pax8OrderSubmissionState))) throw new Pax8IndeterminateWriteError("order submission")
        const [fields, pricing, commitments] = await Promise.all([client.getProvisioningFields(quote.productId), client.getPricing(quote.productId, String(run.data.pax8CompanyId)), client.getCommitmentTerms(quote.productId)])
        if (!commitments.some(term => term.id === quote.commitmentTermId && /1.?year|annual/i.test(term.term))) throw new Error("PAX8_ANNUAL_TERM_CHANGED")
        const rows = Array.isArray(pricing.content) ? pricing.content.map(record) : []
        const annual = rows.find(row => row.billingTerm === "Annual" && row.commitmentTerm === "1-Year")
        const rates = Array.isArray(annual?.rates) ? annual.rates.map(record) : []
        const rate = rates.filter(value => Number(value.startQuantityRange ?? 0) <= quote.quantity && (value.endQuantityRange == null || Number(value.endQuantityRange) >= quote.quantity)).sort((a,b) => Number(b.startQuantityRange ?? 0) - Number(a.startQuantityRange ?? 0))[0]
        if (!rate || mailProviderAnnualCostMinor(rate.partnerBuyRate) > quote.providerAnnualUnitCostMinor) throw new Error("PAX8_COST_CHANGED_AFTER_PAYMENT")
        const consent = record(run.data.customerConsent)
        const details: Record<string, string> = {
          msCustExists: service.microsoftTenantId ? "Yes, the customer has and can log into their Microsoft account" : "No, the customer does not have a Microsoft account",
          msDomain: typeof run.data.bootstrapInitialDomain === "string" ? run.data.bootstrapInitialDomain.replace(/\.onmicrosoft\.com$/, "") : run.request.tenantPrefix, msMPNidval: process.env.PAX8_MPN_ID ?? "", msTenantId: service.microsoftTenantId ?? "",
          mca2020FirstName: String(consent.signatoryFirstName ?? ""), mca2020LastName: String(consent.signatoryLastName ?? ""), mca2020Email: String(consent.signatoryEmail ?? ""),
          msftContactFirstName: run.request.customer.primaryContact.firstName, msftContactLastName: run.request.customer.primaryContact.lastName,
          msftContactEmail: run.request.customer.primaryContact.email, companyRegistrationNumber: run.request.customer.registrationNumber,
          microsoftCancelPolicyAcknowledgement: fields.find(field => field.key === "microsoftCancelPolicyAcknowledgement")?.possibleValues?.[0] ?? "",
        }
        const unknownRequired = fields.find(field => field.required && field.key !== "microsoftGDAPDirect" && !details[field.key])
        if (unknownRequired) throw new Error("PAX8_PROVISIONING_SCHEMA_REQUIRES_REVIEW")
        if (!details.msMPNidval || !details.mca2020Email || consent.mcaAccepted !== true || consent.serviceAuthorized !== true) throw new Error("CUSTOMER_AUTHORIZATION_INCOMPLETE")
        const input: Pax8OrderInput = { companyId: String(run.data.pax8CompanyId), orderedByUserEmail: process.env.PAX8_ORDER_EMAIL ?? "", lineItems: [{
          productId: quote.productId, lineItemNumber: 1, quantity: quote.quantity, billingTerm: "Annual", commitmentTermId: quote.commitmentTermId,
          provisioningDetails: fields.flatMap(field => {
            const value = details[field.key]
            return field.key !== "microsoftGDAPDirect" && value ? [{ key: field.key, values: [value] }] : []
          }),
        }] }
        await client.createOrder(input, { mock: true })
        await save({ data: { ...run.data, pax8OrderSubmissionState: "started" } })
        const providerOrder = await client.createOrder(input, { mock: false })
        if (!providerOrder.id) throw new Pax8IndeterminateWriteError("missing order identifier")
        const request = !run.request.infoSharedMailbox && !run.request.infoAliasTarget && quote.legacyInfoForwardTo
          ? { ...run.request, retainInfoForward: true, infoForwardTo: quote.legacyInfoForwardTo }
          : run.request
        await save({ state: "subscription_pending", completedSteps: ["tenant_bootstrap", "subscription"], request,
          data: { ...run.data, pax8OrderSubmissionState: "complete", pax8OrderId: providerOrder.id, pax8OrderLineItems: providerOrder.lineItems,
            autoProvisionAuthorized: true, customerOrderAuthorized: true, routingHash: quote.routingHash,
            ...(service.microsoftTenantId ? { customerTenantId: service.microsoftTenantId } : {}),
            pax8McaAttestation: { status: "submitted_with_order", customerAcceptedAt: consent.acceptedAt, submittedAt: new Date().toISOString() } } })
      }
      if (quote.operation === "initial" && typeof run.data.pax8OrderId === "string") {
        const providerOrder = await client.getOrder(run.data.pax8OrderId)
        if (providerOrder.companyId !== run.data.pax8CompanyId || providerOrder.lineItems.length !== 1 || providerOrder.lineItems[0]?.productId !== quote.productId || providerOrder.lineItems[0]?.quantity !== quote.targetQuantity || providerOrder.lineItems[0]?.billingTerm !== "Annual") throw new Error("PAX8_ORDER_READBACK_MISMATCH")
        await save({ data: { ...run.data, pax8OrderLineItems: providerOrder.lineItems } })
        const subscriptionId = providerOrder.lineItems[0]?.subscriptionId
        if (subscriptionId) {
          const subscription = await client.getSubscription(subscriptionId)
          if (subscription.companyId !== run.data.pax8CompanyId || subscription.productId !== quote.productId) throw new Error("PAX8_SUBSCRIPTION_READBACK_MISMATCH")
          await payload.update({ collection: "microsoft-mail-services", id: service.id, data: { pax8SubscriptionId: subscription.id, currentPeriodEndsAt: subscription.commitmentTermEndDate ?? service.currentPeriodEndsAt, latestRun: Number(run.id), billingEmail: order.customerEmail }, overrideAccess: true, context: mailServiceContext })
        }
      }
      run = await advanceMicrosoftMailProvisioning({ run, store, ports: createMicrosoftMailLivePorts({ payload }) })
      if (run.state === "ready") {
        const lines = Array.isArray(run.data.pax8OrderLineItems) ? run.data.pax8OrderLineItems.map(record) : []
        const subscriptionId = lines.find(line => typeof line.subscriptionId === "string")?.subscriptionId
        const subscription = typeof subscriptionId === "string" ? await client.getSubscription(subscriptionId) : null
        await payload.update({ collection: "microsoft-mail-services", id: service.id, data: {
          renewalData: { ...record(service.renewalData), ...(run.request.infoSharedMailbox ? { infoSharedMailbox: `info@${run.domain}` } : {}) },
          status: "active", quantity: quote.targetQuantity, latestRun: Number(run.id), mailboxes: [...new Map([
            ...(Array.isArray(service.mailboxes) ? service.mailboxes.map(value => { const mailbox = record(value); return [String(mailbox.address), mailbox] as const }) : []),
            ...run.request.mailboxUsers.map(user => [user.userPrincipalName, { displayName: user.displayName, address: user.userPrincipalName }] as const),
          ]).values()], infoAliasTarget: run.request.infoAliasTarget ?? service.infoAliasTarget, infoForwardTo: run.request.infoForwardTo ?? service.infoForwardTo,
          pax8SubscriptionId: typeof subscriptionId === "string" ? subscriptionId : undefined, microsoftTenantId: String(run.data.customerTenantId),
          microsoftInitialDomain: String(run.data.customerOrganizationDomain), currentPeriodEndsAt: subscription?.commitmentTermEndDate ?? service.currentPeriodEndsAt ?? null, billingEmail: service.billingEmail ?? order.customerEmail, issueCode: null,
        }, overrideAccess: true, context: mailServiceContext })
        if (order.state !== "fulfilled") await payload.update({ collection: "orders", id: order.id, data: { state: "fulfilled" }, overrideAccess: true, context: mailOrderContext })
        return { status: "fulfilled", orderId: order.id }
      }
      await save({ data: { ...run.data, nextCheckAt: new Date(Date.now() + (run.state === "consent_pending" && run.data.autoProvisionAuthorized !== true ? 900_000 : 60_000)).toISOString() } })
      if (["failed", "manual_review"].includes(run.state)) await payload.update({ collection: "microsoft-mail-services", id: service.id, data: { status: "attention", issueCode: run.issueCode }, overrideAccess: true, context: mailServiceContext })
      return { status: "waiting", orderId: order.id, message: "Email provisioning is in progress." }
    } catch (error) {
      if (error instanceof MicrosoftTenantDiscoveryError && (error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500) && !run.data.pax8OrderId) {
        await save({ issueCode: "MICROSOFT_TENANT_DISCOVERY_RETRY", data: { ...run.data, nextCheckAt: new Date(Date.now() + 60_000).toISOString() } })
        return { status: "waiting", orderId: order.id, message: "Microsoft tenant availability is temporarily unavailable. Setup will retry automatically." }
      }
      const uncertain = error instanceof Pax8IndeterminateWriteError || !(error instanceof Pax8ApiError && error.status >= 400 && error.status < 500) && (run.data.pax8CompanyCreationState === "started" || run.data.pax8OrderSubmissionState === "started")
      await save({ state: "manual_review", issueCode: uncertain ? "PROVIDER_WRITE_RECONCILIATION_REQUIRED" : "EMAIL_PROVISIONING_REQUIRES_REVIEW" })
      await payload.update({ collection: "microsoft-mail-services", id: service.id, data: { status: "attention", issueCode: "EMAIL_PROVISIONING_REQUIRES_REVIEW" }, overrideAccess: true, context: mailServiceContext })
      return { status: "failed", orderId: order.id, message: "Email provisioning requires operator review." }
    }
  })
}
