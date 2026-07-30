import { describe, expect, it, vi } from "vitest"

import { loadCustomerBillingAgreement } from "@/lib/billing/customerBillingAgreement"
import { asPayload } from "../_helpers/mockPayload"

const order = {
  id: 40,
  generationRun: 9,
  tenant: 12,
  orderKind: "initial_subscription",
  customerEmail: "owner@example.test",
}

const agreement = {
  id: 50,
  originatingOrder: 40,
  tenant: 12,
  state: "active",
  billingPeriod: "annual",
  currentPeriodEndsAt: "2027-07-30T10:00:00.000Z",
  cancelAt: null,
  updatedAt: "2026-07-30T10:00:00.000Z",
}

const payloadFor = (
  orders: unknown[],
  agreements: unknown[],
) => asPayload({
  find: vi.fn(async ({ collection }: { collection: string }) => ({
    docs: collection === "orders" ? orders : agreements,
  })),
})

describe("customer checkout billing authority", () => {
  it("returns only the agreement bound to run, tenant, order, and customer", async () => {
    await expect(loadCustomerBillingAgreement(
      payloadFor([order], [agreement]),
      {
        generationRunId: 9,
        tenantId: 12,
        customerEmail: " OWNER@EXAMPLE.TEST ",
      },
    )).resolves.toEqual({
      id: 50,
      state: "active",
      billingPeriod: "annual",
      currentPeriodEndsAt: "2027-07-30T10:00:00.000Z",
      cancelAt: null,
      updatedAt: "2026-07-30T10:00:00.000Z",
    })
  })

  it("returns no authority when the customer has no order or agreement", async () => {
    await expect(loadCustomerBillingAgreement(payloadFor([], []), {
      generationRunId: 9,
      tenantId: 12,
      customerEmail: "owner@example.test",
    })).resolves.toBeNull()
    await expect(loadCustomerBillingAgreement(payloadFor([order], []), {
      generationRunId: 9,
      tenantId: 12,
      customerEmail: "owner@example.test",
    })).resolves.toBeNull()
  })

  it("fails closed on duplicate order or agreement authority", async () => {
    await expect(loadCustomerBillingAgreement(
      payloadFor([order, { ...order, id: 41 }], []),
      {
        generationRunId: 9,
        tenantId: 12,
        customerEmail: "owner@example.test",
      },
    )).rejects.toThrow("ambiguous initial-order")
    await expect(loadCustomerBillingAgreement(
      payloadFor([order], [agreement, { ...agreement, id: 51 }]),
      {
        generationRunId: 9,
        tenantId: 12,
        customerEmail: "owner@example.test",
      },
    )).rejects.toThrow("ambiguous billing")
  })

  it("fails closed when loaded relationships do not match", async () => {
    await expect(loadCustomerBillingAgreement(
      payloadFor([{ ...order, tenant: 99 }], [agreement]),
      {
        generationRunId: 9,
        tenantId: 12,
        customerEmail: "owner@example.test",
      },
    )).rejects.toThrow("order authority does not match")
    await expect(loadCustomerBillingAgreement(
      payloadFor([order], [{ ...agreement, originatingOrder: 999 }]),
      {
        generationRunId: 9,
        tenantId: 12,
        customerEmail: "owner@example.test",
      },
    )).rejects.toThrow("billing authority does not match")
  })
})
