"use server"
import { requireMailDomainEnabled } from "@/lib/microsoftMailProvisioning/rollout"
import { requireLiveMailWritesAllowed } from "@/lib/microsoftMailProvisioning/writeGate"
import { randomUUID } from "node:crypto"
import { createMicrosoftMailLiveClients } from "@/lib/microsoftMailProvisioning/livePorts"
import { MICROSOFT_MAIL_APPLICATION_GRANT_VERSION, MicrosoftApiError } from "@/lib/microsoftMailProvisioning/microsoft"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { getPayload, type Payload } from "payload"
import config from "@/payload.config"
import type { User } from "@/payload-types"
import { settleMailOrderExternally, loadMailService, mailServiceContext } from "@/lib/microsoftMailProvisioning/commerce"
import { mailQuoteSchema } from "@/lib/microsoftMailProvisioning/quote"
import { queueOrderFulfillment } from "@/lib/jobs/fulfillOrderTask"
import { relationshipId } from "@/lib/relationshipId"
import { withCommerceOrderLock } from "@/lib/commerce/orderLock"
import { createMicrosoftMailProvisioningMockPorts } from "@/lib/microsoftMailProvisioning/mockPorts"
import { PayloadMicrosoftMailProvisioningStore } from "@/lib/microsoftMailProvisioning/payloadStore"
import { startMicrosoftMailProvisioning, type MicrosoftMailProvisioningRun } from "@/lib/microsoftMailProvisioning/workflow"
import { createPax8MailClient } from "@/lib/microsoftMailProvisioning/pax8Preflight"

const operatorFromRequest = async () => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  const operator = user as User | null
  if (!operator || operator.role !== "super-admin" || !operator.email?.trim()) {
    throw new Error("Microsoft mail provisioning is restricted to super-admins.")
  }
  return { payload, operator }
}

const requestFromFormData = async (payload: Awaited<ReturnType<typeof getPayload>>, formData: FormData) => {
  const users = JSON.parse(String(formData.get("mailboxUsers") ?? "[]")) as unknown
  const tenantId = Number(formData.get("tenantId"))
  const tenant = await payload.findByID({ collection: "tenants", id: tenantId, depth: 0, overrideAccess: true })
  const tenantName = String(tenant.name ?? "").trim()
  const domain = String(formData.get("domain") ?? "").trim().toLowerCase()
  return {
    tenantId,
    domain,
    tenantPrefix: String(formData.get("tenantPrefix") ?? "").trim(),
    customer: {
      companyName: String(formData.get("companyName") ?? tenantName),
      website: String(formData.get("website") ?? `https://${domain}`),
      phone: String(formData.get("companyPhone") ?? ""),
      address: {
        street: String(formData.get("street") ?? ""),
        city: String(formData.get("city") ?? ""),
        postalCode: String(formData.get("postalCode") ?? ""),
        country: String(formData.get("country") ?? "NL").toUpperCase(),
      },
      registrationNumber: String(formData.get("registrationNumber") ?? ""),
      primaryContact: {
        firstName: String(formData.get("contactFirstName") ?? ""),
        lastName: String(formData.get("contactLastName") ?? ""),
        email: String(formData.get("primaryContactEmail") ?? "").trim(),
        phone: String(formData.get("contactPhone") ?? ""),
      },
    },
    mailboxUsers: users,
    retainInfoForward: formData.get("retainInfoForward") === "on",
    infoForwardTo: String(formData.get("infoForwardTo") ?? "").trim(),
    infoAliasTarget: String(formData.get("infoAliasTarget") ?? "").trim().toLowerCase(),
  }
}

