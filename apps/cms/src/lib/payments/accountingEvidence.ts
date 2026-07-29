import "server-only"

import type { Payload } from "payload"
import type {
  AccountingDocument,
  Order,
  PaymentAttempt,
} from "@/payload-types"
import type { RefundScenario } from "@siteinabox/contracts/commerce"

import { findOneDoc } from "@/lib/payloadCollection"
import { relationshipId } from "@/lib/relationshipId"

const numericRelationshipId = (value: Parameters<typeof relationshipId>[0]): number | undefined => {
  const id = relationshipId(value)
  if (id == null) return undefined
  const numeric = Number(id)
  if (!Number.isSafeInteger(numeric)) throw new Error("Expected a numeric Payload relationship id.")
  return numeric
}

const stateEntry = (
  state: AccountingDocument["state"],
  at: string,
  providerStatus?: string | null,
) => [{ state, at, ...(providerStatus ? { providerStatus } : {}) }]

const customerSnapshot = (order: Order) => ({
  customerName: order.customerName,
  customerEmail: order.customerEmail,
  companyName: order.companyName,
  billingAddress: order.billingAddress,
  contractingPartyProfileVersion: order.contractingPartyProfileVersion ?? null,
})

const orderAmounts = (order: Order) => {
  const netAmountMinor = order.subtotalNetMinor
  const vatAmountMinor = order.vatAmountMinor
  const grossAmountMinor = order.totalGrossMinor
  if (
    Number.isSafeInteger(netAmountMinor) &&
    Number.isSafeInteger(vatAmountMinor) &&
    Number.isSafeInteger(grossAmountMinor) &&
    netAmountMinor != null &&
    vatAmountMinor != null &&
    grossAmountMinor != null
  ) {
    return { netAmountMinor, vatAmountMinor, grossAmountMinor }
  }
  const net = Math.round(Number(order.subtotalNet) * 100)
  const vat = Math.round(Number(order.vatAmount) * 100)
  const gross = Math.round(Number(order.totalGross) * 100)
  if (![net, vat, gross].every((amount) => Number.isSafeInteger(amount) && amount >= 0)) {
    throw new Error("Order is missing valid frozen accounting amounts.")
  }
  return { netAmountMinor: net, vatAmountMinor: vat, grossAmountMinor: gross }
}

export const allocateCreditAmounts = (
  order: Order,
  grossAmountMinor: number,
): { netAmountMinor: number; vatAmountMinor: number; grossAmountMinor: number } => {
  const original = orderAmounts(order)
  if (
    !Number.isSafeInteger(grossAmountMinor) ||
    grossAmountMinor <= 0 ||
    grossAmountMinor > original.grossAmountMinor
  ) {
    throw new Error("Credit amount must be a positive minor amount within the captured payment.")
  }
  if (grossAmountMinor === original.grossAmountMinor) return original
  const vatAmountMinor = Math.round(
    (grossAmountMinor * original.vatAmountMinor) / original.grossAmountMinor,
  )
  return {
    netAmountMinor: grossAmountMinor - vatAmountMinor,
    vatAmountMinor,
    grossAmountMinor,
  }
}

const findAccountingDocument = (
  payload: Payload,
  evidenceKey: string,
): Promise<AccountingDocument | null> =>
  findOneDoc(payload, "accounting-documents", { evidenceKey: { equals: evidenceKey } })

const createOrReloadAccountingDocument = async (
  payload: Payload,
  evidenceKey: string,
  create: () => Promise<AccountingDocument>,
): Promise<AccountingDocument> => {
  try {
    return await create()
  } catch (error) {
    const raced = await findAccountingDocument(payload, evidenceKey)
    if (raced) return raced
    throw error
  }
}

export async function ensureInvoiceEvidence(input: {
  payload: Payload
  order: Order
  paymentAttempt: PaymentAttempt
  issuedAt: string
}): Promise<AccountingDocument> {
  const evidenceKey = `invoice:payment-attempt:${input.paymentAttempt.id}`
  const existing = await findAccountingDocument(input.payload, evidenceKey)
  if (existing) return existing
  const amounts = orderAmounts(input.order)
  return createOrReloadAccountingDocument(input.payload, evidenceKey, () =>
    input.payload.create({
    collection: "accounting-documents",
    data: {
      evidenceKey,
      documentNumber: `INV-${input.order.orderNumber}`,
      documentType: "invoice",
      state: "issued",
      order: input.order.id,
      paymentAttempt: input.paymentAttempt.id,
      tenant: numericRelationshipId(input.order.tenant),
      reason: "payment_collected",
      providerOperationId: input.paymentAttempt.providerPaymentId ?? undefined,
      providerStatus: input.paymentAttempt.providerStatus ?? "paid",
      currency: input.order.currency,
      ...amounts,
      lineItems: input.order.netLineItems ?? input.order.lineItems,
      customerSnapshot: customerSnapshot(input.order),
      issuedAt: input.issuedAt,
      reconciliationRequired: false,
      lastSyncedAt: input.issuedAt,
      stateHistory: stateEntry("issued", input.issuedAt, "paid"),
      createdAt: input.issuedAt,
    },
    depth: 0,
    overrideAccess: true,
    }) as Promise<AccountingDocument>,
  )
}

