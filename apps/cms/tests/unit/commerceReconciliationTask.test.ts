import { describe, expect, it, vi } from "vitest"

import { asPayload } from "../_helpers/mockPayload"

const { queueDomainMigrationPreparation, queueOrderFulfillment } = vi.hoisted(() => ({
  queueDomainMigrationPreparation: vi.fn(),
  queueOrderFulfillment: vi.fn(),
}))

vi.mock("@/lib/jobs/prepareDomainMigrationTask", () => ({
  queueDomainMigrationPreparation,
}))
vi.mock("@/lib/jobs/prepareDomainTransferOutTask", () => ({
  queueDomainTransferOutPreparation: vi.fn(),
}))
vi.mock("@/lib/jobs/fulfillOrderTask", () => ({
  queueOrderFulfillment,
}))
vi.mock("@/lib/jobs/renewDomainTask", () => ({
  queueDomainRenewal: vi.fn(),
}))
vi.mock("@/lib/jobs/syncMolliePaymentTask", () => ({
  queueMolliePaymentSync: vi.fn(),
}))
vi.mock("@/lib/billing/billingLifecycle", () => ({
  processBillingAgreement: vi.fn(),
}))
vi.mock("@/lib/commerce/notifications", () => ({
  queueDueCommerceNotifications: vi.fn(async () => 0),
}))
vi.mock("@/lib/commerce/alerts", () => ({
  recordCommerceAdminException: vi.fn(),
  resolveCommerceAdminException: vi.fn(),
}))

import { reconcileCommerceTask } from "@/lib/jobs/reconcileCommerceTask"

describe("commerce reconciliation migration scheduling", () => {
  it("requeues active automatic migrations through the default coalescing task", async () => {
    const find = vi.fn(async ({ collection }: { collection: string }) => ({
      docs: collection === "domain-migrations"
        ? [{ id: 901, state: "verifying" }]
        : [],
      totalDocs: collection === "domain-migrations" ? 1 : 0,
    }))
    const payload = asPayload({ find })
    const handler = reconcileCommerceTask.handler as unknown as (
      args: { req: { payload: typeof payload } }
    ) => Promise<{ output: { examined: number; queued: number } }>

    const result = await handler({ req: { payload } })

    expect(queueDomainMigrationPreparation).toHaveBeenCalledWith(payload, 901)
    expect(result.output).toEqual({ examined: 1, queued: 1 })
    expect(find).toHaveBeenCalledWith(expect.objectContaining({
      collection: "domain-migrations",
      where: {
        state: {
          in: [
            "ready_to_prepare",
            "preparing",
            "awaiting_provider",
            "ready_for_cutover",
            "cutover_in_progress",
            "verifying",
          ],
        },
      },
    }))
  })

  it("requeues paid fulfillment-pending orders after a release-gate pause", async () => {
    const find = vi.fn(async ({
      collection,
      where,
    }: {
      collection: string
      where?: { and?: Array<Record<string, unknown>> }
    }) => {
      if (collection === "orders") {
        return {
          docs: [{ id: 701, state: "fulfillment_pending" }],
          totalDocs: 1,
        }
      }
      if (
        collection === "payment-attempts" &&
        where?.and?.some((condition) => "order" in condition)
      ) {
        return {
          docs: [{ id: 801, order: 701, state: "paid" }],
          totalDocs: 1,
        }
      }
      return { docs: [], totalDocs: 0 }
    })
    const payload = asPayload({ find })
    const handler = reconcileCommerceTask.handler as unknown as (
      args: { req: { payload: typeof payload } }
    ) => Promise<{ output: { examined: number; queued: number } }>

    const result = await handler({ req: { payload } })

    expect(queueOrderFulfillment).toHaveBeenCalledWith(payload, {
      orderId: 701,
      paymentAttemptId: 801,
    })
    expect(result.output).toEqual({ examined: 1, queued: 1 })
  })
})