async function withLockedMailRun<T>(payload: Payload, runId: number, operation: (run: MicrosoftMailProvisioningRun, store: PayloadMicrosoftMailProvisioningStore) => Promise<T>) {
  if (!Number.isSafeInteger(runId) || runId < 1) throw new Error("Invalid email request.")
  const store = new PayloadMicrosoftMailProvisioningStore(payload)
  const selected = await store.get(runId)
  if (!selected || selected.mode !== "live") throw new Error("Live email request not found.")
  return withCommerceOrderLock(payload, `mail-service:${selected.tenantId}`, () => withCommerceOrderLock(payload, `mail-run:${runId}`, async () => {
    const current = await store.get(runId)
    if (!current || current.tenantId !== selected.tenantId || current.mode !== "live") throw new Error("The email request changed.")
    return operation(current,store)
  }))
}

export async function startMockMicrosoftMailProvisioning(formData: FormData) {
  const { payload } = await operatorFromRequest()
  const request = await requestFromFormData(payload, formData)
  const result = await startMicrosoftMailProvisioning({
    request,
    store: new PayloadMicrosoftMailProvisioningStore(payload),
    ports: createMicrosoftMailProvisioningMockPorts(),
    mode: "mock",
  })
  revalidatePath("/operations/microsoft-mail")
  redirect(`/operations/microsoft-mail/${result.id}`)
}

export async function continueLiveMicrosoftMailProvisioningAction(formData: FormData) {
  const { payload, operator } = await operatorFromRequest()
  return withLockedMailRun(payload, Number(formData.get("runId")), async (run,store) => {
    if (!run.data.commerceOrderId) return { ok: false as const, code: "PAID_EMAIL_ORDER_REQUIRED" }
    const order = await payload.findByID({ collection: "orders", id: Number(run.data.commerceOrderId), depth: 0, overrideAccess: true })
    if (order.paymentStatus !== "paid" || order.state !== "fulfillment_pending" || relationshipId(order.tenant) !== String(run.tenantId)) return { ok: false as const, code: "PAID_EMAIL_ORDER_REQUIRED" }
    const tenantId = String(formData.get("customerTenantId") ?? "").trim()
    if (tenantId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) return { ok: false as const, code: "MICROSOFT_TENANT_ID_INVALID" }
    if (tenantId && run.data.customerTenantId && tenantId !== run.data.customerTenantId) return { ok: false as const, code: "MICROSOFT_TENANT_REBIND_REQUIRES_REVIEW" }
    let data: Record<string, unknown> = { ...run.data, nextCheckAt: new Date().toISOString() }
    if (tenantId && !run.data.customerTenantId) {
      if (formData.get("confirmPax8TenantLink") !== "on") return { ok: false as const, code: "CUSTOMER_TENANT_CONFIRMATION_REQUIRED" }
      const initialDomain = String(formData.get("customerInitialDomain") ?? "").trim().toLowerCase()
      if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.onmicrosoft\.com$/.test(initialDomain)) return { ok: false as const, code: "MICROSOFT_INITIAL_DOMAIN_REQUIRED" }
      data = { ...data, customerTenantId: tenantId, bootstrapInitialDomain: initialDomain, tenantBootstrapConfirmedAt: new Date().toISOString(), tenantBootstrapConfirmedBy: operator.email }
    }
    if (formData.get("confirmMcaAccepted") === "on") {
      const reference = String(formData.get("mcaConfirmationReference") ?? "").trim()
      if (!reference) return { ok: false as const, code: "AGREEMENT_CONFIRMATION_REFERENCE_REQUIRED" }
      data = { ...data, mcaAccepted: true, mcaAcceptedAt: new Date().toISOString(), mcaAcceptedBy: operator.email, mcaConfirmationReference: reference }
    }
    await store.update(run.id, { data, updatedAt: new Date().toISOString() })
    const attempts = await payload.find({ collection: "payment-attempts", where: { and: [{ order: { equals: order.id } }, { state: { in: ["paid", "refund_failed"] } }] }, sort: "-attemptNumber", limit: 1, overrideAccess: true })
    if (!attempts.docs[0]) return { ok: false as const, code: "PAID_EMAIL_ORDER_REQUIRED" }
    await queueOrderFulfillment(payload, { orderId: order.id, paymentAttemptId: attempts.docs[0].id })
    revalidatePath(`/operations/microsoft-mail/${run.id}`)
    return { ok: true as const, state: run.state, currentStep: run.currentStep, issueCode: run.issueCode }
  })
}

