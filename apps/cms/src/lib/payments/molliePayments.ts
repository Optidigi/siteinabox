import "server-only"

import {
  addBillingPeriod,
  assistedMigrationSupplementalEvidenceSchema,
  getCommercialCatalog,
  refundDecisionFor,
  type PaymentAttemptState,
  type RefundScenario,
} from "@siteinabox/contracts/commerce"
import type { Payload, Where } from "payload"
import type {
  AccountingDocument,
  BillingAgreement,
  CheckoutProfile,
  Order,
  PaymentAttempt,
  SiteGenerationRun,
  Tenant,
} from "@/payload-types"

import {
  ensureChargebackCreditNote,
  ensureInvoiceEvidence,
  ensurePendingCreditNote,
  ensureRefundCreditNote,
  issueCreditNote,
} from "@/lib/payments/accountingEvidence"
import {
  MollieApiError,
  createMollieCustomer,
  createMolliePayment,
  createMollieRefund,
  publicCmsOrigin,
  retrieveMollieMandate,
  retrieveMolliePayment,
  type MollieAmount,
  type MollieChargeback,
  type MolliePayment,
  type MollieRefund,
} from "@/lib/payments/mollieAdapter"
import {
  normalizeGenerationRunPaymentState,
  type GenerationRunPaymentState,
  type GenerationRunPaymentStatus,
} from "@/lib/payments/generationRunPayment"
import { PREVIEW_HOST } from "@/lib/preview/previewHost"
import { ensureCommerceNotification } from "@/lib/commerce/notifications"
import { requireCommerceProviderWritesAllowed } from "@/lib/commerce/releaseGate"
import { previewClientSlugFromDomain } from "@/lib/preview/previewAccess"
import { findOneDoc } from "@/lib/payloadCollection"
import { relationshipId, sameRelationshipId } from "@/lib/relationshipId"
import { verifyCheckoutEvidence } from "@/lib/legal/checkoutEvidence"

type CreateCheckoutInput = {
  runId: string | number
  customerEmail: string
  clientSlug?: string | null
  selectedDomain?: string | null
  actor?: string | number | null
  orderId?: string | number | null
}

type CheckoutResult = {
  payment: GenerationRunPaymentState
  paymentAttempt: PaymentAttempt
  billingAgreement: BillingAgreement
  checkoutUrl: string
  reused: boolean
}

export type MollieSynchronizationResult = {
  ok: true
  paymentAttemptId: string | number
  orderId: string | number
  state: PaymentAttemptState
  duplicate: boolean
  fulfillmentRequired: boolean
}

export class IgnorableMollieWebhookError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "IgnorableMollieWebhookError"
  }
}

export const isIgnorableMollieWebhookError = (error: unknown): boolean =>
  error instanceof IgnorableMollieWebhookError ||
  (error instanceof MollieApiError && error.status === 404)

const normalizeEmail = (value: string): string => value.trim().toLowerCase()

const numericRelationshipId = (value: Parameters<typeof relationshipId>[0]): number | undefined => {
  const id = relationshipId(value)
  if (id == null) return undefined
  const numeric = Number(id)
  if (!Number.isSafeInteger(numeric)) throw new Error("Expected a numeric Payload relationship id.")
  return numeric
}

const cleanDomain = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "")
  return normalized && normalized.includes(".") ? normalized : null
}

const selectedDomainFromOrder = (value: unknown): string | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const source = value as Record<string, unknown>
  return cleanDomain(source.selectedDomain ?? source.domain)
}

const isApproved = (run: SiteGenerationRun): boolean =>
  (run.clientApproval as { status?: unknown } | null | undefined)?.status === "approved"

const minorAmount = (amount: MollieAmount | null | undefined): number | null => {
  if (!amount || amount.currency !== "EUR" || !/^\d+\.\d{2}$/.test(amount.value)) return null
  const [whole, fraction] = amount.value.split(".")
  const value = Number(whole) * 100 + Number(fraction)
  return Number.isSafeInteger(value) && value >= 0 ? value : null
}

const mollieAmount = (minor: number, currency: string): MollieAmount => {
  if (!Number.isSafeInteger(minor) || minor < 0) {
    throw new Error("Payment amount must use non-negative integer minor units.")
  }
  return {
    currency,
    value: `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`,
  }
}

const orderAmounts = (order: Order) => {
  if (
    Number.isSafeInteger(order.subtotalNetMinor) &&
    Number.isSafeInteger(order.vatAmountMinor) &&
    Number.isSafeInteger(order.totalGrossMinor) &&
    order.subtotalNetMinor != null &&
    order.vatAmountMinor != null &&
    order.totalGrossMinor != null
  ) {
    return {
      netAmountMinor: order.subtotalNetMinor,
      vatAmountMinor: order.vatAmountMinor,
      grossAmountMinor: order.totalGrossMinor,
    }
  }
  const values = {
    netAmountMinor: Math.round(Number(order.subtotalNet) * 100),
    vatAmountMinor: Math.round(Number(order.vatAmount) * 100),
    grossAmountMinor: Math.round(Number(order.totalGross) * 100),
  }
  if (!Object.values(values).every((value) => Number.isSafeInteger(value) && value >= 0)) {
    throw new Error("Frozen order amounts are invalid.")
  }
  return values
}

const stateHistory = (
  current: unknown,
  state: PaymentAttemptState,
  at: string,
  providerStatus?: string | null,
) => [
  ...(Array.isArray(current) ? current : []),
  { state, at, ...(providerStatus ? { providerStatus } : {}) },
]

const agreementHistory = (
  current: unknown,
  state: BillingAgreement["state"],
  at: string,
  reason?: string,
) => [
  ...(Array.isArray(current) ? current : []),
  { state, at, ...(reason ? { reason } : {}) },
]

const loadRunAndTenant = async (
  payload: Payload,
  runId: string | number,
): Promise<{ run: SiteGenerationRun; tenant: Tenant }> => {
  const run = await payload.findByID({
    collection: "site-generation-runs",
    id: runId,
    depth: 0,
    overrideAccess: true,
  }) as SiteGenerationRun
  if (!run || run.status !== "preview_ready") {
    throw new Error("Generation run is not preview-ready.")
  }
  const tenantId = relationshipId(run.tenant)
  if (!tenantId) throw new Error("Generation run is missing a tenant.")
  const tenant = await payload.findByID({
    collection: "tenants",
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  }) as Tenant
  if (!tenant || tenant.status === "archived" || tenant.status === "suspended") {
    throw new Error("Tenant is not available for payment.")
  }
  return { run, tenant }
}

const molliePaymentProjection = (input: {
  current?: unknown
  status: GenerationRunPaymentStatus
  providerStatus: string
  externalReference: string
  checkoutUrl?: string | null
  customerEmail?: string | null
  clientSlug?: string | null
  selectedDomain?: string | null
  amount?: string | null
  currency?: string | null
  actor?: string | number | null
  note?: string | null
  mollieCustomerId?: string | null
  mollieSequenceType?: string | null
  renewalInterval?: string | null
  now?: string
}): GenerationRunPaymentState => {
  const current = normalizeGenerationRunPaymentState(input.current)
  const now = input.now ?? new Date().toISOString()
  return {
    ...current,
    status: input.status,
    provider: "mollie",
    externalReference: input.externalReference,
    actor: input.actor ?? current.actor,
    completedAt: input.status === "completed" ? (current.completedAt ?? now) : current.completedAt,
    updatedAt: now,
    note: input.note ?? current.note,
    checkoutUrl: input.checkoutUrl ?? current.checkoutUrl,
    customerEmail: input.customerEmail ?? current.customerEmail,
    clientSlug: input.clientSlug ?? current.clientSlug,
    selectedDomain: input.selectedDomain ?? current.selectedDomain,
    amount: input.amount ?? current.amount,
    currency: input.currency ?? current.currency,
    providerStatus: input.providerStatus,
    webhookProcessedAt: input.now ? now : current.webhookProcessedAt,
    mollieCustomerId: input.mollieCustomerId ?? current.mollieCustomerId,
    mollieSequenceType: input.mollieSequenceType ?? current.mollieSequenceType,
    mollieSubscriptionId: null,
    renewalInterval: input.renewalInterval ?? current.renewalInterval,
    waivedAt: current.waivedAt,
  }
}

const recurringNetAmount = (order: Order): number => {
  const catalog = getCommercialCatalog(order.catalogVersion ?? undefined)
  const subscription = order.billingPeriod === "annual"
    ? catalog.subscriptions.annual
    : catalog.subscriptions.monthly
  if (subscription.code !== order.packageCode) {
    throw new Error("Order package does not match its frozen commercial catalog.")
  }
  return subscription.netAmountMinor
}

