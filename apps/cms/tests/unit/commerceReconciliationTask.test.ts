import { createTaskRunner } from "../_helpers/taskRunner"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { createTestPayload } from "../_helpers/testPayload"
import { managedDomainFixture, domainMigrationFixture, orderFixture, paymentAttemptFixture, paginatedFixture } from "../_helpers/generatedDocs"

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
    const payload = createTestPayload()
    vi.spyOn(payload, "find").mockResolvedValue(paginatedFixture([]))
    const handler = createTaskRunner(reconcileCommerceTask)

    await expect(handler({ input: {}, req: { payload } })).resolves.toBeDefined()

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
    const payload = createTestPayload()
    const find = vi.spyOn(payload, "find").mockImplementation(async ({ collection }) => (paginatedFixture(collection === "managed-domains"
        ? [managedDomainFixture({ id: 951, providerRenewalDate: "2026-07-29T00:00:00.000Z" })]
        : [])))

    const handler = createTaskRunner(reconcileCommerceTask)

    await expect(handler({ input: {}, req: { payload } })).resolves.toBeDefined()
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
    const payload = createTestPayload()
    vi.spyOn(payload, "find").mockResolvedValue(paginatedFixture([]))
    const handler = createTaskRunner(reconcileCommerceTask)

    const result = await handler({ input: {}, req: { payload } })

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
    const payload = createTestPayload()
    const find = vi.spyOn(payload, "find").mockImplementation(async ({ collection }) => (paginatedFixture(collection === "domain-migrations"
        ? [domainMigrationFixture({ id: 901, state: "verifying" })]
        : [])))

    const handler = createTaskRunner(reconcileCommerceTask)

    const result = await handler({ input: {}, req: { payload } })

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
    const payload = createTestPayload()
    const find = vi.spyOn(payload, "find").mockImplementation(async ({
      collection,
      where,
    }) => {
      if (collection === "orders") {
        return paginatedFixture([orderFixture({ id: 701, state: "fulfillment_pending" })])
      }
      if (
        collection === "payment-attempts" &&
        where?.and?.some((condition) => "order" in condition)
      ) {
        return paginatedFixture([paymentAttemptFixture({ id: 801, order: 701, state: "paid" })])
      }
      return paginatedFixture([])
    })

    const handler = createTaskRunner(reconcileCommerceTask)

    const result = await handler({ input: {}, req: { payload } })

    expect(queueOrderFulfillment).toHaveBeenCalledWith(payload, {
      orderId: 701,
      paymentAttemptId: 801,
    })
    expect(result.output).toEqual({ examined: 1, queued: 1 })
  })

  it("queues a stale provider renewal check even when cached expiry is far away", async () => {
    const payload = createTestPayload()
    const find = vi.spyOn(payload, "find").mockImplementation(async ({ collection }) => (paginatedFixture(collection === "managed-domains"
        ? [managedDomainFixture({
            id: 951,
            expiresAt: "2029-07-28T00:00:00.000Z",
            providerAutorenewCheckedAt: "2026-07-01T00:00:00.000Z",
          })]
        : [])))

    const handler = createTaskRunner(reconcileCommerceTask)

    await handler({ input: {}, req: { payload } })

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
      const payload = createTestPayload()
    const find = vi.spyOn(payload, "find").mockImplementation(async ({ collection }) => (paginatedFixture(collection === "managed-domains"
          ? [managedDomainFixture({
              id: 952,
              providerRenewalDate: "2026-10-26T00:00:00.000Z",
              providerAutorenewCheckedAt: "2026-07-28T00:00:00.000Z",
            })]
          : [])))

      const handler = createTaskRunner(reconcileCommerceTask)

      await handler({ input: {}, req: { payload } })

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
