import "server-only"

import type { Payload } from "payload"
import type { BillingAgreement, Order } from "@/payload-types"
import { sameRelationshipId } from "@/lib/relationshipId"

export type CustomerBillingAgreementView = {
  id: string | number
  state: BillingAgreement["state"]
  billingPeriod: BillingAgreement["billingPeriod"]
  currentPeriodEndsAt: string | null
  cancelAt: string | null
  updatedAt: string
}

export async function loadCustomerBillingAgreement(
  payload: Payload,
  input: {
    generationRunId: string | number
    tenantId: string | number
    customerEmail: string
  },
): Promise<CustomerBillingAgreementView | null> {
  const customerEmail = input.customerEmail.trim().toLowerCase()
  if (!customerEmail) return null
  const orders = await payload.find({
    collection: "orders",
    where: {
      and: [
        { generationRun: { equals: input.generationRunId } },
        { tenant: { equals: input.tenantId } },
        { orderKind: { equals: "initial_subscription" } },
        { customerEmail: { equals: customerEmail } },
      ],
    },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })
  if (orders.docs.length === 0) return null
  if (orders.docs.length !== 1) {
    throw new Error("Customer checkout has ambiguous initial-order authority.")
  }
  const order = orders.docs[0] as Order
  // A cancelled initial checkout can retain its agreement record for audit;
  // it must not reopen the launch fulfilment shell for the customer.
  if (order.state === "cancelled") return null
  if (
    !sameRelationshipId(order.tenant, input.tenantId) ||
    order.customerEmail.trim().toLowerCase() !== customerEmail
  ) {
    throw new Error("Customer checkout order authority does not match.")
  }

  const agreements = await payload.find({
    collection: "billing-agreements",
    where: {
      and: [
        { originatingOrder: { equals: order.id } },
        { tenant: { equals: input.tenantId } },
      ],
    },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })
  if (agreements.docs.length === 0) return null
  if (agreements.docs.length !== 1) {
    throw new Error("Customer checkout has ambiguous billing authority.")
  }
  const agreement = agreements.docs[0] as BillingAgreement
  if (
    !sameRelationshipId(agreement.originatingOrder, order.id) ||
    !sameRelationshipId(agreement.tenant, input.tenantId)
  ) {
    throw new Error("Customer billing authority does not match the checkout.")
  }
  if (!agreement.updatedAt) {
    throw new Error("Customer billing authority has no concurrency version.")
  }
  return {
    id: agreement.id,
    state: agreement.state,
    billingPeriod: agreement.billingPeriod,
    currentPeriodEndsAt: agreement.currentPeriodEndsAt ?? null,
    cancelAt: agreement.cancelAt ?? null,
    updatedAt: agreement.updatedAt,
  }
}
