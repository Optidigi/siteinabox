import type { ManagedDomain, Order, PaymentAttempt } from "@/payload-types"

const fulfillmentBlockingAdjustments = new Set<string>([
  "refund_pending",
  "partially_refunded",
  "refunded",
  "chargeback",
])

export const initialPaymentBlocksNewFulfillment = (
  attempt: Pick<PaymentAttempt, "purpose" | "state">,
): boolean =>
  attempt.purpose === "first_payment" &&
  fulfillmentBlockingAdjustments.has(attempt.state ?? "")

export const initialPaymentIsFinanciallySecured = (
  order: Pick<Order, "paymentStatus" | "state">,
  attempt: Pick<PaymentAttempt, "purpose" | "state">,
): boolean =>
  attempt.purpose === "first_payment" &&
  (attempt.state === "paid" || attempt.state === "refund_failed") &&
  order.paymentStatus === "paid" &&
  (order.state === "fulfillment_pending" || order.state === "fulfilled")

export const registrarCommitStarted = (
  domain: Pick<
    ManagedDomain,
    "providerRegistrationState" | "providerDomainId" | "registrationRequestedAt"
  > | null,
): boolean =>
  domain != null &&
  (
    Boolean(domain.providerDomainId) ||
    (
      Boolean(domain.registrationRequestedAt) &&
      ["prepared", "indeterminate", "confirmed"].includes(
        domain.providerRegistrationState,
      )
    )
  )
