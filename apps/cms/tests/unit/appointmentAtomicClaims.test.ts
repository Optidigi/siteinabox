import { postgresAdapter } from "@payloadcms/db-postgres"
import { BasePayload, buildConfig, type Payload } from "payload"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AppointmentCalendarEvent, AppointmentCalendarOauthState, AppointmentNotificationDelivery } from "@/payload-types"
import { AppointmentAtomicClaimError, AppointmentLeaseLostError, transitionAppointmentCalendarEvent, claimAppointmentCalendarEvent, claimAppointmentCalendarOAuthState, claimAppointmentNotificationDelivery } from "@/lib/appointments/atomicClaims"
import { createTestPayload } from "../_helpers/testPayload"


const createAtomicTestPayload = async () => {
  const payload = createTestPayload()
  await payload.init({ config: await buildConfig({ secret: "atomic-claim-fixture-secret", telemetry: false, logger: { options: { level: "silent" } }, typescript: { autoGenerate: false }, db: postgresAdapter({ pool: { connectionString: "postgresql://fixture:fixture@localhost/fixture" } }), collections: [] }), disableDBConnect: true, disableOnInit: true })
  return payload
}

const now = new Date("2026-10-07T10:00:00.000Z")
const timestamps = { createdAt: "2026-10-07T09:00:00.000Z", updatedAt: "2026-10-07T09:00:00.000Z" }
const event: AppointmentCalendarEvent = { id: 1, eventKey: "appointment:2:calendar:3", appointment: 2, connection: 3, eventVersion: 4, status: "queued", operation: "upsert", attemptCount: 0, nextAttemptAt: now.toISOString(), providerCreateUncertain: true, ...timestamps }
const state: AppointmentCalendarOauthState = { id: 2, stateDigest: "synthetic-digest", tenant: 3, user: 4, provider: "google", encryptedCodeVerifier: "synthetic-verifier", returnPath: "/appointments", expiresAt: "2026-10-07T10:10:00.000Z", ...timestamps }
const delivery: AppointmentNotificationDelivery = { id: 3, notificationKey: "appointment:2:4:confirmation:visitor", appointment: 2, tenant: 3, recipientKind: "visitor", kind: "confirmation", eventVersion: 4, templateVersion: "v1", status: "queued", attemptCount: 0, nextAttemptAt: now.toISOString(), ...timestamps }
let payload: Payload
beforeEach(async () => { vi.spyOn(Date, "now").mockReturnValue(now.getTime()); payload = await createAtomicTestPayload() })
afterEach(() => vi.restoreAllMocks())
const leaseMs = 300000
const cases = [
  { name: "calendar", original: event, claim: () => claimAppointmentCalendarEvent(payload, event, now, leaseMs) },
  { name: "OAuth", original: state, claim: () => claimAppointmentCalendarOAuthState(payload, state, now) },
  { name: "notification", original: delivery, claim: () => claimAppointmentNotificationDelivery(payload, delivery, now, leaseMs) },
]

describe("reviewed appointment atomic adapter claims", () => {
  it.each(cases)("uses the actual Postgres adapter and atomic scalar predicate for $name", async test => {
    const spy = vi.spyOn(payload.db, "updateOne").mockImplementation(async options => ({ ...test.original, ...options.data }))
    expect(await test.claim()).toMatchObject({ id: test.original.id })
    expect(payload).toBeInstanceOf(BasePayload); expect(payload.db.name).toBe("postgres")
    expect(spy.mock.calls[0]?.[0]).toMatchObject({ options: { atomic: true }, returning: true })
    expect(spy.mock.calls[0]?.[0]).not.toHaveProperty("id")
    expect(spy.mock.calls[0]?.[0].where).toMatchObject({ and: expect.arrayContaining([{ id: { equals: test.original.id } }, { updatedAt: { equals: test.original.updatedAt } }]) })
  })
  it.each(cases)("accepts only one receipt from concurrent $name claim calls", async test => {
    let awarded = false
    const spy = vi.spyOn(payload.db, "updateOne").mockImplementation(async options => {
      await Promise.resolve()
      if (awarded) return null
      awarded = true
      return { ...test.original, ...options.data }
    })
    const receipts = await Promise.all([test.claim(), test.claim()])
    expect(receipts.filter(value => value !== null)).toHaveLength(1)
    expect(spy).toHaveBeenCalledTimes(2)
    // This tests our receipt path, not SQL isolation. Root runs real PG concurrency.
  })
  it.each(cases)("treats adapter null as unclaimed for $name", async test => {
    vi.spyOn(payload.db, "updateOne").mockResolvedValue(null)
    expect(await test.claim()).toBeNull()
  })
  it.each(cases)("rejects wrong returned identity for $name", async test => {
    vi.spyOn(payload.db, "updateOne").mockImplementation(async options => ({ ...test.original, ...options.data, id: 999 }))
    await expect(test.claim()).rejects.toBeInstanceOf(AppointmentAtomicClaimError)
  })
  it.each(cases)("rejects malformed claim receipt for $name", async test => {
    vi.spyOn(payload.db, "updateOne").mockResolvedValue({ id: test.original.id })
    await expect(test.claim()).rejects.toThrow("could not be verified atomically")
  })
  it.each(cases)("rejects mismatched claim metadata for $name", async test => {
    vi.spyOn(payload.db, "updateOne").mockImplementation(async options => ({ ...test.original, ...options.data, updatedAt: "2026-10-07T10:01:00.000Z" }))
    await expect(test.claim()).rejects.toBeInstanceOf(AppointmentAtomicClaimError)
  })
  it("preserves create uncertainty and rejects a changed operation identity", async () => {
    const spy = vi.spyOn(payload.db, "updateOne").mockImplementationOnce(async options => ({ ...event, ...options.data })).mockImplementationOnce(async options => ({ ...event, ...options.data, providerCreateUncertain: false }))
    expect(await claimAppointmentCalendarEvent(payload, event, now, leaseMs)).toMatchObject({ providerCreateUncertain: true })
    await expect(claimAppointmentCalendarEvent(payload, event, now, leaseMs)).rejects.toBeInstanceOf(AppointmentAtomicClaimError)
    expect(spy).toHaveBeenCalledTimes(2)
  })
  it("includes exact version/count and due/expired-lease guards for outbox claims", async () => {
    const spy = vi.spyOn(payload.db, "updateOne").mockResolvedValue(null)
    await claimAppointmentCalendarEvent(payload, event, now, leaseMs)
    expect(spy.mock.calls[0]?.[0].where).toMatchObject({ and: expect.arrayContaining([
      { eventVersion: { equals: 4 } }, { attemptCount: { equals: 0 } },
      { or: [
        { and: [{ status: { in: ["queued", "failed"] } }, { nextAttemptAt: { less_than_equal: now.toISOString() } }] },
        { and: [{ status: { equals: "processing" } }, { leaseUntil: { less_than_equal: now.toISOString() } }] },
      ] },
    ]) })
  })
  it("fails closed when the actual Payload instance has no initialized adapter", async () => {
    const uninitialized = new BasePayload()
    const bulk = vi.spyOn(uninitialized, "update")
    await expect(claimAppointmentCalendarEvent(uninitialized, event, now, leaseMs)).rejects.toBeInstanceOf(AppointmentAtomicClaimError)
    expect(bulk).not.toHaveBeenCalled()
  })
  it("fails closed for an unsupported adapter and never uses Local API fallback", async () => {
    payload.db.name = "unsupported-fixture"
    const atomic = vi.spyOn(payload.db, "updateOne"); const bulk = vi.spyOn(payload, "update")
    await expect(claimAppointmentCalendarEvent(payload, event, now, leaseMs)).rejects.toBeInstanceOf(AppointmentAtomicClaimError)
    expect(atomic).not.toHaveBeenCalled(); expect(bulk).not.toHaveBeenCalled()
  })
  it("fails closed when atomic adapter method is missing", async () => {
    Reflect.deleteProperty(payload.db, "updateOne")
    await expect(claimAppointmentCalendarOAuthState(payload, state, now)).rejects.toBeInstanceOf(AppointmentAtomicClaimError)
  })
})


