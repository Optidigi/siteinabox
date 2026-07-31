import type { PaymentAttempt } from "@/payload-types"
import type { PaymentAttemptState } from "@siteinabox/contracts/commerce"

import type { GenerationRunPaymentStatus } from "@/lib/payments/generationRunPayment"
import {
  MollieApiError,
  type MollieAmount,
  type MollieChargeback,
  type MolliePayment,
  type MollieRefund,
} from "@/lib/payments/mollieAdapter"

export type MollieCreationErrorClassification =
  | { outcome: "deterministic_rejection"; providerCode: string }
  | { outcome: "indeterminate"; providerCode: "provider_write_indeterminate" }

export type MollieRefundErrorClassification =
  | { outcome: "deterministic_rejection"; providerCode: string }
  | { outcome: "indeterminate"; providerCode: "refund_write_indeterminate" }

export function classifyMollieCreationError(
  error: unknown,
): MollieCreationErrorClassification {
  if (
    error instanceof MollieApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 409
  ) {
    return {
      outcome: "deterministic_rejection",
      providerCode: `mollie_http_${error.status}`,
    }
  }
  return {
    outcome: "indeterminate",
    providerCode: "provider_write_indeterminate",
  }
}

export function classifyMollieRefundError(
  error: unknown,
): MollieRefundErrorClassification {
  const creation = classifyMollieCreationError(error)
  if (creation.outcome === "deterministic_rejection") return creation
  return {
    outcome: "indeterminate",
    providerCode: "refund_write_indeterminate",
  }
}

export function mollieAmountMinor(
  amount: MollieAmount | null | undefined,
): number | null {
  if (
    !amount ||
    amount.currency !== "EUR" ||
    !/^\d+\.\d{2}$/.test(amount.value)
  ) return null
  const [whole, fraction] = amount.value.split(".")
  const value = Number(whole) * 100 + Number(fraction)
  return Number.isSafeInteger(value) && value >= 0 ? value : null
}

export function paymentStateFromMollie(status: string): PaymentAttemptState {
  if (status === "paid") return "paid"
  if (status === "authorized") return "authorized"
  if (status === "canceled") return "cancelled"
  if (status === "expired") return "expired"
  if (status === "failed") return "failed"
  return "pending_provider"
}

export function generationProjectionStatus(
  state: PaymentAttemptState,
): GenerationRunPaymentStatus {
  if ([
    "paid",
    "refund_pending",
    "partially_refunded",
    "refunded",
    "refund_failed",
    "chargeback",
  ].includes(state)) {
    return "completed"
  }
  if (state === "cancelled") return "canceled"
  if (state === "expired") return "expired"
  if (state === "failed") return "failed"
  return "pending_provider"
}

export function isCapturedPaymentAttemptState(
  state: PaymentAttemptState,
): boolean {
  return [
    "paid",
    "refund_pending",
    "partially_refunded",
    "refunded",
    "refund_failed",
    "chargeback",
  ].includes(state)
}

export const confirmedRefunds = (payment: MolliePayment): MollieRefund[] =>
  (payment._embedded?.refunds ?? []).filter(
    (refund) => refund.status === "refunded",
  )

export const pendingRefunds = (payment: MolliePayment): MollieRefund[] =>
  (payment._embedded?.refunds ?? []).filter((refund) =>
    ["queued", "pending", "processing"].includes(refund.status))

export const failedRefunds = (payment: MolliePayment): MollieRefund[] =>
  (payment._embedded?.refunds ?? []).filter((refund) =>
    ["failed", "canceled"].includes(refund.status))

export const totalMollieAdjustmentMinor = (
  entries: Array<MollieRefund | MollieChargeback>,
  expectedCurrency: string,
): number =>
  entries.reduce((total, entry) => {
    const amount = mollieAmountMinor(entry.amount)
    if (amount == null || entry.amount.currency !== expectedCurrency) {
      throw new Error(
        "Mollie adjustment amount does not match the payment currency.",
      )
    }
    return total + amount
  }, 0)

export function targetAttemptState(
  attempt: PaymentAttempt,
  payment: MolliePayment,
): {
  state: PaymentAttemptState
  refundedAmountMinor: number
  chargebackAmountMinor: number
  reconciliationRequired: boolean
} {
  const refunds = confirmedRefunds(payment)
  const refundsPending = pendingRefunds(payment)
  const refundsFailed = failedRefunds(payment)
  const chargebacks = payment._embedded?.chargebacks ?? []
  const refundedAmountMinor = totalMollieAdjustmentMinor(
    refunds,
    attempt.currency,
  )
  const chargebackAmountMinor = totalMollieAdjustmentMinor(
    chargebacks,
    attempt.currency,
  )
  const amountInvalid =
    refundedAmountMinor > attempt.grossAmountMinor ||
    chargebackAmountMinor > attempt.grossAmountMinor ||
    refundedAmountMinor + chargebackAmountMinor > attempt.grossAmountMinor
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
  if (
    refundedAmountMinor >= attempt.grossAmountMinor &&
    attempt.grossAmountMinor > 0
  ) {
    return {
      state: "refunded",
      refundedAmountMinor: Math.min(
        refundedAmountMinor,
        attempt.grossAmountMinor,
      ),
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
      chargebackAmountMinor:
        attempt.chargebackAmountMinor ?? chargebackAmountMinor,
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

export function isDuplicateMollieProjection(
  attempt: PaymentAttempt,
  payment: MolliePayment,
  target: ReturnType<typeof targetAttemptState>,
): boolean {
  return (
    attempt.state === target.state &&
    attempt.providerStatus === payment.status &&
    (attempt.refundedAmountMinor ?? 0) === target.refundedAmountMinor &&
    (attempt.chargebackAmountMinor ?? 0) === target.chargebackAmountMinor
  )
}
