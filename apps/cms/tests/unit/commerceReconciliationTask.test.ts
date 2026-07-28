import { describe, expect, it, vi } from "vitest"

import { asPayload } from "../_helpers/mockPayload"

const {
  queueDomainMigrationPreparation,
  queueDomainRenewal,
  queueOrderFulfillment,
} = vi.hoisted(() => ({
  queueDomainMigrationPreparation: vi.fn(),
  queueDomainRenewal: vi.fn(),
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
  queueDomainRenewal,
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
  it("serializes and coalesces overlapping global reconciliation passes", () => {
    const concurrency = reconcileCommerceTask.concurrency as {
      key: (args: unknown) => string
      exclusive: boolean
      supersedes: boolean
    }
    expect(concurrency).toMatchObject({
      exclusive: true,
      supersedes: true,
    })
    expect(concurrency.key({})).toBe(
      "reconcile-commerce",
    )
  })

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

  it("queues a stale provider renewal check even when cached expiry is far away", async () => {
    const find = vi.fn(async ({ collection }: { collection: string }) => ({
      docs: collection === "managed-domains"
        ? [{
            id: 951,
            expiresAt: "2029-07-28T00:00:00.000Z",
            providerAutorenewCheckedAt: "2026-07-01T00:00:00.000Z",
          }]
        : [],
      totalDocs: collection === "managed-domains" ? 1 : 0,
    }))
    const payload = asPayload({ find })
    const handler = reconcileCommerceTask.handler as unknown as (
      args: { req: { payload: typeof payload } }
    ) => Promise<{ output: { examined: number; queued: number } }>

    await handler({ req: { payload } })

    expect(queueDomainRenewal).toHaveBeenCalledWith(payload, 951)
    expect(find).toHaveBeenCalledWith(expect.objectContaining({
      collection: "managed-domains",
      where: expect.objectContaining({
        and: expect.arrayContaining([
          expect.objectContaining({
            or: expect.arrayContaining([
              expect.objectContaining({
                providerAutorenewCheckedAt: expect.objectContaining({
                  less_than_equal: expect.any(String),
                }),
              }),
            ]),
          }),
        ]),
      }),
    }))
  })

  it("selects a fresh managed domain at the 90-day renewal horizon", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-28T00:00:00.000Z"))
    try {
      const find = vi.fn(async ({ collection }: { collection: string }) => ({
        docs: collection === "managed-domains"
          ? [{
              id: 952,
              providerRenewalDate: "2026-10-26T00:00:00.000Z",
              providerAutorenewCheckedAt: "2026-07-28T00:00:00.000Z",
            }]
          : [],
        totalDocs: collection === "managed-domains" ? 1 : 0,
      }))
      const payload = asPayload({ find })
      const handler = reconcileCommerceTask.handler as unknown as (
        args: { req: { payload: typeof payload } }
      ) => Promise<{ output: { examined: number; queued: number } }>

      await handler({ req: { payload } })

      expect(queueDomainRenewal).toHaveBeenCalledWith(payload, 952)
      expect(find).toHaveBeenCalledWith(expect.objectContaining({
        collection: "managed-domains",
        where: expect.objectContaining({
          and: expect.arrayContaining([
            expect.objectContaining({
              or: expect.arrayContaining([
                {
                  providerRenewalDate: {
                    less_than_equal: "2026-10-26T00:00:00.000Z",
                  },
                },
              ]),
            }),
          ]),
        }),
      }))
    } finally {
      vi.useRealTimers()
    }
  })
})
