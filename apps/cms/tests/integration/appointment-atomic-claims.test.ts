import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import {
  AppointmentLeaseLostError,
  claimAppointmentCalendarEvent,
  claimAppointmentCalendarOAuthState,
  claimAppointmentNotificationDelivery,
  transitionAppointmentCalendarEvent,
  transitionAppointmentNotificationDelivery,
} from "@/lib/appointments/atomicClaims"
import { ensureAppointmentSideEffects } from "@/lib/appointments/sideEffects"
import { getTestPayload, resetTestData } from "./_helpers"

let payload: Awaited<ReturnType<typeof getTestPayload>>
const leaseMs = 300_000

beforeAll(async () => {
  const uri = new URL(process.env.DATABASE_URI ?? "")
  if (!["postgres:", "postgresql:"].includes(uri.protocol) ||
      !["localhost", "127.0.0.1", "[::1]", "postgres"].includes(uri.hostname) ||
      uri.pathname !== "/payload_test" || process.env.PAYLOAD_DISABLE_JOBS_AUTORUN !== "1" ||
      process.env.SITE_GENERATION_PROVIDER !== "mock") {
    throw new Error("Atomic claims integration requires an isolated payload_test database, disabled jobs and mock Sitegen.")
  }
  payload = await getTestPayload()
}, 60_000)
beforeEach(async () => resetTestData(payload))
afterEach(() => vi.restoreAllMocks())

const fixture = async () => {
  const now = new Date()
  const tenant = await payload.create({ collection: "tenants", overrideAccess: true, data: { name: "Atomic claim fixture", slug: "atomic-claim", domain: "atomic-claim.example.test", status: "active" } })
  const user = await payload.create({ collection: "users", overrideAccess: true, data: { email: "atomic-claim@example.test", password: "synthetic-fixture-password", role: "super-admin" } })
  const appointment = await payload.create({ collection: "appointments", overrideAccess: true, data: { tenant: tenant.id, status: "confirmed", startAt: new Date(now.getTime() + 86400000).toISOString(), endAt: new Date(now.getTime() + 88200000).toISOString(), timezone: "UTC", durationMinutes: 30, visitorName: "Fixture", visitorEmail: "visitor@example.test", source: "website", eventVersion: 1 } })
  const connection = await payload.create({ collection: "appointment-calendar-connections", overrideAccess: true, data: { connectionKey: "atomic-claim-connection", tenant: tenant.id, provider: "google", accountEmail: "calendar@example.test", calendarId: "fixture-calendar", calendarName: "Fixture", scopes: [], connectedBy: user.id, status: "connected" } })
  const calendar = await payload.create({ collection: "appointment-calendar-events", overrideAccess: true, data: { eventKey: `appointment:${appointment.id}:calendar:${connection.id}`, appointment: appointment.id, connection: connection.id, eventVersion: 1, status: "queued", operation: "upsert", attemptCount: 0, nextAttemptAt: new Date(now.getTime() - 60000).toISOString(), providerCreateUncertain: true } })
  const notification = await payload.create({ collection: "appointment-notification-deliveries", overrideAccess: true, data: { notificationKey: "atomic-claim-mail", appointment: appointment.id, tenant: tenant.id, recipientKind: "visitor", kind: "confirmation", eventVersion: 1, templateVersion: "v1", status: "queued", attemptCount: 0, nextAttemptAt: new Date(now.getTime() - 60000).toISOString() } })
  const oauth = await payload.create({ collection: "appointment-calendar-oauth-states", overrideAccess: true, data: { stateDigest: "synthetic-atomic-state", tenant: tenant.id, user: user.id, provider: "google", encryptedCodeVerifier: "synthetic-encrypted-fixture", returnPath: "/appointments", expiresAt: new Date(now.getTime() + 3600000).toISOString() } })
  return { now, calendar, notification, oauth }
}

