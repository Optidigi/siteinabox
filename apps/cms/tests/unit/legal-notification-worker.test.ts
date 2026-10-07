import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { asRequirementDoc } from "../_helpers/cast"
import type { LegalNotificationDelivery } from "@/payload-types"
import { createInitializedTestPayload } from "../_helpers/testPayload"
import { legalRequirementFixture, legalDocumentFixture, legalNotificationDeliveryFixture, tenantFixture, paginatedFixture } from "../_helpers/generatedDocs"
import { matchesWhere } from "../_helpers/mockPayload"
import { MailSendError } from "@/lib/email/sendEmail"
import { asDocRecord } from "../_helpers/payloadApi"
import { payloadUpdateFixture } from "../_helpers/payloadUpdateFixture"
const mocks = vi.hoisted(() => ({ sendEmail: vi.fn() }))
vi.mock("@/lib/email/sendEmail", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email/sendEmail")>()
  return { ...actual, sendEmail: mocks.sendEmail }
})

import { legalNotificationKey, dueFollowupKindForRequirement, processLegalRequirementNotifications } from "@/lib/jobs/sendLegalRequirementNotifications"

const createPayload = async () => {
  let id = 100
  const requirement = legalRequirementFixture({
    id: 1,
    requirementKey: "platform-terms:nl:2026-08-01.1:user:9:mandatory_reaccept",
    tenant: tenantFixture({ id: 7, name: "Demo Bedrijf", domain: "demo.nl" }),
    subjectEmail: "owner@demo.nl",
    document: legalDocumentFixture({
      id: 10,
      documentType: "platform-terms",
      documentVersion: "2026-08-01.1",
      effectiveAt: "2026-08-08T00:00:00.000Z",
      changeSummary: "De looptijd is aangepast.",
      noticeDays: 30,
      content: "# Algemene voorwaarden\n\nDit is de volledige tekst.",
    }),
    action: "mandatory_reaccept",
    status: "pending",
    enforceAt: "2026-08-08T00:00:00.000Z",
  })
  const deliveries: LegalNotificationDelivery[] = []
  const payload = await createInitializedTestPayload()
  vi.spyOn(payload, "find").mockImplementation(async ({ collection, where }) => {
    if (collection === "legal-requirements") return paginatedFixture([requirement])
    if (collection !== "legal-notification-deliveries") throw new Error(`Unexpected collection ${collection}`)
    const key = asDocRecord(where?.notificationKey ?? {}).equals
    return paginatedFixture(deliveries.filter(item => item.notificationKey === key).map(item => structuredClone(item)))
  })
  vi.spyOn(payload, "create").mockImplementation(async ({ collection, data }) => {
    if (collection !== "legal-notification-deliveries") throw new Error("unexpected collection")
    const row = legalNotificationDeliveryFixture({ id: id++ })
    Object.assign(row, data)
    deliveries.push(row)
    return structuredClone(row)
  })
  vi.spyOn(payload, "update").mockImplementation(payloadUpdateFixture(async args => {
    if (args.collection === "legal-notification-deliveries" && args.where) {
      const row = deliveries.find(item => item.status !== "sent" && item.status !== "cancelled")
      if (!row) return { docs: [], errors: [] }
      Object.assign(row, args.data)
      return { docs: [row], errors: [] }
    }
    const row = args.collection === "legal-requirements" ? requirement : args.collection === "legal-notification-deliveries" ? deliveries.find(item => item.id === args.id) : undefined
    if (!row) throw new Error(`Missing ${args.collection} ${args.id}`)
    Object.assign(row, args.data)
    return row
  }))
  vi.spyOn(payload.db, "updateOne").mockImplementation(async ({ collection, where, data, options }) => {
    if (collection !== "legal-notification-deliveries" || options?.atomic !== true) throw new Error("Expected atomic legal claim")
    const row = deliveries.find(entry => matchesWhere(asDocRecord(entry), where))
    if (!row) return null
    Object.assign(row, data)
    return structuredClone(row)
  })
  vi.spyOn(payload, "findByID").mockResolvedValue(requirement)
  return { payload, requirement, deliveries }
}

afterEach(() => vi.useRealTimers())

