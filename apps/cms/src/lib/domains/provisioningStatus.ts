import "server-only"

import type { Payload } from "payload"
import type { ManagedDomain, Order } from "@/payload-types"

export type CustomerProvisioningStage = {
  code: "payment" | "registration" | "registrant_verification" | "dns" | "https" | "activation"
  status: "pending" | "action_required" | "complete" | "review"
}

export type CustomerProvisioningStatus = {
  domain: string
  stages: CustomerProvisioningStage[]
  registrantVerificationDueAt: string | null
  updatedAt: string
}

const completeVerification = new Set([
  "not_required",
  "verified",
  "recovered",
])

const actionVerification = new Set([
  "pending",
  "overdue",
  "suspended",
  "failed",
])

export async function loadCustomerProvisioningStatus(
  payload: Payload,
  input: {
    generationRunId: string | number
    customerEmail: string
  },
): Promise<CustomerProvisioningStatus | null> {
  const customerEmail = input.customerEmail.trim().toLowerCase()
  if (!customerEmail) return null
  const orders = await payload.find({
    collection: "orders",
    where: {
      and: [
        { generationRun: { equals: input.generationRunId } },
        { orderKind: { equals: "initial_subscription" } },
        { customerEmail: { equals: customerEmail } },
      ],
    },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })
  if (orders.docs.length !== 1) return null
  const order = orders.docs[0] as Order
  const domains = await payload.find({
    collection: "managed-domains",
    where: { originatingOrder: { equals: order.id } },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })
  if (domains.docs.length > 1) return null
  const domain = (domains.docs[0] as ManagedDomain | undefined) ?? null
  const paymentComplete = order.paymentStatus === "paid" ||
    order.paymentStatus === "partially_refunded"
  const manualReview = domain?.customerStatus === "manual_review"
  const verification = domain?.registrantVerificationStatus ?? "not_checked"

  return {
    domain: domain?.domainNameAscii ?? order.domain,
    stages: [
      {
        code: "payment",
        status: paymentComplete ? "complete" : "pending",
      },
      {
        code: "registration",
        status: manualReview
          ? "review"
          : domain?.providerRegistrationState === "confirmed"
            ? "complete"
            : "pending",
      },
      {
        code: "registrant_verification",
        status: manualReview
          ? "review"
          : completeVerification.has(verification)
            ? "complete"
            : actionVerification.has(verification)
              ? "action_required"
              : "pending",
      },
      {
        code: "dns",
        status: manualReview
          ? "review"
          : domain?.authoritativeDnsStatus === "verified"
            ? "complete"
            : "pending",
      },
      {
        code: "https",
        status: manualReview
          ? "review"
          : domain?.httpsStatus === "verified" &&
              domain.adminHttpsStatus === "verified" &&
              domain.edgeRoutingStatus === "active"
            ? "complete"
            : "pending",
      },
      {
        code: "activation",
        status: manualReview
          ? "review"
          : domain?.customerStatus === "active" &&
              domain.entitlementStatus === "active"
            ? "complete"
            : "pending",
      },
    ],
    registrantVerificationDueAt:
      domain?.registrantVerificationDueAt ?? null,
    updatedAt: domain?.updatedAt ?? order.updatedAt,
  }
}
