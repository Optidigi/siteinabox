import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { communicationSubjectKey, mutateCommunicationPreference, recordIntakeMarketingPreference } from "@/lib/legal/communicationPreferences"

const createPayload = (initial?: Record<string, any>) => {
  let preference = initial ?? null
  const events: Record<string, any>[] = []
  const payload = {
    db: { beginTransaction: vi.fn(async () => "tx-1"), commitTransaction: vi.fn(), rollbackTransaction: vi.fn() },
    find: vi.fn(async ({ collection, where }: any) => {
      if (collection === "communication-preferences") {
        return { docs: preference && preference.subjectKey === where.subjectKey.equals ? [preference] : [] }
      }
      if (where.eventKey) {
        const docs = events.filter((event) => event.eventKey === where.eventKey.equals)
        return { docs, totalDocs: docs.length }
      }
      const assertedAfter = where.and?.find((clause: any) => clause.assertedAt)?.assertedAt?.greater_than
      const docs = assertedAfter ? events.filter((event) => event.assertedAt > assertedAfter) : []
      return { docs, totalDocs: docs.length }
    }),
    create: vi.fn(async ({ collection, data }: any) => {
      if (collection === "communication-preferences") preference = { id: "pref-1", ...data }
      else events.push({ id: `event-${events.length + 1}`, ...data })
      return collection === "communication-preferences" ? preference : events.at(-1)
    }),
    update: vi.fn(async ({ data }: any) => {
      preference = { ...preference, ...data }
      return { docs: [preference] }
    }),
  } as any
  return { payload, events, getPreference: () => preference }
}

describe("communication preferences", () => {
  beforeEach(() => vi.clearAllMocks())

  it("records intake assertion time separately from authoritative server time", async () => {
    const { payload, events, getPreference } = createPayload()
    await recordIntakeMarketingPreference({
      payload, intakeId: "intake-1", email: " Client@Example.nl ", now: new Date("2026-07-12T12:00:00.000Z"),
      legal: { marketingConsent: { granted: true, statementVersion: "marketing-v1", recordedAt: "2026-07-11T10:00:00.000Z" } } as any,
    })
    expect(getPreference()).toMatchObject({ email: "client@example.nl", marketing: true, updatedAt: "2026-07-12T12:00:00.000Z" })
    expect(events[0]).toMatchObject({ occurredAt: "2026-07-12T12:00:00.000Z", assertedAt: "2026-07-11T10:00:00.000Z", source: "public-intake" })
    expect(payload.db.commitTransaction).toHaveBeenCalledWith("tx-1")
  })

  it("does not clear hard suppression when marketing is opted in", async () => {
    const email = "client@example.nl"
    const { payload, getPreference } = createPayload({
      id: "pref-1", subjectKey: communicationSubjectKey(email), email, marketing: false,
      suppressed: true, suppressionReason: "provider_complaint", statementVersion: "old", updatedAt: "2026-01-01T00:00:00.000Z",
    })
    await mutateCommunicationPreference({
      payload, email, mutation: { type: "marketing", enabled: true },
      evidence: { eventKey: "settings:1", statementVersion: "v2", statementText: "Ja", source: "tenant-settings" },
      now: new Date("2026-07-12T12:00:00.000Z"),
    })
    expect(getPreference()).toMatchObject({ marketing: true, suppressed: true, suppressionReason: "provider_complaint" })
  })

  it("rolls back preference and evidence together when event creation fails", async () => {
    const { payload } = createPayload()
    payload.create.mockImplementationOnce(async ({ data }: any) => ({ id: "pref-1", ...data }))
      .mockRejectedValueOnce(new Error("event failed"))
    await expect(mutateCommunicationPreference({
      payload, email: "client@example.nl", mutation: { type: "marketing", enabled: false },
      evidence: { eventKey: "unsubscribe:1", statementVersion: "v1", statementText: "Afmelden", source: "email-unsubscribe" },
    })).rejects.toThrow("event failed")
    expect(payload.db.rollbackTransaction).toHaveBeenCalledWith("tx-1")
    expect(payload.db.commitTransaction).not.toHaveBeenCalled()
  })

  it("records but does not apply an older delayed intake decision", async () => {
    const email = "client@example.nl"
    const { payload, events, getPreference } = createPayload({
      id: "pref-1", subjectKey: communicationSubjectKey(email), email, marketing: false,
      statementVersion: "new", updatedAt: "2026-07-12T12:00:00.000Z",
    })
    events.push({
      id: "event-new", eventKey: "intake:new", preference: "pref-1", preferenceType: "marketing",
      action: "opt_out", assertedAt: "2026-07-12T11:00:00.000Z",
    })
    await recordIntakeMarketingPreference({
      payload, intakeId: "old", email, now: new Date("2026-07-12T13:00:00.000Z"),
      legal: { marketingConsent: { granted: true, statementVersion: "old", recordedAt: "2026-07-11T10:00:00.000Z" } } as any,
    })
    expect(getPreference()?.marketing).toBe(false)
    expect(events.some((event) => event.eventKey === "intake:old:marketing" && event.action === "opt_in")).toBe(true)
  })
})