const checkoutProfileForOrder = async (
  payload: Payload,
  order: Order,
): Promise<CheckoutProfile> => {
  if (!order.checkoutProfileKey) {
    throw new Error("Mollie first payment requires an authoritative checkout profile.")
  }
  const profile = await findOneDoc(payload, "checkout-profiles", {
    profileKey: { equals: order.checkoutProfileKey },
  })
  if (!profile) throw new Error("The order checkout profile no longer exists.")
  return profile
}

const createOrLoadBillingAgreement = async (
  payload: Payload,
  order: Order,
  profile: CheckoutProfile,
  now: string,
): Promise<BillingAgreement> => {
  const idempotencyKey = `mollie:billing-agreement:order:${order.id}:v1`
  const existing = await findOneDoc(payload, "billing-agreements", {
    idempotencyKey: { equals: idempotencyKey },
  })
  if (existing) return existing
  try {
    return await payload.create({
      collection: "billing-agreements",
      data: {
        idempotencyKey,
        originatingOrder: order.id,
        checkoutProfile: profile.id,
        tenant: numericRelationshipId(order.tenant),
        state: "pending_first_payment",
        provider: "mollie",
        catalogVersion: order.catalogVersion ?? getCommercialCatalog().catalogVersion,
        packageCode: order.packageCode,
        billingPeriod: order.billingPeriod === "annual" ? "annual" : "monthly",
        currency: order.currency,
        recurringNetAmountMinor: recurringNetAmount(order),
        renewalIntent: true,
        serviceSuspensionStatus: "none",
        reconciliationRequired: false,
        stateHistory: agreementHistory([], "pending_first_payment", now),
        createdAt: now,
      },
      depth: 0,
      overrideAccess: true,
    }) as BillingAgreement
  } catch (error) {
    const raced = await findOneDoc(payload, "billing-agreements", {
      idempotencyKey: { equals: idempotencyKey },
    })
    if (raced) return raced
    throw error
  }
}

const createOrLoadAttempt = async (
  payload: Payload,
  input: {
    order: Order
    billingAgreement?: BillingAgreement | null
    purpose: PaymentAttempt["purpose"]
    sequenceType: PaymentAttempt["sequenceType"]
    idempotencyKey: string
    attemptNumber?: number
    now: string
  },
): Promise<{ attempt: PaymentAttempt; created: boolean }> => {
  const attemptNumber = input.attemptNumber ?? 1
  const existingByKey = await findOneDoc(payload, "payment-attempts", {
    idempotencyKey: { equals: input.idempotencyKey },
  })
  if (existingByKey) return { attempt: existingByKey, created: false }
  const businessTuple: Where = {
    and: [
      { order: { equals: input.order.id } },
      { purpose: { equals: input.purpose } },
      { attemptNumber: { equals: attemptNumber } },
    ],
  }
  const existingByBusinessTuple = await findOneDoc(
    payload,
    "payment-attempts",
    businessTuple,
  )
  if (existingByBusinessTuple) {
    return { attempt: existingByBusinessTuple, created: false }
  }
  const amounts = orderAmounts(input.order)
  try {
    const attempt = await payload.create({
      collection: "payment-attempts",
      data: {
        idempotencyKey: input.idempotencyKey,
        order: input.order.id,
        billingAgreement: input.billingAgreement?.id,
        tenant: numericRelationshipId(input.order.tenant),
        attemptNumber,
        state: "created",
        purpose: input.purpose,
        sequenceType: input.sequenceType,
        provider: "mollie",
        currency: input.order.currency,
        ...amounts,
        reconciliationRequired: false,
        stateHistory: stateHistory([], "created", input.now),
        createdAt: input.now,
      },
      depth: 0,
      overrideAccess: true,
    }) as PaymentAttempt
    return { attempt, created: true }
  } catch (error) {
    const racedByKey = await findOneDoc(payload, "payment-attempts", {
      idempotencyKey: { equals: input.idempotencyKey },
    })
    if (racedByKey) return { attempt: racedByKey, created: false }
    const racedByBusinessTuple = await findOneDoc(
      payload,
      "payment-attempts",
      businessTuple,
    )
    if (racedByBusinessTuple) {
      return { attempt: racedByBusinessTuple, created: false }
    }
    throw error
  }
}