describe("real Postgres appointment atomic claims", () => {
  it("awards one SQL receipt to eight simultaneous contenders for each claim", async () => {
    const f = await fixture()
    const calendar = await Promise.all(Array.from({ length: 8 }, () => claimAppointmentCalendarEvent(payload, f.calendar, f.now, leaseMs)))
    const notifications = await Promise.all(Array.from({ length: 8 }, () => claimAppointmentNotificationDelivery(payload, f.notification, f.now, leaseMs)))
    const oauth = await Promise.all(Array.from({ length: 8 }, () => claimAppointmentCalendarOAuthState(payload, f.oauth, f.now)))
    expect(calendar.filter(value => value !== null)).toHaveLength(1)
    expect(notifications.filter(value => value !== null)).toHaveLength(1)
    expect(oauth.filter(value => value !== null)).toHaveLength(1)
    expect(await claimAppointmentCalendarEvent(payload, f.calendar, f.now, leaseMs)).toBeNull()
    expect(await claimAppointmentNotificationDelivery(payload, f.notification, f.now, leaseMs)).toBeNull()
    expect(await claimAppointmentCalendarOAuthState(payload, f.oauth, f.now)).toBeNull()
  })

  it("rejects resumed calendar and mail intents/final/failure transitions after an expired lease is reclaimed", async () => {
    const f = await fixture()
    const calendar = await claimAppointmentCalendarEvent(payload, f.calendar, f.now, leaseMs)
    const notification = await claimAppointmentNotificationDelivery(payload, f.notification, f.now, leaseMs)
    if (!calendar || !notification) throw new Error("Expected initial SQL claim receipts")
    const reclaimedAt = new Date(f.now.getTime() + leaseMs + 1)
    const replacementCalendar = await claimAppointmentCalendarEvent(payload, calendar, reclaimedAt, leaseMs)
    const replacementNotification = await claimAppointmentNotificationDelivery(payload, notification, reclaimedAt, leaseMs)
    if (!replacementCalendar || !replacementNotification) throw new Error("Expected expired-lease SQL reclaim receipts")
    expect(replacementCalendar.attemptCount).toBe(2)
    expect(replacementNotification.attemptCount).toBe(2)
    // Keep the old worker's local clock inside its acquired lease so failures
    // exercise the actual SQL exact-lease predicate, not the local expiry guard.
    vi.spyOn(Date, "now").mockReturnValue(f.now.getTime() + 1)
    await expect(transitionAppointmentCalendarEvent(payload, calendar, { providerCreateUncertain: true })).rejects.toBeInstanceOf(AppointmentLeaseLostError)
    await expect(transitionAppointmentCalendarEvent(payload, calendar, { status: "synced", leaseUntil: null, providerEventId: "synthetic-event" })).rejects.toBeInstanceOf(AppointmentLeaseLostError)
    await expect(transitionAppointmentCalendarEvent(payload, calendar, { status: "failed", leaseUntil: null, lastError: "Synthetic old failure" })).rejects.toBeInstanceOf(AppointmentLeaseLostError)
    await expect(transitionAppointmentNotificationDelivery(payload, notification, {})).rejects.toBeInstanceOf(AppointmentLeaseLostError)
    await expect(transitionAppointmentNotificationDelivery(payload, notification, { status: "sent", leaseUntil: null })).rejects.toBeInstanceOf(AppointmentLeaseLostError)
    await expect(transitionAppointmentNotificationDelivery(payload, notification, { status: "failed", leaseUntil: null, lastError: "Synthetic old failure" })).rejects.toBeInstanceOf(AppointmentLeaseLostError)
    expect(await payload.findByID({ collection: "appointment-calendar-events", id: calendar.id, overrideAccess: true, depth: 0 })).toMatchObject({ status: "processing", attemptCount: 2, leaseUntil: replacementCalendar.leaseUntil, providerCreateUncertain: true })
    expect(await payload.findByID({ collection: "appointment-notification-deliveries", id: notification.id, overrideAccess: true, depth: 0 })).toMatchObject({ status: "processing", attemptCount: 2, leaseUntil: replacementNotification.leaseUntil })
    vi.mocked(Date.now).mockReturnValue(reclaimedAt.getTime() + 1)
    await transitionAppointmentCalendarEvent(payload, replacementCalendar, { status: "synced", leaseUntil: null, providerEventId: "synthetic-event", providerCreateUncertain: false })
    await transitionAppointmentNotificationDelivery(payload, replacementNotification, { status: "sent", leaseUntil: null, provider: "fixture" })
    expect(await payload.findByID({ collection: "appointment-calendar-events", id: calendar.id, overrideAccess: true, depth: 0 })).toMatchObject({ status: "synced", attemptCount: 2, providerEventId: "synthetic-event", providerCreateUncertain: false, leaseUntil: null })
    expect(await payload.findByID({ collection: "appointment-notification-deliveries", id: notification.id, overrideAccess: true, depth: 0 })).toMatchObject({ status: "sent", attemptCount: 2, leaseUntil: null })
  })
})