export async function recordExternalEmailPayment(formData: FormData) {
  const { payload, operator } = await operatorFromRequest()
  await settleMailOrderExternally(payload, { orderId: Number(formData.get("orderId")), actor: operator,
    amountMinor: Number(formData.get("amountMinor")), currency: String(formData.get("currency") ?? ""), reference: String(formData.get("reference") ?? ""),
    receivedAt: new Date(String(formData.get("receivedAt") ?? "")).toISOString() })
  revalidatePath("/operations/microsoft-mail")
  revalidatePath(`/operations/microsoft-mail/${String(formData.get("runId"))}`)
}

export async function reconcilePax8EmailOrder(formData: FormData) {
  const { payload, operator } = await operatorFromRequest()
  return withLockedMailRun(payload, Number(formData.get("runId")), async (run, store) => {
  if (run.state !== "manual_review" || !run.data.commerceOrderId) throw new Error("This order is not awaiting reconciliation.")
  const client = createPax8MailClient()
  const quote = mailQuoteSchema.parse(run.data.quote)
  const service = await loadMailService(payload, run.tenantId)
  if (service.id !== quote.serviceId || service.domain !== run.domain) throw new Error("The email service does not match the request.")
  if (quote.operation === "seats") {
    if (!service.pax8SubscriptionId) throw new Error("Verify the existing provider subscription first.")
    const subscription = await client.getSubscription(service.pax8SubscriptionId)
    if (subscription.companyId !== service.pax8CompanyId || subscription.productId !== quote.productId || subscription.quantity !== quote.targetQuantity || subscription.billingTerm !== "Annual") throw new Error("The provider has not confirmed the expected seat count. Reconcile the pending update before retrying.")
    await store.update(run.id, { state: "subscription_pending", issueCode: null,
      completedSteps: ["tenant_bootstrap", "subscription", "mca_acceptance", "domain_verification", "dkim_prepare", "dns_prepare", "dns_cutover", "dkim_enable"],
      data: { ...run.data, pax8QuantityUpdateConfirmed: true, pax8QuantityUpdateState: "complete", autoProvisionAuthorized: true, targetQuantity: quote.targetQuantity,
        pax8OrderLineItems: [{ productId: quote.productId, subscriptionId: subscription.id, quantity: quote.targetQuantity, billingTerm: "Annual" }], reconciledBy: operator.email, reconciledAt: new Date().toISOString() }, updatedAt: new Date().toISOString() })
    revalidatePath(`/operations/microsoft-mail/${run.id}`)
    return
  }
  const companyId = String(formData.get("companyId") ?? run.data.pax8CompanyId ?? "").trim()
  const providerOrderId = String(formData.get("providerOrderId") ?? "").trim()
  const company = await client.getCompany(companyId)
  if (company.status?.toLowerCase() !== "active" || company.name.trim().toLowerCase() !== run.request.customer.companyName.trim().toLowerCase()) throw new Error("The provider company must match the customer's legal name.")
  const data: Record<string, unknown> = { ...run.data, pax8CompanyId: company.id, pax8CompanyCreationState: "complete", routingHash: quote.routingHash, reconciledAt: new Date().toISOString(), reconciledBy: operator.email }
  if (providerOrderId) {
    const providerOrder = await client.getOrder(providerOrderId)
    if (providerOrder.companyId !== companyId || providerOrder.lineItems.length !== 1 || providerOrder.lineItems[0]?.productId !== "1bdd7ebb-f994-421f-ae98-b6a57bd9f947" || providerOrder.lineItems[0]?.quantity !== run.request.quantity || providerOrder.lineItems[0]?.billingTerm !== "Annual") throw new Error("The provider order must match this exact company, product, term and mailbox count.")
    Object.assign(data, { pax8OrderId: providerOrder.id, pax8OrderLineItems: providerOrder.lineItems, pax8OrderSubmissionState: "complete", autoProvisionAuthorized: true, customerOrderAuthorized: true })
  } else if (["started", "uncertain"].includes(String(run.data.pax8OrderSubmissionState))) {
    throw new Error("Supply the existing provider order ID before resuming an uncertain purchase.")
  }
  await store.update(run.id, { data, state: providerOrderId ? "subscription_pending" : "tenant_pending", issueCode: null,
    request: !run.request.infoSharedMailbox && !run.request.infoAliasTarget && quote.legacyInfoForwardTo ? { ...run.request, retainInfoForward: true, infoForwardTo: quote.legacyInfoForwardTo } : run.request,
    completedSteps: [...new Set([...run.completedSteps, "tenant_bootstrap" as const, ...(providerOrderId ? ["subscription" as const] : [])])], updatedAt: new Date().toISOString() })
  await payload.update({ collection: "microsoft-mail-services", id: service.id, data: { pax8CompanyId: company.id, status: "provisioning" }, overrideAccess: true, context: mailServiceContext })
  revalidatePath(`/operations/microsoft-mail/${run.id}`)
  })
}