export async function ensurePendingCreditNote(input: {
  payload: Payload
  order: Order
  paymentAttempt: PaymentAttempt
  invoice: AccountingDocument
  scenario: RefundScenario
  grossAmountMinor: number
  now: string
}): Promise<AccountingDocument> {
  const evidenceKey = `credit-note:payment-attempt:${input.paymentAttempt.id}:${input.scenario}`
  const existing = await findAccountingDocument(input.payload, evidenceKey)
  if (existing) return existing
  const amounts = allocateCreditAmounts(input.order, input.grossAmountMinor)
  return createOrReloadAccountingDocument(input.payload, evidenceKey, () =>
    input.payload.create({
    collection: "accounting-documents",
    data: {
      evidenceKey,
      documentNumber: `CN-${input.order.orderNumber}-${input.scenario}`,
      documentType: "credit_note",
      state: "pending_provider",
      order: input.order.id,
      paymentAttempt: input.paymentAttempt.id,
      tenant: numericRelationshipId(input.order.tenant),
      reversesDocument: input.invoice.id,
      reason: "refund",
      refundScenario: input.scenario,
      currency: input.order.currency,
      ...amounts,
      lineItems: [{
        code: "payment-refund",
        description: input.scenario,
        quantity: 1,
        netAmountMinor: amounts.netAmountMinor,
      }],
      customerSnapshot: customerSnapshot(input.order),
      reconciliationRequired: false,
      stateHistory: stateEntry("pending_provider", input.now),
      createdAt: input.now,
    },
    depth: 0,
    overrideAccess: true,
    }) as Promise<AccountingDocument>,
  )
}

export async function ensurePendingPaymentAdjustment(input: {
  payload: Payload
  order: Order
  paymentAttempt: PaymentAttempt
  grossAmountMinor: number
  now: string
}): Promise<AccountingDocument> {
  if (
    !Number.isSafeInteger(input.grossAmountMinor) ||
    input.grossAmountMinor <= 0
  ) {
    throw new Error("Payment adjustment requires a positive captured amount.")
  }
  const evidenceKey =
    `payment-adjustment:payment-attempt:${input.paymentAttempt.id}:duplicate_payment`
  const existing = await findAccountingDocument(input.payload, evidenceKey)
  if (existing) return existing
  return createOrReloadAccountingDocument(input.payload, evidenceKey, () =>
    input.payload.create({
      collection: "accounting-documents",
      data: {
        evidenceKey,
        documentNumber: `PA-${input.order.orderNumber}-${input.paymentAttempt.id}`,
        documentType: "payment_adjustment",
        state: "pending_provider",
        order: input.order.id,
        paymentAttempt: input.paymentAttempt.id,
        tenant: numericRelationshipId(input.order.tenant),
        reason: "overpayment_refund",
        refundScenario: "duplicate_payment",
        currency: input.order.currency,
        netAmountMinor: 0,
        vatAmountMinor: 0,
        grossAmountMinor: input.grossAmountMinor,
        lineItems: [{
          code: "duplicate-payment-adjustment",
          description: "Duplicate payment captured for refund",
          quantity: 1,
          netAmountMinor: 0,
        }],
        customerSnapshot: customerSnapshot(input.order),
        reconciliationRequired: false,
        stateHistory: stateEntry("pending_provider", input.now),
        createdAt: input.now,
      },
      depth: 0,
      overrideAccess: true,
    }) as Promise<AccountingDocument>,
  )
}

export async function issueAccountingDocument(input: {
  payload: Payload
  document: AccountingDocument
  providerOperationId: string
  providerStatus: string
  issuedAt: string
}): Promise<AccountingDocument> {
  if (input.document.state === "issued") return input.document
  return input.payload.update({
    collection: "accounting-documents",
    id: input.document.id,
    data: {
      state: "issued",
      providerOperationId: input.providerOperationId,
      providerStatus: input.providerStatus,
      issuedAt: input.issuedAt,
      reconciliationRequired: false,
      lastSyncedAt: input.issuedAt,
      stateHistory: [
        ...(Array.isArray(input.document.stateHistory) ? input.document.stateHistory : []),
        ...stateEntry("issued", input.issuedAt, input.providerStatus),
      ],
    },
    depth: 0,
    overrideAccess: true,
    context: { accountingDocumentLifecycleMutation: true },
  }) as Promise<AccountingDocument>
}

export const issueCreditNote = issueAccountingDocument

