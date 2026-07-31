import { beforeEach, describe, expect, it, vi } from "vitest"

import { asPayload } from "../_helpers/mockPayload"

const {
  reconcileCommerceEdgeRouting,
  recordCommerceAdminException,
  queueDomainMigrationPreparation,
  queueDomainRenewal,
  queueMolliePaymentSync,
  queueOrderFulfillment,
  recoverMissingMolliePaymentReferences,
  commerceProviderWritesAllowed,
} = vi.hoisted(() => ({
  reconcileCommerceEdgeRouting: vi.fn(async () => ({
    examined: 0,
    active: 0,
    pending: 0,
    failed: 0,
  })),
  recordCommerceAdminException: vi.fn(),
  queueDomainMigrationPreparation: vi.fn(),
  queueDomainRenewal: vi.fn(),
  queueMolliePaymentSync: vi.fn(),
  queueOrderFulfillment: vi.fn(),
  recoverMissingMolliePaymentReferences: vi.fn(async () => ({
    examined: 0,
    recoveredPaymentIds: [] as string[],
  })),
  commerceProviderWritesAllowed: vi.fn(() => true),
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
  queueMolliePaymentSync,
}))
vi.mock("@/lib/billing/billingLifecycle", () => ({
  processBillingAgreement: vi.fn(),
}))
vi.mock("@/lib/commerce/notifications", () => ({
  queueDueCommerceNotifications: vi.fn(async () => 0),
}))
vi.mock("@/lib/domains/edgeRouting", () => ({
  reconcileCommerceEdgeRouting,
}))
vi.mock("@/lib/commerce/alerts", () => ({
  recordCommerceAdminException,
  resolveCommerceAdminException: vi.fn(),
}))
vi.mock("@/lib/commerce/releaseGateCore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/commerce/releaseGateCore")>()),
  commerceProviderWritesAllowed,
}))
vi.mock("@/lib/commerce/reconciliation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/commerce/reconciliation")>()),
  recoverMissingMolliePaymentReferences,
}))

import { reconcileCommerceTask } from "@/lib/jobs/reconcileCommerceTask"

describe("commerce reconciliation migration scheduling", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    commerceProviderWritesAllowed.mockReturnValue(true)
    recoverMissingMolliePaymentReferences.mockResolvedValue({
      examined: 0,
      recoveredPaymentIds: [],
    })
  })

  it("performs no edge writes or blocking alert when provider writes are intentionally disabled", async () => {
    commerceProviderWritesAllowed.mockReturnValue(false)
    const payload = asPayload({
      find: vi.fn(async () => ({ docs: [], totalDocs: 0 })),
    })
    const handler = reconcileCommerceTask.handler as unknown as (
      args: { req: { payload: typeof payload } }
    ) => Promise<{ output: { examined: number; queued: number } }>

    await expect(handler({ req: { payload } })).resolves.toBeDefined()

    expect(reconcileCommerceEdgeRouting).not.toHaveBeenCalled()
    expect(recordCommerceAdminException).not.toHaveBeenCalledWith(
      expect.objectContaining({ code: "release_gate_blocked_edge_routing" }),
    )
  })

  it("continues payment and renewal reconciliation after edge capacity fails closed", async () => {
    reconcileCommerceEdgeRouting.mockResolvedValueOnce({
      examined: 301,
      active: 0,
      pending: 0,
      failed: 301,
    })
    const find = vi.fn(async ({ collection }: { collection: string }) => ({
      docs: collection === "managed-domains"
        ? [{ id: 951, providerRenewalDate: "2026-07-29T00:00:00.000Z" }]
        : [],
      totalDocs: collection === "managed-domains" ? 1 : 0,
    }))
    const payload = asPayload({ find })
    const handler = reconcileCommerceTask.handler as unknown as (
      args: { req: { payload: typeof payload } }
    ) => Promise<{ output: { examined: number; queued: number } }>

    await expect(handler({ req: { payload } })).resolves.toBeDefined()
    expect(recordCommerceAdminException).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "edge_routing_blocked",
        severity: "critical",
      }),
    )
    expect(queueDomainRenewal).toHaveBeenCalledWith(payload, 951)
    expect(find).toHaveBeenCalledWith(expect.objectContaining({
      collection: "payment-attempts",
    }))
  })

  it("queues an exact recovered payment reference for scheduled synchronization", async () => {
    recoverMissingMolliePaymentReferences.mockResolvedValueOnce({
      examined: 1,
      recoveredPaymentIds: ["tr_recovered_missing_webhook"],
    })
    const payload = asPayload({
      find: vi.fn(async () => ({ docs: [], totalDocs: 0 })),
    })
    const handler = reconcileCommerceTask.handler as unknown as (
      args: { req: { payload: typeof payload } }
    ) => Promise<{ output: { examined: number; queued: number } }>

    const result = await handler({ req: { payload } })

    expect(queueMolliePaymentSync).toHaveBeenCalledTimes(1)
    expect(queueMolliePaymentSync).toHaveBeenCalledWith(
      payload,
      "tr_recovered_missing_webhook",
    )
    expect(result.output).toEqual({ examined: 1, queued: 1 })
  })

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