// A deliberate repair of known incomplete grants, never a retry of an unknown purchase.
export async function repairCustomerApplicationAccess(formData: FormData) {
  const { payload, operator } = await operatorFromRequest()
  return withLockedMailRun(payload, Number(formData.get("runId")), async (run, store) => {
    if (formData.get("confirmGrantRepair") !== "on" || !["CUSTOMER_RECONSENT_REQUIRED", "EXCHANGE_ACCESS_REQUIRES_REVIEW"].includes(run.issueCode ?? "") || !run.data.commerceOrderId || !run.data.customerTenantId || run.data.grantRepairState === "started") throw new Error("Application access repair requires an eligible paid request and explicit confirmation.")
    const order = await payload.findByID({ collection: "orders", id: Number(run.data.commerceOrderId), depth: 0, overrideAccess: true })
    if (order.paymentStatus !== "paid" || order.state !== "fulfillment_pending" || relationshipId(order.tenant) !== String(run.tenantId)) throw new Error("A matching paid order is required.")
    requireMailDomainEnabled(run.domain)
    requireLiveMailWritesAllowed()
    const { microsoft } = createMicrosoftMailLiveClients({ payload })
    const now = new Date().toISOString(), requestId = randomUUID()
    const data = { ...run.data, grantRepairState: "started", grantRepairRequestedBy: operator.email, grantRepairRequestedAt: now, grantRepairRequestId: requestId }
    await store.update(run.id, { data, updatedAt: now })
    try {
      try { await microsoft.revokeCustomerApplicationConsent(String(run.data.customerTenantId)) }
      catch (error) { if (!(error instanceof MicrosoftApiError && error.status === 404)) throw error }
      await microsoft.consentCustomerApplication(String(run.data.customerTenantId), requestId)
      const stepStates = run.data.providerStepStates && typeof run.data.providerStepStates === "object" ? run.data.providerStepStates : {}
      await store.update(run.id, { state: "consent_pending", issueCode: "PARTNER_APP_CONSENT_PROPAGATING", completedSteps: run.completedSteps.filter(step => step !== "application_consent"),
        data: { ...data, grantRepairState: "submitted", appConsentVersion: null, appConsentVerified: false, appConsentSubmittedVersion: MICROSOFT_MAIL_APPLICATION_GRANT_VERSION,
          appConsentSubmittedAt: new Date().toISOString(), providerStepStates: { ...stepStates, application_consent: "waiting" }, nextCheckAt: new Date().toISOString() }, updatedAt: new Date().toISOString() })
    } catch {
      await store.update(run.id, { state: "manual_review", issueCode: "APPLICATION_GRANT_REPAIR_RECONCILIATION_REQUIRED", data, updatedAt: new Date().toISOString() })
    }
    revalidatePath(`/operations/microsoft-mail/${run.id}`)
  })
}
