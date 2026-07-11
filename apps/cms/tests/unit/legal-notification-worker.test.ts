import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ sendEmail: vi.fn() }))
vi.mock("@/lib/email/sendEmail", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email/sendEmail")>()
  return { ...actual, sendEmail: mocks.sendEmail }
})

import { dueFollowupKindForRequirement, processLegalRequirementNotifications } from "@/lib/jobs/sendLegalRequirementNotifications"

const createPayload = () => {
  let id = 100
  const requirement: any = {
    id: 1,
    requirementKey: "platform-terms:nl:2026-08-01.1:user:9:mandatory_reaccept",
    tenant: { id: 7, name: "Demo Bedrijf", domain: "demo.nl" },
    subjectEmail: "owner@demo.nl",
    document: {
      id: 10,
      documentType: "platform-terms",
      documentVersion: "2026-08-01.1",
      effectiveAt: "2026-08-08T00:00:00.000Z",
      changeSummary: "De looptijd is aangepast.",
    },
    action: "mandatory_reaccept",
    status: "pending",
    enforceAt: "2026-08-08T00:00:00.000Z",
  }
  const deliveries: any[] = []
  const find = vi.fn(async ({ collection, where }: any) => {
    if (collection === "legal-requirements") return { docs: [requirement] }
    const key = where?.notificationKey?.equals
    return { docs: deliveries.filter((item) => item.notificationKey === key) }
  })
  const create = vi.fn(async ({ collection, data }: any) => {
    if (collection !== "legal-notification-deliveries") throw new Error("unexpected collection")
    const row = { id: id++, ...data }
    deliveries.push(row)
    return row
  })
  const update = vi.fn(async ({ collection, id: rowId, data }: any) => {
    if (collection === "legal-notification-deliveries" && rowId == null) {
      const row = deliveries.find((item) => item.status !== "sent" && item.status !== "cancelled")
      if (!row) return { docs: [] }
      Object.assign(row, data)
      return { docs: [row] }
    }
    const row = collection === "legal-requirements"
      ? requirement
      : deliveries.find((item) => item.id === rowId)
    Object.assign(row, data)
    return row
  })
  const findByID = vi.fn(async () => requirement)
  return { payload: { find, findByID, create, update } as any, requirement, deliveries }
}

describe("legal notification worker", () => {
  beforeEach(() => {
    mocks.sendEmail.mockReset()
    mocks.sendEmail.mockResolvedValue({ provider: "test", providerMessageId: "msg-1" })
  })

  it("sends once, records the logical delivery, and marks the requirement notified", async () => {
    const { payload, requirement, deliveries } = createPayload()
    const now = new Date("2026-07-11T12:00:00.000Z")
    await expect(processLegalRequirementNotifications({ payload, now })).resolves.toMatchObject({ sent: 1, failed: 0 })
    await expect(processLegalRequirementNotifications({ payload, now })).resolves.toMatchObject({ sent: 0, skipped: 1 })
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "owner@demo.nl",
      intent: "legal.reacceptance",
      tenant: 7,
    }))
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0]).toMatchObject({ status: "sent", attemptCount: 1, providerMessageId: "msg-1" })
    expect(requirement).toMatchObject({ status: "notified", lastError: null })
  })

  it("retains a failed requirement and schedules a retry", async () => {
    const { payload, requirement, deliveries } = createPayload()
    mocks.sendEmail.mockRejectedValueOnce(new Error("provider unavailable"))
    const now = new Date("2026-07-11T12:00:00.000Z")
    await expect(processLegalRequirementNotifications({ payload, now })).resolves.toMatchObject({ sent: 0, failed: 1 })
    expect(requirement.status).toBe("failed")
    expect(deliveries[0]).toMatchObject({ status: "failed", retryState: "retryable", attemptCount: 1 })
    expect(new Date(deliveries[0].nextAttemptAt).getTime()).toBeGreaterThan(now.getTime())
  })

  it("emails a direct notice once without presenting an acceptance action", async () => {
    const { payload, requirement } = createPayload()
    requirement.action = "direct_notice"
    requirement.enforceAt = null
    await processLegalRequirementNotifications({ payload, now: new Date("2026-07-11T12:00:00.000Z") })
    const message = mocks.sendEmail.mock.calls[0]?.[0]
    expect(message.subject).toContain("Juridische kennisgeving")
    expect(message.html).not.toContain("Bekijk en accepteer")
    expect(requirement.status).toBe("notified")
  })

  it("does not send for an active lease", async () => {
    const { payload, deliveries } = createPayload()
    deliveries.push({
      id: 55,
      notificationKey: "platform-terms:nl:2026-08-01.1:user:9:mandatory_reaccept:initial:legal-reacceptance-2026-07-11.1",
      status: "processing",
      attemptCount: 1,
      nextAttemptAt: "2026-07-11T11:00:00.000Z",
      leaseUntil: "2026-07-11T12:10:00.000Z",
    })
    await expect(processLegalRequirementNotifications({ payload, now: new Date("2026-07-11T12:00:00.000Z") }))
      .resolves.toMatchObject({ sent: 0, skipped: 1 })
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it("keeps acceptance authoritative when it races with provider delivery", async () => {
    const { payload, requirement, deliveries } = createPayload()
    mocks.sendEmail.mockImplementationOnce(async () => {
      requirement.status = "satisfied"
      const delivery = deliveries[0]
      delivery.status = "cancelled"
      return { provider: "test", providerMessageId: "msg-raced" }
    })
    await processLegalRequirementNotifications({ payload, now: new Date("2026-07-11T12:00:00.000Z") })
    expect(requirement.status).toBe("satisfied")
    expect(deliveries[0].status).toBe("cancelled")
  })

  it("uses explicit initial, reminder, and enforcement windows", () => {
    const mandatory = { action: "mandatory_reaccept", enforceAt: "2026-08-08T00:00:00.000Z" }
    expect(dueFollowupKindForRequirement(mandatory, new Date("2026-07-20T00:00:00.000Z"))).toBe("initial")
    expect(dueFollowupKindForRequirement(mandatory, new Date("2026-08-02T00:00:00.000Z"))).toBe("reminder")
    expect(dueFollowupKindForRequirement(mandatory, new Date("2026-08-08T00:00:00.000Z"))).toBe("enforcement")
    expect(dueFollowupKindForRequirement({ action: "reaccept_on_next_transaction", enforceAt: "2026-08-08T00:00:00.000Z" }, new Date("2026-08-09T00:00:00.000Z"))).toBe("initial")
  })
})