describe("real SQL same-millisecond reenqueue lease identity", () => {
  it("keeps count monotonic when the event version and acquired lease timestamp repeat", async () => {
    const f = await fixture()
    const first = await claimAppointmentCalendarEvent(payload, f.calendar, f.now, leaseMs)
    if (!first) throw new Error("Expected initial SQL receipt")
    await ensureAppointmentSideEffects({ payload, appointmentId: typeof f.calendar.appointment === "number" ? f.calendar.appointment : f.calendar.appointment.id, tenantId: typeof f.notification.tenant === "number" ? f.notification.tenant : f.notification.tenant.id, eventVersion: first.eventVersion, status: "confirmed", now: f.now })
    const queued = await payload.findByID({ collection: "appointment-calendar-events", id: first.id, overrideAccess: true, depth: 0 })
    expect(queued).toMatchObject({ status: "queued", attemptCount: 1, providerCreateUncertain: true, leaseUntil: null })
    const second = await claimAppointmentCalendarEvent(payload, queued, f.now, leaseMs)
    if (!second) throw new Error("Expected requeued SQL receipt")
    expect(second).toMatchObject({ eventVersion: first.eventVersion, attemptCount: 2, leaseUntil: first.leaseUntil })
    vi.spyOn(Date, "now").mockReturnValue(f.now.getTime() + 1)
    await expect(transitionAppointmentCalendarEvent(payload, first, { providerCreateUncertain: true })).rejects.toBeInstanceOf(AppointmentLeaseLostError)
    expect(await payload.findByID({ collection: "appointment-calendar-events", id: first.id, overrideAccess: true, depth: 0 })).toMatchObject({ status: "processing", attemptCount: 2, leaseUntil: second.leaseUntil })
  })
})


describe("mail write uncertainty in real Postgres", () => {
  it("cannot reclaim a dead sender even with its pre-send snapshot at the same timestamp", async () => {
    const f = await fixture()
    const claimed = await claimAppointmentNotificationDelivery(payload, f.notification, f.now, leaseMs)
    if (!claimed) throw new Error("Expected initial mail claim")
    vi.spyOn(Date, "now").mockReturnValue(f.now.getTime())
    await transitionAppointmentNotificationDelivery(payload, claimed, { retryState: "permanent", lastError: "Synthetic uncertain provider write" })
    const expiredAt = new Date(f.now.getTime() + leaseMs + 1)
    // Same updatedAt/lease identity, but the actual SQL row has a write marker.
    expect(await claimAppointmentNotificationDelivery(payload, claimed, expiredAt, leaseMs)).toBeNull()
    const uncertain = await payload.findByID({ collection: "appointment-notification-deliveries", id: claimed.id, depth: 0, overrideAccess: true })
    expect(uncertain).toMatchObject({ status: "processing", retryState: "permanent", attemptCount: 1 })
    expect(await claimAppointmentNotificationDelivery(payload, uncertain, expiredAt, leaseMs)).toBeNull()
  })
})