describe("legal notification worker", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-11T12:00:00.000Z"))
    mocks.sendEmail.mockReset()
    mocks.sendEmail.mockResolvedValue({ provider: "test", providerMessageId: "msg-1" })
  })

  it("does not resend expired processing mail with durable uncertain acceptance", async () => {
    const { payload, requirement, deliveries } = await createPayload()
    deliveries.push(legalNotificationDeliveryFixture({ id: 100, notificationKey: legalNotificationKey(requirement), requirement: requirement.id,
      status: "processing", attemptCount: 1, retryState: "permanent", lastAttemptAt: "2026-07-11T10:00:00.000Z", leaseUntil: "2026-07-11T10:15:00.000Z", nextAttemptAt: "2026-07-11T10:00:00.000Z",
    }))
    await expect(processLegalRequirementNotifications({ payload, now: new Date("2026-07-11T12:00:00.000Z") })).resolves.toMatchObject({ sent: 0, skipped: 1 })
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it("retains the permanent marker when verified receipt persistence fails", async () => {
    const { payload, deliveries } = await createPayload()
    const atomic = vi.mocked(payload.db.updateOne).getMockImplementation()!
    vi.mocked(payload.db.updateOne).mockImplementation(async args => {
      if (asDocRecord(args.data).status === "sent") throw new Error("receipt persistence unavailable")
      return atomic(args)
    })
    mocks.sendEmail.mockImplementationOnce(async () => {
      expect(deliveries[0]).toMatchObject({ status: "processing", retryState: "permanent" })
      return { provider: "test", providerMessageId: "verified" }
    })
    await expect(processLegalRequirementNotifications({ payload, now: new Date() })).rejects.toThrow("claim could not be verified atomically")
    expect(deliveries[0]).toMatchObject({ status: "processing", retryState: "permanent" })
    vi.setSystemTime(new Date("2026-07-11T13:00:00.000Z"))
    await expect(processLegalRequirementNotifications({ payload, now: new Date() })).resolves.toMatchObject({ sent: 0, skipped: 1 })
    expect(mocks.sendEmail).toHaveBeenCalledOnce()
  })

  it("never replays an indeterminate mail dispatch", async () => {
    const { payload, deliveries } = await createPayload()
    mocks.sendEmail.mockRejectedValueOnce(new MailSendError({ provider: "test", providerErrorCode: "E_PROVIDER_WRITE_INDETERMINATE", providerErrorMessage: "response lost", retryState: "permanent" }))
    await expect(processLegalRequirementNotifications({ payload, now: new Date() })).resolves.toMatchObject({ failed: 1 })
    expect(deliveries[0]).toMatchObject({ status: "failed", retryState: "permanent" })
    vi.setSystemTime(new Date("2026-07-12T13:00:00.000Z"))
    await expect(processLegalRequirementNotifications({ payload, now: new Date() })).resolves.toMatchObject({ sent: 0, skipped: 1 })
    expect(mocks.sendEmail).toHaveBeenCalledOnce()
  })

  it("stops retrying definitive rejections after the existing retry budget", async () => {
    const { payload, deliveries } = await createPayload()
    mocks.sendEmail.mockRejectedValue(new MailSendError({ provider: "test", providerErrorCode: "429", providerErrorMessage: "rejected", retryState: "retryable" }))
    for (let attempt = 1; attempt <= 4; attempt++) {
      await expect(processLegalRequirementNotifications({ payload, now: new Date() })).resolves.toMatchObject({ failed: 1 })
      expect(deliveries[0]?.attemptCount).toBe(attempt)
      if (attempt < 4) vi.setSystemTime(new Date(deliveries[0]!.nextAttemptAt))
    }
    expect(deliveries[0]).toMatchObject({ status: "failed", retryState: "permanent" })
    await expect(processLegalRequirementNotifications({ payload, now: new Date() })).resolves.toMatchObject({ sent: 0, skipped: 1 })
    expect(mocks.sendEmail).toHaveBeenCalledTimes(4)
  })

  it("sends once, records the logical delivery, and marks the requirement notified", async () => {
    const { payload, requirement, deliveries } = await createPayload()
    const now = new Date("2026-07-11T12:00:00.000Z")
    await expect(processLegalRequirementNotifications({ payload: payload, now })).resolves.toMatchObject({ sent: 1, failed: 0 })
    await expect(processLegalRequirementNotifications({ payload: payload, now })).resolves.toMatchObject({ sent: 0, skipped: 1 })
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
    const { payload, requirement, deliveries } = await createPayload()
    mocks.sendEmail.mockRejectedValueOnce(new MailSendError({ provider: "test", providerErrorCode: "429", providerErrorMessage: "provider rejected", retryState: "retryable" }))
    const now = new Date("2026-07-11T12:00:00.000Z")
    await expect(processLegalRequirementNotifications({ payload: payload, now })).resolves.toMatchObject({ sent: 0, failed: 1 })
    expect(requirement.status).toBe("failed")
    expect(deliveries[0]!).toMatchObject({ status: "failed", retryState: "retryable", attemptCount: 1 })
    expect(new Date(String(deliveries[0]!.nextAttemptAt)).getTime()).toBeGreaterThan(now.getTime())
  })

  it("emails a direct notice once without presenting an acceptance action", async () => {
    const { payload, requirement } = await createPayload()
    requirement.action = "direct_notice"
    requirement.enforceAt = null
    await processLegalRequirementNotifications({ payload: payload, now: new Date("2026-07-11T12:00:00.000Z") })
    const message = mocks.sendEmail.mock.calls[0]?.[0]
    expect(message.subject).toContain("Juridische kennisgeving")
    expect(message.html).not.toContain("Bekijk en accepteer")
    expect(requirement.status).toBe("notified")
  })

  it("starts the continued-use objection clock only after successful delivery", async () => {
    const { payload, requirement } = await createPayload()
    requirement.action = "notice_and_continued_use"
    requirement.objectionDeadlineAt = "2026-08-08T00:00:00.000Z"
    requirement.enforceAt = null
    await processLegalRequirementNotifications({ payload: payload, now: new Date("2026-07-11T12:00:00.000Z") })
    expect(requirement).toMatchObject({
      status: "notified",
      notifiedAt: "2026-07-11T12:00:00.000Z",
      noticeDeliveredAt: "2026-07-11T12:00:00.000Z",
    })
    const message = mocks.sendEmail.mock.calls[0]?.[0]
    expect(message.html).toContain("Volledige bijgewerkte voorwaarden")
    expect(message.text).toContain("Dit is de volledige tekst.")
    expect(message.text).not.toContain("Versie: 2026-08-01.1")
    expect(new Date(String(requirement.objectionDeadlineAt)).getTime()).toBeGreaterThanOrEqual(
      new Date("2026-08-10T12:00:00.000Z").getTime(),
    )
  })

  it("sends one reminder before the continued-use objection deadline", async () => {
    const { payload, requirement, deliveries } = await createPayload()
    requirement.action = "notice_and_continued_use"
    requirement.objectionDeadlineAt = "2026-08-10T00:00:00.000Z"
    requirement.enforceAt = null
    await processLegalRequirementNotifications({ payload: payload, now: new Date("2026-07-11T12:00:00.000Z") })
    await processLegalRequirementNotifications({ payload: payload, now: new Date("2026-08-05T12:00:00.000Z") })
    expect(deliveries.map((item) => item.kind)).toEqual(["initial", "reminder"])
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2)
    expect(mocks.sendEmail.mock.calls[1]?.[0].subject).toContain("Herinnering")
  })

  it("redacts recipient data and secrets from persisted provider errors", async () => {
    const { payload, requirement, deliveries } = await createPayload()
    mocks.sendEmail.mockRejectedValueOnce(new Error("owner@demo.nl Bearer secret-token"))
    await processLegalRequirementNotifications({ payload: payload, now: new Date("2026-07-11T12:00:00.000Z") })
    expect(requirement.lastError).toBe("[redacted-email] Bearer [redacted]")
    expect(deliveries[0]!.lastError).toBe("[redacted-email] Bearer [redacted]")
  })

  it("does not start the objection clock after failed delivery", async () => {
    const { payload, requirement } = await createPayload()
    requirement.action = "notice_and_continued_use"
    requirement.objectionDeadlineAt = "2026-08-08T00:00:00.000Z"
    requirement.enforceAt = null
    mocks.sendEmail.mockRejectedValueOnce(new MailSendError({ provider: "test", providerErrorCode: "429", providerErrorMessage: "provider rejected", retryState: "retryable" }))
    await processLegalRequirementNotifications({ payload: payload, now: new Date("2026-07-11T12:00:00.000Z") })
    expect(requirement.status).toBe("failed")
    expect(requirement.noticeDeliveredAt).toBeUndefined()
  })

  it("does not send for an active lease", async () => {
    const { payload, deliveries } = await createPayload()
    deliveries.push(legalNotificationDeliveryFixture({
      id: 55,
      notificationKey: "platform-terms:nl:2026-08-01.1:user:9:mandatory_reaccept:initial:legal-reacceptance-2026-07-11.1",
      status: "processing",
      attemptCount: 1,
      nextAttemptAt: "2026-07-11T11:00:00.000Z",
      leaseUntil: "2026-07-11T12:10:00.000Z",
    }))
    await expect(processLegalRequirementNotifications({ payload: payload, now: new Date("2026-07-11T12:00:00.000Z") }))
      .resolves.toMatchObject({ sent: 0, skipped: 1 })
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it("keeps acceptance authoritative when it races with provider delivery", async () => {
    const { payload, requirement, deliveries } = await createPayload()
    mocks.sendEmail.mockImplementationOnce(async () => {
      requirement.status = "satisfied"
      const delivery = deliveries[0]!
      delivery.status = "cancelled"
      return { provider: "test", providerMessageId: "msg-raced" }
    })
    await processLegalRequirementNotifications({ payload: payload, now: new Date("2026-07-11T12:00:00.000Z") })
    expect(requirement.status).toBe("satisfied")
    expect(deliveries[0]!.status).toBe("cancelled")
  })

  it("uses explicit initial, reminder, and enforcement windows", () => {
    const mandatory = asRequirementDoc({ action: "mandatory_reaccept", enforceAt: "2026-08-08T00:00:00.000Z" })
    expect(dueFollowupKindForRequirement(mandatory, new Date("2026-07-20T00:00:00.000Z"))).toBe("initial")
    expect(dueFollowupKindForRequirement(mandatory, new Date("2026-08-02T00:00:00.000Z"))).toBe("reminder")
    expect(dueFollowupKindForRequirement(mandatory, new Date("2026-08-08T00:00:00.000Z"))).toBe("enforcement")
    expect(dueFollowupKindForRequirement(asRequirementDoc({ action: "reaccept_on_next_transaction", enforceAt: "2026-08-08T00:00:00.000Z" }), new Date("2026-08-09T00:00:00.000Z"))).toBe("initial")
  })
})
