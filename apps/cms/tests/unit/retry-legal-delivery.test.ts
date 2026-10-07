import { describe, expect, it, vi } from "vitest"
import { retryLegalDelivery } from "@/lib/legal/retryLegalDelivery"

import type { LegalNotificationDelivery, LegalOperatorEvent } from "@/payload-types"
import { createInitializedTestPayload } from "../_helpers/testPayload"
import { legalRequirementFixture, legalNotificationDeliveryFixture } from "../_helpers/generatedDocs"
import { payloadUpdateFixture } from "../_helpers/payloadUpdateFixture"

const createPayload = async (overrides: Partial<LegalNotificationDelivery> = {}) => {
  const delivery = legalNotificationDeliveryFixture({ id: 7, notificationKey: "notice:7", status: "failed", retryState: "retryable", attemptCount: 2, requirement: 11, ...overrides })
  const requirement = legalRequirementFixture({ id: 11, status: "notified" })
  const calls: string[] = []
  const payload = await createInitializedTestPayload()
  vi.spyOn(payload.db, "beginTransaction").mockResolvedValue("tx-1")
  vi.spyOn(payload.db, "commitTransaction").mockResolvedValue(undefined)
  vi.spyOn(payload.db, "rollbackTransaction").mockResolvedValue(undefined)
  vi.spyOn(payload, "findByID").mockImplementation(async ({ collection }) => {
    if (collection === "legal-notification-deliveries") return delivery
    if (collection === "legal-requirements") return requirement
    throw new Error(`Unexpected collection ${collection}`)
  })
  vi.spyOn(payload, "create").mockImplementation(async args => {
    if (args.collection !== "legal-operator-events") throw new Error(`Unexpected collection ${args.collection}`)
    calls.push("audit")
    const event: LegalOperatorEvent = { id: 1, eventKey: "fixture-event", action: "delivery_retry_requested", targetCollection: "legal-notification-deliveries", targetId: "7", actorEmail: "admin@example.test", reason: "Fixture retry reason", occurredAt: "2026-07-11T12:00:00.000Z", requestId: "fixture-request", createdAt: "2026-07-11T12:00:00.000Z", updatedAt: "2026-07-11T12:00:00.000Z" }
    return Object.assign(event, args.data)
  })
  vi.spyOn(payload, "update").mockImplementation(payloadUpdateFixture(async args => {
    calls.push(args.collection)
    if (args.collection === "legal-notification-deliveries") {
      const updated = Object.assign({ ...delivery }, args.data)
      return args.where ? { docs: [updated], errors: [] } : updated
    }
    if (args.collection === "legal-requirements") return Object.assign({ ...requirement }, args.data)
    throw new Error(`Unexpected collection ${args.collection}`)
  }))
  return { payload, calls }
}

describe("retryLegalDelivery", () => {
  it("writes immutable intent before requeueing delivery and requirement", async () => {
    const { payload, calls } = await createPayload()
    await retryLegalDelivery({ payload, deliveryId: 7, actorUserId: 2, actorEmail: "admin@example.test", reason: "Providerstoring is opgelost", requestId: "req-1", now: new Date("2026-07-11T12:00:00Z") })
    expect(calls).toEqual(["legal-notification-deliveries", "audit", "legal-requirements"])
    expect(payload.create).toHaveBeenCalledWith(expect.objectContaining({
      collection: "legal-operator-events",
      data: expect.objectContaining({ action: "delivery_retry_requested", targetId: "7", requestId: "req-1" }),
    }))
    expect(payload.db.commitTransaction).toHaveBeenCalledWith("tx-1")
  })

  it("rejects permanent provider failures", async () => {
    const { payload } = await createPayload({ retryState: "permanent" })
    await expect(retryLegalDelivery({ payload, deliveryId: 7, actorUserId: 2, actorEmail: "admin@example.test", reason: "Nogmaals proberen" })).rejects.toThrow("definitieve")
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.db.rollbackTransaction).toHaveBeenCalledWith("tx-1")
  })

  it("rejects non-failed deliveries and vague reasons", async () => {
    const { payload } = await createPayload({ status: "sent" })
    await expect(retryLegalDelivery({ payload, deliveryId: 7, actorUserId: 2, actorEmail: "admin@example.test", reason: "Nogmaals proberen" })).rejects.toThrow("Alleen een mislukte")
    await expect(retryLegalDelivery({ payload, deliveryId: 7, actorUserId: 2, actorEmail: "admin@example.test", reason: "retry" })).rejects.toThrow("minimaal 8")
  })
})