export async function ensureRefundPaymentAdjustment(input: {
  payload: Payload
  order: Order
  paymentAttempt: PaymentAttempt
  providerRefundId: string
  providerStatus: string
  grossAmountMinor: number
  issuedAt: string
}): Promise<AccountingDocument> {
  const byProviderReference = await findOneDoc(input.payload, "accounting-documents", {
    providerOperationId: { equals: input.providerRefundId },
  })
  if (byProviderReference) {
    return issueAccountingDocument({
      payload: input.payload,
      document: byProviderReference,
      providerOperationId: input.providerRefundId,
      providerStatus: input.providerStatus,
      issuedAt: input.issuedAt,
    })
  }
  const pending = await findAccountingDocument(
    input.payload,
    `payment-adjustment:payment-attempt:${input.paymentAttempt.id}:duplicate_payment`,
  )
  if (pending) {
    return issueAccountingDocument({
      payload: input.payload,
      document: pending,
      providerOperationId: input.providerRefundId,
      providerStatus: input.providerStatus,
      issuedAt: input.issuedAt,
    })
  }
  const document = await ensurePendingPaymentAdjustment({
    payload: input.payload,
    order: input.order,
    paymentAttempt: input.paymentAttempt,
    grossAmountMinor: input.grossAmountMinor,
    now: input.issuedAt,
  })
  return issueAccountingDocument({
    payload: input.payload,
    document,
    providerOperationId: input.providerRefundId,
    providerStatus: input.providerStatus,
    issuedAt: input.issuedAt,
  })
}

export async function ensureRefundCreditNote(input: {
  payload: Payload
  order: Order
  paymentAttempt: PaymentAttempt
  invoice: AccountingDocument
  providerRefundId: string
  providerStatus: string
  grossAmountMinor: number
  issuedAt: string
  scenario?: RefundScenario | null
}): Promise<AccountingDocument> {
  const byProviderReference = await findOneDoc(input.payload, "accounting-documents", {
    providerOperationId: { equals: input.providerRefundId },
  })
  if (byProviderReference) {
    return issueCreditNote({
      payload: input.payload,
      document: byProviderReference,
      providerOperationId: input.providerRefundId,
      providerStatus: input.providerStatus,
      issuedAt: input.issuedAt,
    })
  }
  const evidenceKey = `credit-note:mollie-refund:${input.providerRefundId}`
  const existing = await findAccountingDocument(input.payload, evidenceKey)
  if (existing) return existing
  const amounts = allocateCreditAmounts(input.order, input.grossAmountMinor)
  return createOrReloadAccountingDocument(input.payload, evidenceKey, () =>
    input.payload.create({
    collection: "accounting-documents",
    data: {
      evidenceKey,
      documentNumber: `CN-${input.order.orderNumber}-RE-${input.providerRefundId}`,
      documentType: "credit_note",
      state: "issued",
      order: input.order.id,
      paymentAttempt: input.paymentAttempt.id,
      tenant: numericRelationshipId(input.order.tenant),
      reversesDocument: input.invoice.id,
      reason: "refund",
      refundScenario: input.scenario ?? undefined,
      providerOperationId: input.providerRefundId,
      providerStatus: input.providerStatus,
      currency: input.order.currency,
      ...amounts,
      lineItems: [{
        code: "payment-refund",
        description: input.scenario ?? "Mollie refund",
        quantity: 1,
        netAmountMinor: amounts.netAmountMinor,
      }],
      customerSnapshot: customerSnapshot(input.order),
      issuedAt: input.issuedAt,
      reconciliationRequired: false,
      lastSyncedAt: input.issuedAt,
      stateHistory: stateEntry("issued", input.issuedAt, input.providerStatus),
      createdAt: input.issuedAt,
    },
    depth: 0,
    overrideAccess: true,
    }) as Promise<AccountingDocument>,
  )
}

export async function ensureChargebackCreditNote(input: {
  payload: Payload
  order: Order
  paymentAttempt: PaymentAttempt
  invoice: AccountingDocument
  providerChargebackId: string
  grossAmountMinor: number
  issuedAt: string
}): Promise<AccountingDocument> {
  const evidenceKey = `credit-note:mollie-chargeback:${input.providerChargebackId}`
  const existing = await findAccountingDocument(input.payload, evidenceKey)
  if (existing) return existing
  const amounts = allocateCreditAmounts(input.order, input.grossAmountMinor)
  return createOrReloadAccountingDocument(input.payload, evidenceKey, () =>
    input.payload.create({
    collection: "accounting-documents",
    data: {
      evidenceKey,
      documentNumber: `CN-${input.order.orderNumber}-CB-${input.providerChargebackId}`,
      documentType: "credit_note",
      state: "issued",
      order: input.order.id,
      paymentAttempt: input.paymentAttempt.id,
      tenant: numericRelationshipId(input.order.tenant),
      reversesDocument: input.invoice.id,
      reason: "chargeback",
      providerOperationId: input.providerChargebackId,
      providerStatus: "chargeback",
      currency: input.order.currency,
      ...amounts,
      lineItems: [{
        code: "payment-chargeback",
        description: "Mollie chargeback",
        quantity: 1,
        netAmountMinor: amounts.netAmountMinor,
      }],
      customerSnapshot: customerSnapshot(input.order),
      issuedAt: input.issuedAt,
      reconciliationRequired: false,
      lastSyncedAt: input.issuedAt,
      stateHistory: stateEntry("issued", input.issuedAt, "chargeback"),
      createdAt: input.issuedAt,
    },
    depth: 0,
    overrideAccess: true,
    }) as Promise<AccountingDocument>,
  )
}
