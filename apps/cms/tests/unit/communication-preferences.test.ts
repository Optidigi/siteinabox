import { beforeEach, describe, expect, it, vi } from "vitest"

import { cast } from "../_helpers/cast"
import { asDocRecord } from "../_helpers/payloadApi"
import type { CommunicationPreference, CommunicationPreferenceEvent } from "@/payload-types"
import { createInitializedTestPayload } from "../_helpers/testPayload"
import { communicationPreferenceFixture, communicationPreferenceEventFixture, paginatedFixture } from "../_helpers/generatedDocs"
import { payloadUpdateFixture } from "../_helpers/payloadUpdateFixture"
vi.mock("server-only", () => ({}))

import { communicationSubjectKey, mutateCommunicationPreference, recordIntakeMarketingPreference } from "@/lib/legal/communicationPreferences"

const createPayload = async (initial?: Partial<CommunicationPreference>) => {
  let preference = initial ? communicationPreferenceFixture(initial) : null
  const events: CommunicationPreferenceEvent[] = []
  const payload = await createInitializedTestPayload()
  vi.spyOn(payload.db, "beginTransaction").mockResolvedValue("tx-1")
  vi.spyOn(payload.db, "commitTransaction").mockResolvedValue(undefined)
  vi.spyOn(payload.db, "rollbackTransaction").mockResolvedValue(undefined)
  vi.spyOn(payload, "find").mockImplementation(async ({ collection, where }) => {
    if (collection === "communication-preferences") {
      const subjectKey = asDocRecord(where?.subjectKey ?? {}).equals
      return paginatedFixture(preference && preference.subjectKey === subjectKey ? [preference] : [])
    }
    if (collection !== "communication-preference-events") throw new Error(`Unexpected collection ${collection}`)
    if (where?.eventKey) return paginatedFixture(events.filter(event => event.eventKey === asDocRecord(where.eventKey ?? {}).equals))
    const clause = where?.and?.find(entry => entry.assertedAt)
    const assertedAfter = asDocRecord(clause?.assertedAt ?? {}).greater_than
    return paginatedFixture(typeof assertedAfter === "string" ? events.filter(event => String(event.assertedAt) > assertedAfter) : [])
  })
  const create = vi.spyOn(payload, "create").mockImplementation(async ({ collection, data }) => {
    if (collection === "communication-preferences") {
      preference = Object.assign(communicationPreferenceFixture(), data)
      return preference
    }
    if (collection !== "communication-preference-events") throw new Error(`Unexpected collection ${collection}`)
    const event = Object.assign(communicationPreferenceEventFixture({ id: events.length + 1 }), data)
    events.push(event)
    return event
  })
  vi.spyOn(payload, "update").mockImplementation(payloadUpdateFixture(async args => {
    if (args.collection !== "communication-preferences" || !preference) throw new Error("Missing preference")
    Object.assign(preference, args.data)
    return args.where ? { docs: [preference], errors: [] } : preference
  }))
  return { payload, create, events, getPreference: () => preference }
}

describe("communication preferences", () => {
  beforeEach(() => vi.clearAllMocks())

  it("records intake assertion time separately from authoritative server time", async () => {
    const { payload, events, getPreference } = await createPayload()
    await recordIntakeMarketingPreference({
      payload, intakeId: "intake-1", email: " Client@Example.nl ", now: new Date("2026-07-12T12:00:00.000Z"),
      legal: cast({ marketingConsent: { granted: true, statementVersion: "marketing-v1", recordedAt: "2026-07-11T10:00:00.000Z" } }),
    })
    expect(getPreference()).toMatchObject({ email: "client@example.nl", marketing: true, updatedAt: "2026-07-12T12:00:00.000Z" })
    expect(events[0]).toMatchObject({ occurredAt: "2026-07-12T12:00:00.000Z", assertedAt: "2026-07-11T10:00:00.000Z", source: "public-intake" })
    expect(payload.db.commitTransaction).toHaveBeenCalledWith("tx-1")
  })

  it("does not clear hard suppression when marketing is opted in", async () => {
    const email = "client@example.nl"
    const { payload, getPreference } = await createPayload({
      id: 1, subjectKey: communicationSubjectKey(email), email, marketing: false,
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
    const { payload, create } = await createPayload()
    create.mockImplementationOnce(async ({ data }) => Object.assign(communicationPreferenceFixture(), data))
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
    const { payload, events, getPreference } = await createPayload({
      id: 1, subjectKey: communicationSubjectKey(email), email, marketing: false,
      statementVersion: "new", updatedAt: "2026-07-12T12:00:00.000Z",
    })
    events.push(communicationPreferenceEventFixture({
      id: 2, eventKey: "intake:new", preference: 1, preferenceType: "marketing",
      action: "opt_out", assertedAt: "2026-07-12T11:00:00.000Z",
    }))
    await recordIntakeMarketingPreference({
      payload, intakeId: "old", email, now: new Date("2026-07-12T13:00:00.000Z"),
      legal: cast({ marketingConsent: { granted: true, statementVersion: "old", recordedAt: "2026-07-11T10:00:00.000Z" } }),
    })
    expect(getPreference()?.marketing).toBe(false)
    expect(events.some((event) => event.eventKey === "intake:old:marketing" && event.action === "opt_in")).toBe(true)
  })
})
