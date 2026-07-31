import { describe, expect, it } from "vitest"

import type { PaymentAttempt } from "@/payload-types"
import {
  classifyMollieCreationError,
  classifyMollieRefundError,
  generationProjectionStatus,
  paymentStateFromMollie,
  targetAttemptState,
} from "@/lib/payments/paymentDecisions"
import {
  MollieApiError,
  type MolliePayment,
} from "@/lib/payments/mollieAdapter"

const attempt = (state: PaymentAttempt["state"] = "pending_provider") => ({
  id: 10,
  state,
  currency: "EUR",
  grossAmountMinor: 2_299,
  refundedAmountMinor: 0,
  chargebackAmountMinor: 0,
} as PaymentAttempt)

const payment = (input: Partial<MolliePayment> = {}): MolliePayment => ({
  id: "tr_test",
  status: "open",
  amount: { currency: "EUR", value: "22.99" },
  _embedded: { refunds: [], chargebacks: [] },
  ...input,
})

describe("payment decisions", () => {
  it("maps provider and shared projection states without side effects", () => {
    expect([
      "paid",
      "authorized",
      "canceled",
      "expired",
      "failed",
      "open",
    ].map(paymentStateFromMollie)).toEqual([
      "paid",
      "authorized",
      "cancelled",
      "expired",
      "failed",
      "pending_provider",
    ])
    expect(generationProjectionStatus("chargeback")).toBe("completed")
    expect(generationProjectionStatus("cancelled")).toBe("canceled")
    expect(generationProjectionStatus("authorized")).toBe("pending_provider")
  })

  it("distinguishes deterministic rejection from indeterminate writes", () => {
    expect(classifyMollieCreationError(
      new MollieApiError("create", 422),
    )).toEqual({
      outcome: "deterministic_rejection",
      providerCode: "mollie_http_422",
    })
    expect(classifyMollieCreationError(
      new MollieApiError("create", 409),
    )).toEqual({
      outcome: "indeterminate",
      providerCode: "provider_write_indeterminate",
    })
    expect(classifyMollieRefundError(
      new MollieApiError("refund", 503),
    )).toEqual({
      outcome: "indeterminate",
      providerCode: "refund_write_indeterminate",
    })
    expect(classifyMollieRefundError(new Error("connection lost"))).toEqual({
      outcome: "indeterminate",
      providerCode: "refund_write_indeterminate",
    })
  })

  it("keeps captured state on an older provider projection", () => {
    expect(targetAttemptState(
      attempt("paid"),
      payment({ status: "open" }),
    )).toEqual({
      state: "paid",
      refundedAmountMinor: 0,
      chargebackAmountMinor: 0,
      reconciliationRequired: true,
    })
  })

  it("prioritizes chargeback and detects adjustment over-allocation", () => {
    expect(targetAttemptState(attempt("paid"), payment({
      status: "paid",
      _embedded: {
        refunds: [{
          id: "re_1",
          status: "refunded",
          amount: { currency: "EUR", value: "22.99" },
        }],
        chargebacks: [{
          id: "chb_1",
          amount: { currency: "EUR", value: "22.99" },
        }],
      },
    }))).toEqual({
      state: "chargeback",
      refundedAmountMinor: 2_299,
      chargebackAmountMinor: 2_299,
      reconciliationRequired: true,
    })
  })
})
