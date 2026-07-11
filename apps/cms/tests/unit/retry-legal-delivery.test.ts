import { describe, expect, it, vi } from "vitest"
import { retryLegalDelivery } from "@/lib/legal/retryLegalDelivery"

const createPayload = (overrides: Record<string, unknown> = {}) => {
  const delivery = { id: 7, notificationKey: "notice:7", status: "failed", retryState: "retryable", attemptCount: 2, requirement: 11, ...overrides }
  const calls: string[] = []
  const payload = {
    db: {
      beginTransaction: vi.fn(async () => "tx-1"),
      commitTransaction: vi.fn(async () => undefined),
      rollbackTransaction: vi.fn(async () => undefined),
    },
    findByID: vi.fn(async ({ collection }: any) => collection === "legal-notification-deliveries" ? delivery : { id: 11, status: "notified" }),
    create: vi.fn(async () => { calls.push("audit"); return { id: 1 } }),
    update: vi.fn(async ({ collection, data, where }: any) => {
      calls.push(collection)
      const updated = { ...delivery, ...data }
      return where ? { docs: [updated], totalDocs: 1 } : updated
    }),
  } as any
  return { payload, calls }
}

describe("retryLegalDelivery", () => {
  it("writes immutable intent before requeueing delivery and requirement", async () => {
    const { payload, calls } = createPayload()
    await retryLegalDelivery({ payload, deliveryId: 7, actorUserId: 2, actorEmail: "admin@example.test", reason: "Providerstoring is opgelost", requestId: "req-1", now: new Date("2026-07-11T12:00:00Z") })
    expect(calls).toEqual(["legal-notification-deliveries", "audit", "legal-requirements"])
    expect(payload.create).toHaveBeenCalledWith(expect.objectContaining({
      collection: "legal-operator-events",
      data: expect.objectContaining({ action: "delivery_retry_requested", targetId: "7", requestId: "req-1" }),
    }))
    expect(payload.db.commitTransaction).toHaveBeenCalledWith("tx-1")
  })

  it("rejects permanent provider failures", async () => {
    const { payload } = createPayload({ retryState: "permanent" })
    await expect(retryLegalDelivery({ payload, deliveryId: 7, actorUserId: 2, actorEmail: "admin@example.test", reason: "Nogmaals proberen" })).rejects.toThrow("definitieve")
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.db.rollbackTransaction).toHaveBeenCalledWith("tx-1")
  })

  it("rejects non-failed deliveries and vague reasons", async () => {
    const { payload } = createPayload({ status: "sent" })
    await expect(retryLegalDelivery({ payload, deliveryId: 7, actorUserId: 2, actorEmail: "admin@example.test", reason: "Nogmaals proberen" })).rejects.toThrow("Alleen een mislukte")
    await expect(retryLegalDelivery({ payload, deliveryId: 7, actorUserId: 2, actorEmail: "admin@example.test", reason: "retry" })).rejects.toThrow("minimaal 8")
  })
})