const createOrLoadRetryableAttempt = async (
  payload: Payload,
  input: {
    order: Order
    billingAgreement?: BillingAgreement | null
    purpose: PaymentAttempt["purpose"]
    sequenceType: PaymentAttempt["sequenceType"]
    idempotencyKeyPrefix: string
    now: string
  },
): Promise<{ attempt: PaymentAttempt; created: boolean }> => {
  const result = await payload.find({
    collection: "payment-attempts",
    where: {
      and: [
        { order: { equals: input.order.id } },
        { purpose: { equals: input.purpose } },
      ],
    },
    sort: "-attemptNumber",
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const latest = result.docs[0] as PaymentAttempt | undefined
  const terminalRetryable = latest &&
    ["failed", "cancelled", "expired"].includes(latest.state) &&
    !latest.reconciliationRequired
  const attemptNumber = terminalRetryable
    ? latest.attemptNumber + 1
    : latest?.attemptNumber ?? 1
  return createOrLoadAttempt(payload, {
    order: input.order,
    billingAgreement: input.billingAgreement,
    purpose: input.purpose,
    sequenceType: input.sequenceType,
    idempotencyKey: `${input.idempotencyKeyPrefix}:attempt-${attemptNumber}`,
    attemptNumber,
    now: input.now,
  })
}

const updateAttempt = (
  payload: Payload,
  attempt: PaymentAttempt,
  data: Partial<PaymentAttempt>,
): Promise<PaymentAttempt> =>
  payload.update({
    collection: "payment-attempts",
    id: attempt.id,
    data,
    depth: 0,
    overrideAccess: true,
    context: { paymentAttemptLifecycleMutation: true },
  }) as Promise<PaymentAttempt>

const updateAgreement = (
  payload: Payload,
  agreement: BillingAgreement,
  data: Partial<BillingAgreement>,
): Promise<BillingAgreement> =>
  payload.update({
    collection: "billing-agreements",
    id: agreement.id,
    data,
    depth: 0,
    overrideAccess: true,
    context: { billingAgreementLifecycleMutation: true },
  }) as Promise<BillingAgreement>

const markProviderWriteIndeterminate = async (
  payload: Payload,
  attempt: PaymentAttempt,
  error: unknown,
): Promise<void> => {
  const now = new Date().toISOString()
  const knownRejected = error instanceof MollieApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 409
  await updateAttempt(payload, attempt, {
    state: knownRejected ? "failed" : "pending_provider",
    reconciliationRequired: !knownRejected,
    failedAt: knownRejected ? now : undefined,
    failureCode: knownRejected ? `mollie_http_${error.status}` : "provider_write_indeterminate",
    failureMessage: error instanceof Error ? error.message : "Mollie provider write failed.",
    stateHistory: stateHistory(
      attempt.stateHistory,
      knownRejected ? "failed" : "pending_provider",
      now,
    ),
  })
}

export async function createMollieCheckoutForGenerationRun(
  payload: Payload,
  input: CreateCheckoutInput,
): Promise<CheckoutResult> {
  const email = normalizeEmail(input.customerEmail)
  if (!email) throw new Error("Customer email is required for Mollie checkout.")
  const { run, tenant } = await loadRunAndTenant(payload, input.runId)
  if (!isApproved(run)) throw new Error("Mollie checkout requires approved preview.")
  if (input.orderId == null) throw new Error("Mollie checkout requires a frozen legal order.")
  const { order } = await verifyCheckoutEvidence(payload, {
    runId: run.id,
    orderId: input.orderId,
    customerEmail: email,
  })
  const clientSlug = input.clientSlug ||
    previewClientSlugFromDomain(tenant.domain, String(tenant.slug ?? tenant.name ?? ""))
  if (!clientSlug) throw new Error("Client preview slug is required for Mollie checkout.")
  const selectedDomain = cleanDomain(input.selectedDomain) ??
    selectedDomainFromOrder(run.domainOrder) ??
    cleanDomain(tenant.domain)
  if (!selectedDomain) throw new Error("Selected domain is required for checkout.")
  if (cleanDomain(order.domain) !== selectedDomain) {
    throw new Error("Frozen order domain does not match checkout domain.")
  }
  const currentProjection = normalizeGenerationRunPaymentState(run.payment)
  if (currentProjection.status === "completed" || currentProjection.status === "waived") {
    throw new Error("Payment gate is already satisfied.")
  }

  const now = new Date().toISOString()
  const profile = await checkoutProfileForOrder(payload, order)
  const agreement = await createOrLoadBillingAgreement(payload, order, profile, now)
  const attemptResult = await createOrLoadRetryableAttempt(payload, {
    order,
    billingAgreement: agreement,
    purpose: "first_payment",
    sequenceType: "first",
    idempotencyKeyPrefix: `mollie:first-payment:order:${order.id}:authority-v3`,
    now,
  })
  let attempt = attemptResult.attempt
  if (
    attempt.state === "pending_provider" &&
    attempt.providerPaymentId &&
    attempt.checkoutUrl
  ) {
    const projection = molliePaymentProjection({
      current: run.payment,
      status: "pending_provider",
      providerStatus: attempt.providerStatus ?? "open",
      externalReference: attempt.providerPaymentId,
      checkoutUrl: attempt.checkoutUrl,
      customerEmail: email,
      clientSlug,
      selectedDomain,
      amount: mollieAmount(attempt.grossAmountMinor, attempt.currency).value,
      currency: attempt.currency,
      actor: input.actor ?? email,
      mollieCustomerId: agreement.providerCustomerId,
      mollieSequenceType: "first",
      renewalInterval: agreement.billingPeriod === "annual" ? "1 year" : "1 month",
    })
    return {
      payment: projection,
      paymentAttempt: attempt,
      billingAgreement: agreement,
      checkoutUrl: attempt.checkoutUrl,
      reused: true,
    }
  }
  if (attempt.reconciliationRequired) {
    throw new Error("Mollie payment creation requires reconciliation before retry.")
  }
  if (!attemptResult.created) {
    throw new Error("Mollie payment creation is already claimed or requires reconciliation.")
  }
  requireCommerceProviderWritesAllowed("Mollie first-payment creation")

  let currentAgreement = agreement
  if (!currentAgreement.providerCustomerId) {
    if (currentAgreement.reconciliationRequired) {
      throw new Error("Mollie customer creation requires reconciliation before retry.")
    }
    try {
      const customer = await createMollieCustomer({
        name: profile.contractingPartyName || profile.customerName,
        email,
        idempotencyKey: `${currentAgreement.idempotencyKey}:customer`,
        metadata: {
          billingAgreementId: currentAgreement.id,
          orderId: order.id,
          tenantId: relationshipId(order.tenant),
        },
      })
      currentAgreement = await updateAgreement(payload, currentAgreement, {
        providerCustomerId: customer.id,
        lastSyncedAt: now,
      })
    } catch (error) {
      await updateAgreement(payload, currentAgreement, {
        reconciliationRequired: true,
        failureReason: error instanceof Error ? error.message : "Mollie customer creation failed.",
        lastSyncedAt: now,
      })
      throw error
    }
  }

  if (attempt.state === "created") {
    attempt = await updateAttempt(payload, attempt, {
      state: "pending_provider",
      reconciliationRequired: true,
      stateHistory: stateHistory(attempt.stateHistory, "pending_provider", now),
    })
  }
  if (currentAgreement.state === "pending_first_payment") {
    currentAgreement = await updateAgreement(payload, currentAgreement, {
      state: "mandate_pending",
      stateHistory: agreementHistory(
        currentAgreement.stateHistory,
        "mandate_pending",
        now,
      ),
    })
  }

  const amount = mollieAmount(attempt.grossAmountMinor, attempt.currency)
  const origin = publicCmsOrigin()
  try {
    const payment = await createMolliePayment({
      amount,
      customerId: currentAgreement.providerCustomerId,
      sequenceType: "first",
      description: `Site in a Box website ${selectedDomain}`,
      redirectUrl: `https://${PREVIEW_HOST}/${clientSlug}/checkout?payment=return`,
      webhookUrl: `${origin}/api/payments/mollie/webhook`,
      idempotencyKey: attempt.idempotencyKey,
      metadata: {
        paymentAttemptId: attempt.id,
        billingAgreementId: currentAgreement.id,
        generationRunId: run.id,
        tenantId: tenant.id,
        customerEmail: email,
        clientSlug,
        selectedDomain,
        idempotencyKey: attempt.idempotencyKey,
        mollieCustomerId: currentAgreement.providerCustomerId ?? null,
        sequenceType: "first",
        purpose: attempt.purpose,
        orderId: order.id,
      },
    })
    const checkoutUrl = payment._links?.checkout?.href
    if (!payment.id || !checkoutUrl) {
      throw new Error("Mollie did not return a payment id and checkout URL.")
    }
    attempt = await updateAttempt(payload, attempt, {
      state: "pending_provider",
      providerPaymentId: payment.id,
      providerStatus: payment.status,
      checkoutUrl,
      reconciliationRequired: false,
      lastSyncedAt: now,
      stateHistory: stateHistory(attempt.stateHistory, "pending_provider", now, payment.status),
    })
    const projection = molliePaymentProjection({
      current: run.payment,
      status: "pending_provider",
      providerStatus: payment.status,
      externalReference: payment.id,
      checkoutUrl,
      customerEmail: email,
      clientSlug,
      selectedDomain,
      amount: amount.value,
      currency: amount.currency,
      actor: input.actor ?? email,
      note: "Mollie checkout created. Payment completion is confirmed asynchronously.",
      mollieCustomerId: currentAgreement.providerCustomerId,
      mollieSequenceType: "first",
      renewalInterval: currentAgreement.billingPeriod === "annual" ? "1 year" : "1 month",
    })
    await Promise.all([
      payload.update({
        collection: "site-generation-runs",
        id: run.id,
        data: { payment: projection },
        depth: 0,
        overrideAccess: true,
        user: input.actor ? ({ id: input.actor }) : undefined,
      }),
      payload.update({
        collection: "orders",
        id: order.id,
        data: { paymentStatus: "open", providerPaymentId: payment.id },
        depth: 0,
        overrideAccess: true,
        context: { legalOrderLifecycleMutation: true },
      }),
    ])
    return {
      payment: projection,
      paymentAttempt: attempt,
      billingAgreement: currentAgreement,
      checkoutUrl,
      reused: false,
    }
  } catch (error) {
    await markProviderWriteIndeterminate(payload, attempt, error)
    throw error
  }
}

export async function createSupplementalMigrationMollieCheckout(
  payload: Payload,
  input: {
    orderId: string | number
    redirectUrl: string
  },
): Promise<{ paymentAttempt: PaymentAttempt; checkoutUrl: string; reused: boolean }> {
  const order = await payload.findByID({
    collection: "orders",
    id: input.orderId,
    depth: 0,
    overrideAccess: true,
  }) as Order
  if (
    order.orderKind !== "migration_supplemental" ||
    order.state !== "accepted" ||
    !["pending", "open", "failed", "cancelled", "expired"].includes(order.paymentStatus)
  ) {
    throw new Error("Supplemental Mollie checkout requires an accepted unpaid migration order.")
  }
  const evidence = assistedMigrationSupplementalEvidenceSchema.parse(order.quoteEvidence)
  if (!sameRelationshipId(order.supplementalForMigration, evidence.migrationId)) {
    throw new Error("Supplemental order migration evidence does not match its relationship.")
  }
  if (
    order.currency !== evidence.amount.currency ||
    order.subtotalNetMinor !== evidence.amount.netAmountMinor ||
    order.vatAmountMinor !== evidence.amount.vatAmountMinor ||
    order.totalGrossMinor !== evidence.amount.grossAmountMinor
  ) {
    throw new Error("Supplemental order amounts do not match its frozen quote evidence.")
  }
  const redirect = new URL(input.redirectUrl)
  const allowedOrigins = new Set([
    new URL(publicCmsOrigin()).origin,
    `https://${PREVIEW_HOST}`,
  ])
  if (redirect.protocol !== "https:" || !allowedOrigins.has(redirect.origin)) {
    throw new Error("Supplemental Mollie redirect must use an approved HTTPS origin.")
  }
  const now = new Date().toISOString()
  const attemptResult = await createOrLoadRetryableAttempt(payload, {
    order,
    purpose: "supplemental",
    sequenceType: "oneoff",
    idempotencyKeyPrefix: `mollie:supplemental:order:${order.id}:authority-v3`,
    now,
  })
  let attempt = attemptResult.attempt
  if (attempt.providerPaymentId && attempt.checkoutUrl) {
    return {
      paymentAttempt: attempt,
      checkoutUrl: attempt.checkoutUrl,
      reused: true,
    }
  }
  if (attempt.reconciliationRequired) {
    throw new Error("Supplemental Mollie payment requires reconciliation before retry.")
  }
  if (!attemptResult.created) {
    throw new Error("Supplemental Mollie payment is already claimed or requires reconciliation.")
  }
  requireCommerceProviderWritesAllowed("Mollie supplemental-payment creation")
  if (attempt.state === "created") {
    attempt = await updateAttempt(payload, attempt, {
      state: "pending_provider",
      reconciliationRequired: true,
      stateHistory: stateHistory(attempt.stateHistory, "pending_provider", now),
    })
  }
  try {
    const payment = await createMolliePayment({
      amount: mollieAmount(attempt.grossAmountMinor, attempt.currency),
      sequenceType: "oneoff",
      description: `Site in a Box begeleide migratie ${order.domain}`,
      redirectUrl: redirect.toString(),
      webhookUrl: `${publicCmsOrigin()}/api/payments/mollie/webhook`,
      idempotencyKey: attempt.idempotencyKey,
      metadata: {
        paymentAttemptId: attempt.id,
        tenantId: relationshipId(order.tenant),
        orderId: order.id,
        migrationId: evidence.migrationId,
        idempotencyKey: attempt.idempotencyKey,
        sequenceType: "oneoff",
        purpose: attempt.purpose,
      },
    })
    const checkoutUrl = payment._links?.checkout?.href
    if (!payment.id || !checkoutUrl) {
      throw new Error("Mollie did not return a supplemental payment id and checkout URL.")
    }
    attempt = await updateAttempt(payload, attempt, {
      state: "pending_provider",
      providerPaymentId: payment.id,
      providerStatus: payment.status,
      checkoutUrl,
      reconciliationRequired: false,
      lastSyncedAt: now,
      stateHistory: stateHistory(attempt.stateHistory, "pending_provider", now, payment.status),
    })
    await payload.update({
      collection: "orders",
      id: order.id,
      data: { paymentStatus: "open", providerPaymentId: payment.id },
      depth: 0,
      overrideAccess: true,
      context: { legalOrderLifecycleMutation: true },
    })
    return { paymentAttempt: attempt, checkoutUrl, reused: false }
  } catch (error) {
    await markProviderWriteIndeterminate(payload, attempt, error)
    throw error
  }
}

export async function createApplicationRecurringMolliePayment(
  payload: Payload,
  input: {
    billingAgreementId: string | number
    orderId: string | number
    purpose?: Extract<PaymentAttempt["purpose"], "recurring" | "domain_renewal">
    attemptNumber?: number
  },
): Promise<{ paymentAttempt: PaymentAttempt; reused: boolean }> {
  let agreement = await payload.findByID({
    collection: "billing-agreements",
    id: input.billingAgreementId,
    depth: 0,
    overrideAccess: true,
  }) as BillingAgreement
  const order = await payload.findByID({
    collection: "orders",
    id: input.orderId,
    depth: 0,
    overrideAccess: true,
  }) as Order
  if (!sameRelationshipId(agreement.tenant, order.tenant)) {
    throw new Error("Recurring order and billing agreement belong to different tenants.")
  }
  if (
    !["active", "past_due"].includes(agreement.state) ||
    !agreement.renewalIntent ||
    !agreement.providerCustomerId ||
    !agreement.providerMandateId
  ) {
    throw new Error("Recurring Mollie payment requires an active customer mandate.")
  }
  requireCommerceProviderWritesAllowed("Mollie recurring-payment creation")
  const mandate = await retrieveMollieMandate(
    agreement.providerCustomerId,
    agreement.providerMandateId,
  )
  if (mandate.status !== "valid") {
    agreement = await updateAgreement(payload, agreement, {
      state: "past_due",
      reconciliationRequired: true,
      failureReason: `Mollie mandate status is ${mandate.status}.`,
      lastSyncedAt: new Date().toISOString(),
      stateHistory: agreementHistory(
        agreement.stateHistory,
        "past_due",
        new Date().toISOString(),
        `mandate_${mandate.status}`,
      ),
    })
    throw new Error("Recurring Mollie payment requires a valid mandate.")
  }

  const purpose = input.purpose ?? "recurring"
  const attemptNumber = input.attemptNumber ?? 1
  if (!Number.isSafeInteger(attemptNumber) || attemptNumber < 1) {
    throw new Error("Recurring Mollie attempt number must be a positive safe integer.")
  }
  const now = new Date().toISOString()
  const attemptResult = await createOrLoadAttempt(payload, {
    order,
    billingAgreement: agreement,
    purpose,
    sequenceType: "recurring",
    idempotencyKey: `mollie:${purpose}:order:${order.id}:authority-v2:attempt-${attemptNumber}`,
    attemptNumber,
    now,
  })
  let attempt = attemptResult.attempt
  if (attempt.providerPaymentId) return { paymentAttempt: attempt, reused: true }
  if (
    order.state !== "accepted" ||
    !["pending", "open", "failed", "expired", "cancelled"].includes(order.paymentStatus) ||
    order.currency !== agreement.currency
  ) {
    throw new Error("Recurring Mollie payment requires an accepted unpaid order in the agreement currency.")
  }
  if (attempt.reconciliationRequired) {
    throw new Error("Recurring Mollie payment requires reconciliation before retry.")
  }
  if (!attemptResult.created) {
    throw new Error("Recurring Mollie payment is already claimed or requires reconciliation.")
  }
  if (attempt.state === "created") {
    attempt = await updateAttempt(payload, attempt, {
      state: "pending_provider",
      reconciliationRequired: true,
      stateHistory: stateHistory(attempt.stateHistory, "pending_provider", now),
    })
  }
  try {
    const payment = await createMolliePayment({
      amount: mollieAmount(attempt.grossAmountMinor, attempt.currency),
      customerId: agreement.providerCustomerId,
      mandateId: agreement.providerMandateId,
      sequenceType: "recurring",
      description: `Site in a Box ${purpose} ${order.orderNumber}`,
      webhookUrl: `${publicCmsOrigin()}/api/payments/mollie/webhook`,
      idempotencyKey: attempt.idempotencyKey,
      metadata: {
        paymentAttemptId: attempt.id,
        billingAgreementId: agreement.id,
        tenantId: relationshipId(order.tenant),
        idempotencyKey: attempt.idempotencyKey,
        mollieCustomerId: agreement.providerCustomerId,
        mandateId: agreement.providerMandateId,
        sequenceType: "recurring",
        purpose: attempt.purpose,
        orderId: order.id,
      },
    })
    if (!payment.id) throw new Error("Mollie did not return a recurring payment id.")
    attempt = await updateAttempt(payload, attempt, {
      state: "pending_provider",
      providerPaymentId: payment.id,
      providerStatus: payment.status,
      reconciliationRequired: false,
      lastSyncedAt: now,
      stateHistory: stateHistory(attempt.stateHistory, "pending_provider", now, payment.status),
    })
    await payload.update({
      collection: "orders",
      id: order.id,
      data: { paymentStatus: "open", providerPaymentId: payment.id },
      depth: 0,
      overrideAccess: true,
      context: { legalOrderLifecycleMutation: true },
    })
    return { paymentAttempt: attempt, reused: false }
  } catch (error) {
    await markProviderWriteIndeterminate(payload, attempt, error)
    throw error
  }
}

const paymentStateFromMollie = (status: string): PaymentAttemptState => {
  if (status === "paid") return "paid"
  if (status === "authorized") return "authorized"
  if (status === "canceled") return "cancelled"
  if (status === "expired") return "expired"
  if (status === "failed") return "failed"
  return "pending_provider"
}

const generationProjectionStatus = (state: PaymentAttemptState): GenerationRunPaymentStatus => {
  if (["paid", "refund_pending", "partially_refunded", "refunded", "refund_failed", "chargeback"].includes(state)) {
    return "completed"
  }
  if (state === "cancelled") return "canceled"
  if (state === "expired") return "expired"
  if (state === "failed") return "failed"
  return "pending_provider"
}

const confirmedRefunds = (payment: MolliePayment): MollieRefund[] =>
  (payment._embedded?.refunds ?? []).filter((refund) => refund.status === "refunded")

const pendingRefunds = (payment: MolliePayment): MollieRefund[] =>
  (payment._embedded?.refunds ?? []).filter((refund) =>
    ["queued", "pending", "processing"].includes(refund.status),
  )

const failedRefunds = (payment: MolliePayment): MollieRefund[] =>
  (payment._embedded?.refunds ?? []).filter((refund) =>
    ["failed", "canceled"].includes(refund.status),
  )

const totalMinor = (
  entries: Array<MollieRefund | MollieChargeback>,
  expectedCurrency: string,
): number =>
  entries.reduce((total, entry) => {
    const amount = minorAmount(entry.amount)
    if (amount == null || entry.amount.currency !== expectedCurrency) {
      throw new Error("Mollie adjustment amount does not match the payment currency.")
    }
    return total + amount
  }, 0)

const targetAttemptState = (
  attempt: PaymentAttempt,
  payment: MolliePayment,
): {
  state: PaymentAttemptState
  refundedAmountMinor: number
  chargebackAmountMinor: number
  reconciliationRequired: boolean
} => {
  const refunds = confirmedRefunds(payment)
  const refundsPending = pendingRefunds(payment)
  const refundsFailed = failedRefunds(payment)
  const chargebacks = payment._embedded?.chargebacks ?? []
  const refundedAmountMinor = totalMinor(refunds, attempt.currency)
  const chargebackAmountMinor = totalMinor(chargebacks, attempt.currency)
  const amountInvalid =
    refundedAmountMinor > attempt.grossAmountMinor ||
    chargebackAmountMinor > attempt.grossAmountMinor
  if (chargebackAmountMinor > 0) {
    return {
      state: "chargeback",
      refundedAmountMinor,
      chargebackAmountMinor,
      reconciliationRequired: amountInvalid,
    }
  }
  if (refundsPending.length > 0) {
    return {
      state: "refund_pending",
      refundedAmountMinor,
      chargebackAmountMinor,
      reconciliationRequired: amountInvalid,
    }
  }
  if (refundedAmountMinor >= attempt.grossAmountMinor && attempt.grossAmountMinor > 0) {
    return {
      state: "refunded",
      refundedAmountMinor: Math.min(refundedAmountMinor, attempt.grossAmountMinor),
      chargebackAmountMinor,
      reconciliationRequired: amountInvalid,
    }
  }
  if (refundedAmountMinor > 0) {
    return {
      state: "partially_refunded",
      refundedAmountMinor,
      chargebackAmountMinor,
      reconciliationRequired: amountInvalid,
    }
  }
  if (
    refundsFailed.length > 0 &&
    (attempt.state === "refund_pending" || attempt.state === "refund_failed")
  ) {
    return {
      state: "refund_failed",
      refundedAmountMinor,
      chargebackAmountMinor,
      reconciliationRequired: false,
    }
  }
  if ([
    "refund_pending",
    "partially_refunded",
    "refunded",
    "refund_failed",
    "chargeback",
  ].includes(attempt.state)) {
    return {
      state: attempt.state,
      refundedAmountMinor: attempt.refundedAmountMinor ?? refundedAmountMinor,
      chargebackAmountMinor: attempt.chargebackAmountMinor ?? chargebackAmountMinor,
      reconciliationRequired: true,
    }
  }
  const providerState = paymentStateFromMollie(payment.status)
  const capturedStates: PaymentAttemptState[] = [
    "paid",
    "refund_pending",
    "partially_refunded",
    "refunded",
    "refund_failed",
    "chargeback",
  ]
  if (capturedStates.includes(attempt.state) && providerState !== "paid") {
    return {
      state: attempt.state,
      refundedAmountMinor,
      chargebackAmountMinor,
      reconciliationRequired: true,
    }
  }
  return {
    state: providerState,
    refundedAmountMinor,
    chargebackAmountMinor,
    reconciliationRequired: false,
  }
}

const transitionAttemptState = async (
  payload: Payload,
  attempt: PaymentAttempt,
  target: PaymentAttemptState,
  now: string,
  providerStatus: string,
): Promise<PaymentAttempt> => {
  let current = attempt
  if (
    ["refund_pending", "partially_refunded", "refunded", "refund_failed", "chargeback"].includes(target) &&
    !["paid", "refund_pending", "partially_refunded", "refunded", "refund_failed", "chargeback"].includes(current.state)
  ) {
    current = await updateAttempt(payload, current, {
      state: "paid",
      paidAt: current.paidAt ?? now,
      stateHistory: stateHistory(current.stateHistory, "paid", now, providerStatus),
    })
  }
  if (
    ["partially_refunded", "refunded", "refund_failed"].includes(target) &&
    current.state === "paid"
  ) {
    current = await updateAttempt(payload, current, {
      state: "refund_pending",
      refundPendingAt: current.refundPendingAt ?? now,
      stateHistory: stateHistory(current.stateHistory, "refund_pending", now, providerStatus),
    })
  }
  if (current.state === target) return current
  return updateAttempt(payload, current, {
    state: target,
    stateHistory: stateHistory(current.stateHistory, target, now, providerStatus),
  })
}

const findOrBackfillAttempt = async (
  payload: Payload,
  payment: MolliePayment,
): Promise<PaymentAttempt> => {
  const byProviderId = await findOneDoc(payload, "payment-attempts", {
    providerPaymentId: { equals: payment.id },
  })
  if (byProviderId) return byProviderId
  const metadataAttemptId = payment.metadata?.paymentAttemptId
  if (typeof metadataAttemptId === "string" || typeof metadataAttemptId === "number") {
    const attempt = await payload.findByID({
      collection: "payment-attempts",
      id: metadataAttemptId,
      depth: 0,
      overrideAccess: true,
    }) as PaymentAttempt
    if (attempt.providerPaymentId && attempt.providerPaymentId !== payment.id) {
      throw new IgnorableMollieWebhookError("Mollie payment metadata references another provider payment.")
    }
    if (!attempt.providerPaymentId) {
      return updateAttempt(payload, attempt, {
        providerPaymentId: payment.id,
        providerStatus: payment.status,
        reconciliationRequired: false,
        lastSyncedAt: new Date().toISOString(),
      })
    }
    return attempt
  }
  const orderId = payment.metadata?.orderId
  if (typeof orderId !== "string" && typeof orderId !== "number") {
    throw new IgnorableMollieWebhookError("Mollie payment is not linked to a payment attempt or order.")
  }
  const order = await payload.findByID({
    collection: "orders",
    id: orderId,
    depth: 0,
    overrideAccess: true,
  }) as Order
  const now = new Date().toISOString()
  return createOrLoadAttempt(payload, {
    order,
    purpose: payment.sequenceType === "recurring" ? "recurring" : "first_payment",
    sequenceType: payment.sequenceType === "recurring" ? "recurring" : "first",
    idempotencyKey: `mollie:legacy-payment:${payment.id}`,
    now,
  }).then(({ attempt }) =>
    updateAttempt(payload, attempt, {
      state: "pending_provider",
      providerPaymentId: payment.id,
      providerStatus: payment.status,
      lastSyncedAt: now,
      stateHistory: stateHistory(attempt.stateHistory, "pending_provider", now, payment.status),
    }),
  )
}

const rejectProviderAuthorityMismatch = async (
  payload: Payload,
  attempt: PaymentAttempt,
  message: string,
): Promise<never> => {
  await updateAttempt(payload, attempt, {
    reconciliationRequired: true,
    lastSyncedAt: new Date().toISOString(),
    failureCode: "provider_authority_mismatch",
    failureMessage: message,
  })
  throw new Error(message)
}

const assertProviderPaymentAuthority = async (
  payload: Payload,
  attempt: PaymentAttempt,
  payment: MolliePayment,
): Promise<void> => {
  const strictAuthority = attempt.idempotencyKey.includes(":authority-v2")
  if (!sameRelationshipId(attempt.order, payment.metadata?.orderId as string | number | undefined)) {
    await rejectProviderAuthorityMismatch(
      payload,
      attempt,
      "Mollie order metadata does not match the payment attempt.",
    )
  }
  if (
    attempt.sequenceType &&
    payment.sequenceType !== attempt.sequenceType &&
    (strictAuthority || payment.sequenceType != null)
  ) {
    await rejectProviderAuthorityMismatch(
      payload,
      attempt,
      "Mollie payment sequence does not match the payment attempt.",
    )
  }
  if (
    (strictAuthority || typeof payment.metadata?.paymentAttemptId !== "undefined") &&
    !sameRelationshipId(attempt.id, payment.metadata?.paymentAttemptId as string | number | undefined)
  ) {
    await rejectProviderAuthorityMismatch(
      payload,
      attempt,
      "Mollie payment-attempt metadata does not match the payment attempt.",
    )
  }
  if (
    (strictAuthority || typeof payment.metadata?.idempotencyKey !== "undefined") &&
    payment.metadata?.idempotencyKey !== attempt.idempotencyKey
  ) {
    await rejectProviderAuthorityMismatch(
      payload,
      attempt,
      "Mollie idempotency metadata does not match the payment attempt.",
    )
  }
  if (
    (strictAuthority || typeof payment.metadata?.purpose !== "undefined") &&
    payment.metadata?.purpose !== attempt.purpose
  ) {
    await rejectProviderAuthorityMismatch(
      payload,
      attempt,
      "Mollie payment purpose does not match the payment attempt.",
    )
  }
  const agreementId = relationshipId(attempt.billingAgreement)
  if (!agreementId) return
  if (
    (strictAuthority || typeof payment.metadata?.billingAgreementId !== "undefined") &&
    !sameRelationshipId(
      agreementId,
      payment.metadata?.billingAgreementId as string | number | undefined,
    )
  ) {
    await rejectProviderAuthorityMismatch(
      payload,
      attempt,
      "Mollie billing-agreement metadata does not match the payment attempt.",
    )
  }
  const agreement = await payload.findByID({
    collection: "billing-agreements",
    id: agreementId,
    depth: 0,
    overrideAccess: true,
  }) as BillingAgreement
  if (
    agreement.providerCustomerId &&
    payment.customerId !== agreement.providerCustomerId &&
    (strictAuthority || payment.customerId != null)
  ) {
    await rejectProviderAuthorityMismatch(
      payload,
      attempt,
      "Mollie payment customer does not match the billing agreement.",
    )
  }
  if (
    attempt.sequenceType === "recurring" &&
    agreement.providerMandateId &&
    (
      payment.mandateId !== agreement.providerMandateId ||
      (
        strictAuthority &&
        payment.metadata?.mandateId !== agreement.providerMandateId
      )
    )
  ) {
    await rejectProviderAuthorityMismatch(
      payload,
      attempt,
      "Mollie payment mandate does not match the billing agreement.",
    )
  }
}

const synchronizeBillingAgreement = async (
  payload: Payload,
  attempt: PaymentAttempt,
  order: Order,
  payment: MolliePayment,
  now: string,
): Promise<void> => {
  const agreementId = relationshipId(attempt.billingAgreement)
  if (!agreementId) return
  const agreement = await payload.findByID({
    collection: "billing-agreements",
    id: agreementId,
    depth: 0,
    overrideAccess: true,
  }) as BillingAgreement
  if (payment.customerId && agreement.providerCustomerId && payment.customerId !== agreement.providerCustomerId) {
    await updateAgreement(payload, agreement, {
      reconciliationRequired: true,
      failureReason: "Mollie payment customer does not match the billing agreement.",
      lastSyncedAt: now,
    })
    return
  }
  if ([
    "paid",
    "refund_pending",
    "partially_refunded",
    "refunded",
    "refund_failed",
  ].includes(attempt.state)) {
    const mandateId = payment.mandateId ?? agreement.providerMandateId
    if (attempt.sequenceType === "first" && !mandateId) {
      await updateAgreement(payload, agreement, {
        state: agreement.state === "pending_first_payment" ? "mandate_pending" : agreement.state,
        reconciliationRequired: true,
        failureReason: "Paid first Mollie payment has no mandate reference yet.",
        lastSyncedAt: now,
      })
      return
    }
    const paidAt = payment.paidAt ?? attempt.paidAt ?? now
    const periodStartsAt = attempt.sequenceType === "first"
      ? paidAt
      : order.servicePeriodStartsAt
    const periodEndsAt = attempt.sequenceType === "first"
      ? addBillingPeriod(paidAt, agreement.billingPeriod)
      : order.servicePeriodEndsAt
    if (!periodStartsAt || !periodEndsAt) {
      await updateAgreement(payload, agreement, {
        reconciliationRequired: true,
        failureReason: "Paid recurring order is missing frozen service coverage.",
        lastSyncedAt: now,
        adminExceptionCode: "missing_service_coverage",
        adminExceptionAt: now,
      })
      return
    }
    const wasBillingSuspended = agreement.serviceSuspensionStatus === "billing_suspended"
    const state = agreement.state === "cancellation_scheduled"
      ? "cancellation_scheduled"
      : "active"
    await updateAgreement(payload, agreement, {
      state,
      providerCustomerId: payment.customerId ?? agreement.providerCustomerId,
      providerMandateId: mandateId,
      currentPeriodStartsAt: periodStartsAt,
      currentPeriodEndsAt: periodEndsAt,
      nextChargeAt: periodEndsAt,
      graceStartedAt: null,
      graceEndsAt: null,
      serviceSuspensionStatus: "none",
      restoredAt: wasBillingSuspended ? now : agreement.restoredAt,
      reconciliationRequired: false,
      failureReason: null,
      adminExceptionCode: null,
      adminExceptionAt: null,
      lastSyncedAt: now,
      stateHistory: agreement.state === state
        ? agreement.stateHistory
        : agreementHistory(agreement.stateHistory, state, now),
    })
    if (wasBillingSuspended) {
      const tenantId = relationshipId(agreement.tenant)
      if (tenantId) {
        const tenant = await payload.findByID({
          collection: "tenants",
          id: tenantId,
          depth: 0,
          overrideAccess: true,
        }) as Tenant
        if (
          tenant.status === "suspended" &&
          sameRelationshipId(tenant.billingSuspensionAgreement, agreement.id)
        ) {
          await payload.update({
            collection: "tenants",
            id: tenant.id,
            data: {
              status: "active",
              billingSuspensionAgreement: null,
              billingSuspendedAt: null,
            },
            depth: 0,
            overrideAccess: true,
            context: { billingTenantLifecycleMutation: true },
          })
          await ensureCommerceNotification({
            payload,
            kind: "service_restored",
            tenantId: tenant.id,
            recipient: order.customerEmail,
            eventAt: now,
            billingAgreementId: agreement.id,
          })
        } else if (tenant.status === "suspended") {
          await updateAgreement(payload, agreement, {
            serviceSuspensionStatus: "restoration_blocked",
            adminExceptionCode: "tenant_suspension_not_owned_by_billing",
            adminExceptionAt: now,
          })
        }
      }
    }
    return
  }
  if (
    ["failed", "cancelled", "expired", "chargeback"].includes(attempt.state) &&
    ["mandate_pending", "active", "past_due"].includes(agreement.state)
  ) {
    const state = "past_due"
    await updateAgreement(payload, agreement, {
      state,
      reconciliationRequired: attempt.state === "chargeback",
      failureReason: `Mollie payment state is ${attempt.state}.`,
      lastSyncedAt: now,
      stateHistory: agreement.state === state
        ? agreement.stateHistory
        : agreementHistory(agreement.stateHistory, state, now, attempt.state),
    })
  }
}

const synchronizeOrderProjection = async (
  payload: Payload,
  order: Order,
  attempt: PaymentAttempt,
  now: string,
): Promise<{ order: Order; fulfillmentClaimed: boolean }> => {
  const captured = [
    "paid",
    "refund_pending",
    "partially_refunded",
    "refunded",
    "refund_failed",
    "chargeback",
  ].includes(attempt.state)
  const paymentStatus: Order["paymentStatus"] = attempt.state === "cancelled"
    ? "cancelled"
    : attempt.state === "partially_refunded"
      ? "partially_refunded"
      : attempt.state === "refunded"
        ? "refunded"
        : attempt.state === "chargeback"
          ? "chargeback"
          : attempt.state === "expired"
            ? "expired"
            : attempt.state === "failed"
              ? "failed"
              : captured
                ? "paid"
                : "open"
  const nextState = captured && order.state === "accepted"
    ? "fulfillment_pending"
    : order.state
  const fulfillmentClaimed = attempt.purpose === "first_payment" &&
    order.state === "accepted" &&
    nextState === "fulfillment_pending"
  const updatedOrder = await payload.update({
    collection: "orders",
    id: order.id,
    data: {
      state: nextState,
      paymentStatus,
      providerPaymentId: attempt.providerPaymentId,
      paidAt: captured ? (attempt.paidAt ?? now) : undefined,
      cancelledAt: attempt.state === "cancelled" ? (attempt.cancelledAt ?? now) : undefined,
    },
    depth: 0,
    overrideAccess: true,
    context: { legalOrderLifecycleMutation: true },
  }) as Order
  return {
    order: updatedOrder,
    fulfillmentClaimed,
  }
}

const synchronizeGenerationRunProjection = async (
  payload: Payload,
  order: Order,
  attempt: PaymentAttempt,
  payment: MolliePayment,
  now: string,
): Promise<void> => {
  const runId = relationshipId(order.generationRun)
  if (!runId) return
  const run = await payload.findByID({
    collection: "site-generation-runs",
    id: runId,
    depth: 0,
    overrideAccess: true,
  }) as SiteGenerationRun
  if (!sameRelationshipId(run.tenant, order.tenant)) {
    throw new IgnorableMollieWebhookError("Mollie order and generation run tenant do not match.")
  }
  const current = normalizeGenerationRunPaymentState(run.payment)
  if (current.externalReference && current.externalReference !== payment.id) {
    throw new IgnorableMollieWebhookError("Mollie payment id does not match the generation run projection.")
  }
  const status = generationProjectionStatus(attempt.state)
  await payload.update({
    collection: "site-generation-runs",
    id: run.id,
    data: {
      payment: molliePaymentProjection({
        current,
        status,
        providerStatus: payment.status,
        externalReference: payment.id,
        checkoutUrl: attempt.checkoutUrl,
        customerEmail: typeof payment.metadata?.customerEmail === "string"
          ? normalizeEmail(payment.metadata.customerEmail)
          : current.customerEmail,
        clientSlug: typeof payment.metadata?.clientSlug === "string"
          ? payment.metadata.clientSlug
          : current.clientSlug,
        selectedDomain: typeof payment.metadata?.selectedDomain === "string"
          ? cleanDomain(payment.metadata.selectedDomain)
          : current.selectedDomain,
        amount: payment.amount?.value ?? current.amount,
        currency: payment.amount?.currency ?? current.currency,
        note: status === "completed"
          ? "Mollie payment synchronized; fulfillment is queued separately."
          : `Mollie payment status: ${payment.status}.`,
        mollieCustomerId: payment.customerId ??
          (typeof payment.metadata?.mollieCustomerId === "string"
            ? payment.metadata.mollieCustomerId
            : current.mollieCustomerId),
        mollieSequenceType: payment.sequenceType ??
          (typeof payment.metadata?.sequenceType === "string"
            ? payment.metadata.sequenceType
            : current.mollieSequenceType),
        now,
      }),
    },
    depth: 0,
    overrideAccess: true,
  })
}

const synchronizeAccountingEvidence = async (
  payload: Payload,
  order: Order,
  attempt: PaymentAttempt,
  payment: MolliePayment,
  now: string,
): Promise<void> => {
  if (![
    "paid",
    "refund_pending",
    "partially_refunded",
    "refunded",
    "refund_failed",
    "chargeback",
  ].includes(attempt.state)) return
  const invoice = await ensureInvoiceEvidence({
    payload,
    order,
    paymentAttempt: attempt,
    issuedAt: payment.paidAt ?? attempt.paidAt ?? now,
  })
  for (const refund of confirmedRefunds(payment)) {
    const grossAmountMinor = minorAmount(refund.amount)
    if (grossAmountMinor == null) continue
    const pendingDocumentId = refund.metadata?.accountingDocumentId
    if (typeof pendingDocumentId === "string" || typeof pendingDocumentId === "number") {
      const pendingDocument = await payload.findByID({
        collection: "accounting-documents",
        id: pendingDocumentId,
        depth: 0,
        overrideAccess: true,
      }) as AccountingDocument
      if (
        pendingDocument.documentType !== "credit_note" ||
        pendingDocument.reason !== "refund" ||
        !sameRelationshipId(pendingDocument.order, order.id) ||
        !sameRelationshipId(pendingDocument.paymentAttempt, attempt.id)
      ) {
        await rejectProviderAuthorityMismatch(
          payload,
          attempt,
          "Mollie refund metadata does not match the pending accounting evidence.",
        )
      }
      await issueCreditNote({
        payload,
        document: pendingDocument,
        providerOperationId: refund.id,
        providerStatus: refund.status,
        issuedAt: refund.createdAt ?? now,
      })
      continue
    }
    await ensureRefundCreditNote({
      payload,
      order,
      paymentAttempt: attempt,
      invoice,
      providerRefundId: refund.id,
      providerStatus: refund.status,
      grossAmountMinor,
      issuedAt: refund.createdAt ?? now,
    })
  }
  for (const refund of failedRefunds(payment)) {
    const pendingDocumentId = refund.metadata?.accountingDocumentId
    if (typeof pendingDocumentId !== "string" && typeof pendingDocumentId !== "number") continue
    const pendingDocument = await payload.findByID({
      collection: "accounting-documents",
      id: pendingDocumentId,
      depth: 0,
      overrideAccess: true,
    }) as AccountingDocument
    if (
      pendingDocument.documentType !== "credit_note" ||
      pendingDocument.reason !== "refund" ||
      !sameRelationshipId(pendingDocument.order, order.id) ||
      !sameRelationshipId(pendingDocument.paymentAttempt, attempt.id)
    ) {
      await rejectProviderAuthorityMismatch(
        payload,
        attempt,
        "Failed Mollie refund metadata does not match the pending accounting evidence.",
      )
    }
    if (pendingDocument.state === "failed" && pendingDocument.providerOperationId === refund.id) {
      continue
    }
    await payload.update({
      collection: "accounting-documents",
      id: pendingDocument.id,
      data: {
        state: "failed",
        providerOperationId: refund.id,
        providerStatus: refund.status,
        reconciliationRequired: false,
        failedAt: now,
        failureMessage: `Mollie refund ${refund.status}.`,
        lastSyncedAt: now,
        stateHistory: [
          ...(Array.isArray(pendingDocument.stateHistory) ? pendingDocument.stateHistory : []),
          { state: "failed", at: now, providerStatus: refund.status },
        ],
      },
      depth: 0,
      overrideAccess: true,
      context: { accountingDocumentLifecycleMutation: true },
    })
  }
  for (const chargeback of payment._embedded?.chargebacks ?? []) {
    const grossAmountMinor = minorAmount(chargeback.amount)
    if (grossAmountMinor == null) continue
    await ensureChargebackCreditNote({
      payload,
      order,
      paymentAttempt: attempt,
      invoice,
      providerChargebackId: chargeback.id,
      grossAmountMinor,
      issuedAt: chargeback.createdAt ?? now,
    })
  }
}

export async function synchronizeMolliePayment(
  payload: Payload,
  paymentId: string,
  fetchPayment: (id: string) => Promise<MolliePayment> = retrieveMolliePayment,
): Promise<MollieSynchronizationResult> {
  const payment = await fetchPayment(paymentId)
  if (payment.id !== paymentId) {
    throw new IgnorableMollieWebhookError("Mollie returned another payment id.")
  }
  let attempt = await findOrBackfillAttempt(payload, payment)
  if (attempt.providerPaymentId !== payment.id) {
    throw new IgnorableMollieWebhookError("Payment attempt provider reference does not match Mollie.")
  }
  await assertProviderPaymentAuthority(payload, attempt, payment)
  const providerAmountMinor = minorAmount(payment.amount)
  if (
    providerAmountMinor == null ||
    providerAmountMinor !== attempt.grossAmountMinor ||
    payment.amount?.currency !== attempt.currency
  ) {
    await updateAttempt(payload, attempt, {
      reconciliationRequired: true,
      lastSyncedAt: new Date().toISOString(),
      failureCode: "provider_amount_mismatch",
      failureMessage: "Mollie amount or currency differs from the frozen payment attempt.",
    })
    throw new Error("Mollie payment amount does not match the frozen payment attempt.")
  }

  const now = new Date().toISOString()
  const target = targetAttemptState(attempt, payment)
  const duplicate =
    attempt.state === target.state &&
    attempt.providerStatus === payment.status &&
    (attempt.refundedAmountMinor ?? 0) === target.refundedAmountMinor &&
    (attempt.chargebackAmountMinor ?? 0) === target.chargebackAmountMinor
  attempt = await transitionAttemptState(payload, attempt, target.state, now, payment.status)
  attempt = await updateAttempt(payload, attempt, {
    providerStatus: payment.status,
    reconciliationRequired: target.reconciliationRequired,
    lastSyncedAt: now,
    authorizedAt: payment.authorizedAt ?? attempt.authorizedAt,
    paidAt: payment.paidAt ?? (target.state === "paid" ? attempt.paidAt ?? now : attempt.paidAt),
    failedAt: payment.failedAt ?? (target.state === "failed" ? attempt.failedAt ?? now : attempt.failedAt),
    cancelledAt: payment.canceledAt ??
      (target.state === "cancelled" ? attempt.cancelledAt ?? now : attempt.cancelledAt),
    expiredAt: payment.expiredAt ??
      (target.state === "expired" ? attempt.expiredAt ?? now : attempt.expiredAt),
    refundPendingAt: pendingRefunds(payment).length > 0
      ? attempt.refundPendingAt ?? now
      : attempt.refundPendingAt,
    refundedAmountMinor: target.refundedAmountMinor,
    refundedAt: target.state === "refunded" ? attempt.refundedAt ?? now : attempt.refundedAt,
    providerRefundIds: (payment._embedded?.refunds ?? []).map((refund) => refund.id),
    chargebackAmountMinor: target.chargebackAmountMinor,
    chargebackAt: target.state === "chargeback" ? attempt.chargebackAt ?? now : attempt.chargebackAt,
    providerChargebackIds: (payment._embedded?.chargebacks ?? []).map((chargeback) => chargeback.id),
    failureCode: target.reconciliationRequired ? "provider_state_conflict" : null,
    failureMessage: target.reconciliationRequired
      ? "Provider state or adjustment totals conflict with captured local evidence."
      : null,
  })
  const order = await payload.findByID({
    collection: "orders",
    id: relationshipId(attempt.order) ?? "",
    depth: 0,
    overrideAccess: true,
  }) as Order
  await synchronizeBillingAgreement(payload, attempt, order, payment, now)
  const orderProjection = await synchronizeOrderProjection(payload, order, attempt, now)
  let updatedOrder = orderProjection.order
  if (
    ["recurring", "domain_renewal"].includes(attempt.purpose) &&
    ["paid", "refund_pending", "partially_refunded"].includes(attempt.state)
  ) {
    const cycles = await payload.find({
      collection: "domain-renewal-cycles",
      where: { order: { equals: order.id } },
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })
    for (const cycle of cycles.docs) {
      if (!["payment_required", "payment_committed"].includes(cycle.state)) continue
      await payload.update({
        collection: "domain-renewal-cycles",
        id: cycle.id,
        data: {
          state: "payment_committed",
          paymentAttempt: attempt.id,
          paymentSecuredAt: attempt.paidAt ?? now,
          financialCoverageState: "payment_secured",
          reconciliationRequired: false,
          lastSyncedAt: now,
          stateHistory: [
            ...(Array.isArray(cycle.stateHistory) ? cycle.stateHistory : []),
            { state: "payment_committed", at: now, reason: "mollie_payment_secured" },
          ],
        },
        depth: 0,
        overrideAccess: true,
        context: { domainRenewalCycleLifecycleMutation: true },
      })
    }
    if (updatedOrder.state === "fulfillment_pending") {
      updatedOrder = await payload.update({
        collection: "orders",
        id: updatedOrder.id,
        data: { state: "fulfilled" },
        depth: 0,
        overrideAccess: true,
        context: { legalOrderLifecycleMutation: true },
      }) as Order
    }
  }
  if (
    attempt.purpose === "supplemental" &&
    attempt.state === "paid"
  ) {
    const { authorizeMigrationOperatorWorkFromPayment } = await import(
      "@/lib/domains/assistedMigration"
    )
    await authorizeMigrationOperatorWorkFromPayment(
      payload,
      updatedOrder,
      attempt,
      now,
    )
  }
  if (attempt.purpose !== "supplemental") {
    await synchronizeGenerationRunProjection(payload, updatedOrder, attempt, payment, now)
  }
  await synchronizeAccountingEvidence(payload, updatedOrder, attempt, payment, now)
  const fulfillmentRequired =
    orderProjection.fulfillmentClaimed &&
    ["paid", "refund_pending", "partially_refunded"].includes(attempt.state) &&
    updatedOrder.state === "fulfillment_pending"
  return {
    ok: true,
    paymentAttemptId: attempt.id,
    orderId: updatedOrder.id,
    state: attempt.state,
    duplicate,
    fulfillmentRequired,
  }
}

export const applyMollieWebhookPayment = synchronizeMolliePayment

const refundGrossAmount = (
  order: Order,
  attempt: PaymentAttempt,
  scenario: RefundScenario,
): number => {
  if (scenario === "duplicate_payment" || scenario === "unfulfillable_before_provider_commit") {
    return attempt.grossAmountMinor
  }
  if (scenario === "incident_recovery_migration_fee_charged") {
    const items = Array.isArray(order.netLineItems) ? order.netLineItems : []
    const migrationNetMinor = items.reduce<number>((total, item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return total
      const record = item as Record<string, unknown>
      const code = typeof record.code === "string" ? record.code : ""
      const amount = typeof record.netAmountMinor === "number" ? record.netAmountMinor : 0
      return code.includes("migration") && Number.isSafeInteger(amount) ? total + amount : total
    }, 0)
    if (migrationNetMinor <= 0) {
      throw new Error("The frozen order has no refundable migration service line item.")
    }
    const vat = Math.round((migrationNetMinor * 2_100) / 10_000)
    return migrationNetMinor + vat
  }
  throw new Error("This refund scenario requires manual review or no provider refund.")
}

export async function requestMollieRefund(
  payload: Payload,
  input: {
    paymentAttemptId: string | number
    scenario: RefundScenario
  },
): Promise<{ document: AccountingDocument; providerRefundId: string; reused: boolean }> {
  const decision = refundDecisionFor(input.scenario)
  if (!decision.automatic || decision.nextAction !== "issue_refund") {
    throw new Error("The refund decision matrix requires manual review or no refund.")
  }
  let attempt = await payload.findByID({
    collection: "payment-attempts",
    id: input.paymentAttemptId,
    depth: 0,
    overrideAccess: true,
  }) as PaymentAttempt
  if (!attempt.providerPaymentId || ![
    "paid",
    "partially_refunded",
    "refund_failed",
    "refund_pending",
  ].includes(attempt.state)) {
    throw new Error("Mollie refund requires a captured payment attempt.")
  }
  const providerPaymentId = attempt.providerPaymentId
  const order = await payload.findByID({
    collection: "orders",
    id: relationshipId(attempt.order) ?? "",
    depth: 0,
    overrideAccess: true,
  }) as Order
  const now = new Date().toISOString()
  const invoice = await ensureInvoiceEvidence({
    payload,
    order,
    paymentAttempt: attempt,
    issuedAt: attempt.paidAt ?? now,
  })
  let document = await ensurePendingCreditNote({
    payload,
    order,
    paymentAttempt: attempt,
    invoice,
    scenario: input.scenario,
    grossAmountMinor: refundGrossAmount(order, attempt, input.scenario),
    now,
  })
  if (document.providerOperationId) {
    return {
      document,
      providerRefundId: document.providerOperationId,
      reused: true,
    }
  }
  if (document.state === "failed") {
    throw new Error("Mollie rejected this refund request; a new provider write is not allowed.")
  }
  if (document.reconciliationRequired) {
    throw new Error("Mollie refund creation requires reconciliation before retry.")
  }
  requireCommerceProviderWritesAllowed("Mollie refund creation")
  if (attempt.state !== "refund_pending") {
    attempt = await updateAttempt(payload, attempt, {
      state: "refund_pending",
      refundPendingAt: now,
      stateHistory: stateHistory(attempt.stateHistory, "refund_pending", now),
    })
  }
  const refundIdempotencyKey = `mollie:refund:${attempt.id}:${input.scenario}:v1`
  try {
    const refund = await createMollieRefund({
      paymentId: providerPaymentId,
      amount: mollieAmount(document.grossAmountMinor, document.currency),
      description: `Site in a Box ${input.scenario}`,
      idempotencyKey: refundIdempotencyKey,
      metadata: {
        accountingDocumentId: document.id,
        paymentAttemptId: attempt.id,
        orderId: order.id,
        refundScenario: input.scenario,
      },
    })
    document = await payload.update({
      collection: "accounting-documents",
      id: document.id,
      data: {
        providerOperationId: refund.id,
        providerStatus: refund.status,
        reconciliationRequired: false,
        lastSyncedAt: now,
      },
      depth: 0,
      overrideAccess: true,
      context: { accountingDocumentLifecycleMutation: true },
    }) as AccountingDocument
    await updateAttempt(payload, attempt, {
      providerRefundIds: [
        ...(Array.isArray(attempt.providerRefundIds) ? attempt.providerRefundIds : []),
        refund.id,
      ],
      reconciliationRequired: false,
      lastSyncedAt: now,
    })
    return { document, providerRefundId: refund.id, reused: false }
  } catch (error) {
    const safeRetry = error instanceof MollieApiError && error.status === 503
    const knownRejected = error instanceof MollieApiError &&
      error.status >= 400 &&
      error.status < 500 &&
      error.status !== 409
    document = await payload.update({
      collection: "accounting-documents",
      id: document.id,
      data: {
        state: knownRejected ? "failed" : "pending_provider",
        reconciliationRequired: !knownRejected && !safeRetry,
        failedAt: knownRejected ? now : undefined,
        failureMessage: error instanceof Error ? error.message : "Mollie refund creation failed.",
        lastSyncedAt: now,
        stateHistory: knownRejected
          ? [
              ...(Array.isArray(document.stateHistory) ? document.stateHistory : []),
              { state: "failed", at: now },
            ]
          : document.stateHistory,
      },
      depth: 0,
      overrideAccess: true,
      context: { accountingDocumentLifecycleMutation: true },
    }) as AccountingDocument
    await updateAttempt(payload, attempt, {
      state: knownRejected ? "refund_failed" : "refund_pending",
      reconciliationRequired: !knownRejected && !safeRetry,
      failureCode: knownRejected
        ? `mollie_http_${error.status}`
        : safeRetry ? "refund_write_safe_retry" : "refund_write_indeterminate",
      failureMessage: error instanceof Error ? error.message : "Mollie refund creation failed.",
      lastSyncedAt: now,
      stateHistory: stateHistory(
        attempt.stateHistory,
        knownRejected ? "refund_failed" : "refund_pending",
        now,
      ),
    })
    throw error
  }
}
