import { describe, expect, it, vi } from "vitest"

import { asPayload, type MockDoc, type MockFindArgs, type MockUpdateArgs } from "../_helpers/mockPayload"

const { authorizeMigrationOperatorWorkFromPayment } = vi.hoisted(() => ({
  authorizeMigrationOperatorWorkFromPayment: vi.fn(),
}))

vi.mock("@/lib/domains/assistedMigration", () => ({
  authorizeMigrationOperatorWorkFromPayment,
}))
vi.mock("@/lib/payments/accountingEvidence", () => ({
  ensureChargebackCreditNote: vi.fn(),
  ensureInvoiceEvidence: vi.fn(async () => ({ id: 300 })),
  ensurePendingCreditNote: vi.fn(),
  ensureRefundCreditNote: vi.fn(),
  issueCreditNote: vi.fn(),
}))

import { applyMollieWebhookPayment } from "@/lib/payments/molliePayments"

describe("supplemental Mollie synchronization", () => {
  it("authorizes operator work without fulfilling the service order or replacing site payment", async () => {
    const order: MockDoc = {
      id: 70,
      orderNumber: "SIAB-MIG-SUP-10-1",
      tenant: 1,
      generationRun: 30,
      state: "accepted",
      orderKind: "migration_supplemental",
      supplementalForMigration: 10,
      paymentStatus: "open",
      providerPaymentId: "tr_supplemental",
      currency: "EUR",
      subtotalNetMinor: 4_900,
      vatAmountMinor: 1_029,
      totalGrossMinor: 5_929,
    }
    const attempt: MockDoc = {
      id: 100,
      idempotencyKey: "mollie:supplemental:order:70:v1",
      order: 70,
      tenant: 1,
      attemptNumber: 1,
      state: "pending_provider",
      purpose: "supplemental",
      sequenceType: "oneoff",
      provider: "mollie",
      providerPaymentId: "tr_supplemental",
      providerStatus: "open",
      currency: "EUR",
      netAmountMinor: 4_900,
      vatAmountMinor: 1_029,
      grossAmountMinor: 5_929,
      reconciliationRequired: false,
      stateHistory: [],
      createdAt: "2026-07-28T10:00:00.000Z",
    }
    const update = vi.fn(async ({ collection, data }: MockUpdateArgs) => {
      const target = collection === "orders" ? order : attempt
      Object.assign(target, data)
      return target
    })
    const payload = asPayload({
      findByID: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection === "orders") return order
        if (collection === "payment-attempts") return attempt
        throw new Error(`Unexpected findByID ${collection}`)
      }),
      find: vi.fn(async ({ collection }: MockFindArgs) => {
        if (collection === "payment-attempts") return { docs: [attempt], totalDocs: 1 }
        return { docs: [], totalDocs: 0 }
      }),
      update,
    })
    authorizeMigrationOperatorWorkFromPayment.mockResolvedValue({ id: 10 })

    const result = await applyMollieWebhookPayment(
      payload,
      "tr_supplemental",
      async () => ({
        id: "tr_supplemental",
        status: "paid",
        amount: { currency: "EUR", value: "59.29" },
        sequenceType: "oneoff",
        paidAt: "2026-07-28T10:05:00.000Z",
        metadata: {
          paymentAttemptId: 100,
          orderId: 70,
          migrationId: 10,
        },
        _embedded: { refunds: [], chargebacks: [] },
      }),
    )

    expect(result).toMatchObject({
      state: "paid",
      orderId: 70,
      fulfillmentRequired: false,
    })
    expect(order).toMatchObject({
      state: "fulfillment_pending",
      paymentStatus: "paid",
    })
    expect(authorizeMigrationOperatorWorkFromPayment).toHaveBeenCalledWith(
      payload,
      order,
      attempt,
      expect.any(String),
    )
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({
      collection: "site-generation-runs",
    }))
  })
})