describe("exact acquired calendar lease transition fence", () => {
  const claimed: AppointmentCalendarEvent = { ...event, status: "processing", attemptCount: 1, leaseUntil: "2026-10-07T10:05:00.000Z", lastAttemptAt: now.toISOString(), updatedAt: now.toISOString() }
  it("requires the exact acquired version/count/lease and an unexpired processing lease", async () => {
    const spy = vi.spyOn(payload.db, "updateOne").mockImplementation(async options => ({ ...claimed, ...options.data }))
    await transitionAppointmentCalendarEvent(payload, claimed, { providerCreateUncertain: true })
    expect(spy.mock.calls[0]?.[0]).toMatchObject({ options: { atomic: true }, where: { and: expect.arrayContaining([
      { id: { equals: claimed.id } }, { status: { equals: "processing" } },
      { eventVersion: { equals: claimed.eventVersion } }, { attemptCount: { equals: claimed.attemptCount } },
      { leaseUntil: { equals: claimed.leaseUntil } }, { leaseUntil: { greater_than: now.toISOString() } },
    ]) } })
  })
  it("fails closed without writing when the lease expires at the exact current millisecond", async () => {
    vi.mocked(Date.now).mockReturnValue(Date.parse(claimed.leaseUntil ?? ""))
    const spy = vi.spyOn(payload.db, "updateOne")
    await expect(transitionAppointmentCalendarEvent(payload, claimed, {})).rejects.toBeInstanceOf(AppointmentLeaseLostError)
    expect(spy).not.toHaveBeenCalled()
  })
  it("does not fall back when the acquired lease was replaced", async () => {
    const spy = vi.spyOn(payload.db, "updateOne").mockResolvedValue(null)
    const local = vi.spyOn(payload, "update")
    await expect(transitionAppointmentCalendarEvent(payload, claimed, { status: "failed", leaseUntil: null, lastError: "synthetic" })).rejects.toBeInstanceOf(AppointmentLeaseLostError)
    expect(spy).toHaveBeenCalledOnce(); expect(local).not.toHaveBeenCalled()
  })
  it.each([{ id: 999 }, { eventVersion: 999 }, { attemptCount: 2 }, { leaseUntil: "2026-10-07T10:10:00.000Z" }, { providerCreateUncertain: false }])("rejects a transition receipt with changed owned metadata %j", async changed => {
    vi.spyOn(payload.db, "updateOne").mockImplementation(async options => ({ ...claimed, ...options.data, ...changed }))
    await expect(transitionAppointmentCalendarEvent(payload, claimed, { providerCreateUncertain: true })).rejects.toBeInstanceOf(AppointmentAtomicClaimError)
  })
})


describe("notification write uncertainty survives a dead worker", () => {
  it("does not reclaim an expired lease after mail may have been sent", async () => {
    const uncertain: AppointmentNotificationDelivery = { ...delivery, status: "processing", attemptCount: 1, retryState: "permanent", leaseUntil: "2026-10-07T09:59:59.000Z" }
    const spy = vi.spyOn(payload.db, "updateOne").mockImplementation(async options => ({ ...uncertain, ...options.data }))
    expect(await claimAppointmentNotificationDelivery(payload, uncertain, now, leaseMs)).toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })
})
