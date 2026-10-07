import { postgresAdapter } from "@payloadcms/db-postgres"
import { createHash } from "node:crypto"
import { buildConfig, type Payload } from "payload"
import type { Appointment, AppointmentCalendarConnection, AppointmentCalendarEvent, AppointmentCalendarOauthState } from "@/payload-types"
import { createTestPayload } from "../_helpers/testPayload"
import { paginatedFixture, userFixture } from "../_helpers/generatedDocs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ensureAppointmentSideEffects } from "@/lib/appointments/sideEffects"
import { completeCalendarAuthorization, disconnectCalendarConnection, processAppointmentCalendarEvents } from "@/lib/appointments/calendar"


const createAtomicTestPayload = async () => {
  const payload = createTestPayload()
  await payload.init({ config: await buildConfig({ secret: "atomic-claim-fixture-secret", telemetry: false, logger: { options: { level: "silent" } }, typescript: { autoGenerate: false }, db: postgresAdapter({ pool: { connectionString: "postgresql://fixture:fixture@localhost/fixture" } }), collections: [] }), disableDBConnect: true, disableOnInit: true })
  return payload
}

let adapterPayload: Payload
beforeEach(async () => { vi.spyOn(Date, "now").mockReturnValue(now.getTime()); adapterPayload = await createAtomicTestPayload() })
vi.mock("@/lib/appointments/secrets", () => ({ openAppointmentSecret: (value: string) => value, sealAppointmentSecret: (value: string) => value }))
const now = new Date("2026-10-07T10:00:00.000Z")
const key = "appointment:1:calendar:2"
const expectedId = `siab${createHash("sha256").update(key).digest("hex").slice(0, 48)}`
const googleEvent = { id: expectedId, status: "confirmed", summary: "Afspraak: Visitor", description: "Afspraak via de website.", start: { dateTime: "2026-10-08T10:00:00.000Z", timeZone: "UTC" }, end: { dateTime: "2026-10-08T11:00:00.000Z", timeZone: "UTC" } }
type CalendarDocument = Appointment | AppointmentCalendarConnection | AppointmentCalendarEvent | AppointmentCalendarOauthState
type UpdateOverloads = Payload["update"] extends { (...args: infer ManyArgs): infer ManyResult; (...args: infer OneArgs): infer OneResult } ? { manyArgs: ManyArgs; manyResult: ManyResult; oneArgs: OneArgs; oneResult: OneResult } : never
type UpdateOptions = UpdateOverloads["manyArgs"][0] | UpdateOverloads["oneArgs"][0]
type UpdateOutcome = Awaited<UpdateOverloads["manyResult"] | UpdateOverloads["oneResult"]>
// Preserve both installed overloads and their real runtime return shapes.
function updateFixture(handler: (options: UpdateOptions) => Promise<UpdateOutcome>) {
  function update(...args: UpdateOverloads["manyArgs"]): UpdateOverloads["manyResult"]
  function update(...args: UpdateOverloads["oneArgs"]): UpdateOverloads["oneResult"]
  function update(options: UpdateOptions): Promise<UpdateOutcome> { return handler(options) }
  return update
}
const timestamps = { createdAt: now.toISOString(), updatedAt: now.toISOString() }
const appointmentFixture = (patch: Partial<Appointment> = {}): Appointment => ({ id: 1, tenant: 1, status: "confirmed", eventVersion: 1, visitorName: "Visitor", visitorEmail: "fixture@example.test", durationMinutes: 60, source: "website", startAt: "2026-10-08T10:00:00.000Z", endAt: "2026-10-08T11:00:00.000Z", timezone: "UTC", ...timestamps, ...patch })
const connectionFixture = (patch: Partial<AppointmentCalendarConnection> = {}): AppointmentCalendarConnection => ({ id: 2, tenant: 1, connectionKey: "1:google", provider: "google", accountEmail: "fixture@example.test", calendarId: "calendar-fixture", calendarName: "Fixture", status: "connected", scopes: [], connectedBy: 2, encryptedAccessToken: "synthetic-token", encryptedRefreshToken: "synthetic-refresh", accessTokenExpiresAt: "2026-10-09T10:00:00.000Z", ...timestamps, ...patch })
const eventFixture = (patch: Partial<AppointmentCalendarEvent> = {}): AppointmentCalendarEvent => ({ id: 3, appointment: 1, connection: 2, eventKey: key, status: "queued", eventVersion: 1, attemptCount: 0, operation: "upsert", nextAttemptAt: now.toISOString(), ...timestamps, ...patch })
const stateFixture = (provider: "google" | "microsoft"): AppointmentCalendarOauthState => ({ id: 7, tenant: 1, user: 2, provider, stateDigest: createHash("sha256").update("a".repeat(43)).digest("hex"), encryptedCodeVerifier: "synthetic-verifier", returnPath: "/appointments", expiresAt: new Date(now.getTime() + 60000).toISOString(), ...timestamps })
function fixture(options: { provider?: "google" | "microsoft"; providerEventId?: string; operation?: "upsert" | "delete"; expired?: boolean } = {}) {
  const event = eventFixture({ operation: options.operation ?? "upsert", providerEventId: options.providerEventId })
  const appointment = appointmentFixture({ status: options.operation === "delete" ? "cancelled" : "confirmed" })
  const connection = connectionFixture({ provider: options.provider ?? "google", accessTokenExpiresAt: options.expired ? now.toISOString() : "2026-10-09T10:00:00.000Z" })
  const payload = adapterPayload
  vi.spyOn(payload, "find").mockImplementation(async ({ collection }) => paginatedFixture<CalendarDocument>(collection === "appointments" ? [{ ...appointment }] : collection === "appointment-calendar-connections" ? [{ ...connection }] : [{ ...event }]))
  vi.spyOn(payload, "update").mockImplementation(updateFixture(async options => {
    const target = options.collection === "appointment-calendar-events" ? event : connection
    Object.assign(target, options.data)
    return "id" in options ? target : { docs: [target], errors: [] }
  }))
  vi.spyOn(payload.db, "updateOne").mockImplementation(async options => {
    const target = options.collection === "appointment-calendar-events" ? event : connection
    Object.assign(target, options.data)
    return { ...target }
  })
  return { payload, event, connection }
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers() })
describe("calendar provider boundary through durable worker", () => {
  it.each([{}, { id: "wrong-event" }, [], { id: expectedId, status: "cancelled" }])("fails closed on malformed or wrong Google create identity %j", async body => {
    const f = fixture(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body)))
    expect(await processAppointmentCalendarEvents({ payload: f.payload, now })).toMatchObject({ synced: 0, failed: 1 })
    expect(f.event.providerEventId).toBeUndefined()
    expect(f.event.nextAttemptAt).not.toBe("9999-12-31T00:00:00.000Z")
  })
  it("rejects malformed PATCH success instead of recording supplied identity", async () => {
    const f = fixture({ providerEventId: expectedId }); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({})))
    expect(await processAppointmentCalendarEvents({ payload: f.payload, now })).toMatchObject({ synced: 0, failed: 1 })
  })
  it("reconciles duplicate deterministic Google create with exact event content", async () => {
    const f = fixture(); const fetch = vi.fn().mockResolvedValueOnce(Response.json({}, { status: 409 })).mockResolvedValueOnce(Response.json(googleEvent)); vi.stubGlobal("fetch", fetch)
    expect(await processAppointmentCalendarEvents({ payload: f.payload, now })).toMatchObject({ synced: 1, failed: 0 })
    expect(fetch.mock.calls[1]?.[0]).toContain(`/events/${expectedId}`)
    expect(f.event.providerEventId).toBe(expectedId)
  })
  it("schedules 429 writes without replaying the write", async () => {
    const f = fixture(); const fetch = vi.fn().mockResolvedValue(Response.json({}, { status: 429 })); vi.stubGlobal("fetch", fetch)
    await processAppointmentCalendarEvents({ payload: f.payload, now })
    expect(fetch).toHaveBeenCalledOnce(); expect(f.event.nextAttemptAt).toBe("2026-10-07T10:01:00.000Z")
  })
  it("rejects invalid refresh token shape before sealing credentials", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "fixture"); vi.stubEnv("GOOGLE_CLIENT_SECRET", "fixture")
    const f = fixture({ expired: true }); const fetch = vi.fn().mockResolvedValue(Response.json({ access_token: "synthetic", refresh_token: {}, expires_in: 3600, token_type: "Bearer" })); vi.stubGlobal("fetch", fetch)
    expect(await processAppointmentCalendarEvents({ payload: f.payload, now })).toMatchObject({ synced: 0, failed: 1 })
    expect(f.connection.encryptedRefreshToken).toBe("synthetic-refresh"); expect(fetch).toHaveBeenCalledOnce()
  })
})

const graphEvent = { id: "opaque-graph-id", transactionId: expectedId, isCancelled: false, subject: googleEvent.summary, body: { contentType: "text", content: googleEvent.description }, start: { dateTime: "2026-10-08T10:00:00.000", timeZone: "UTC" }, end: { dateTime: "2026-10-08T11:00:00.000", timeZone: "UTC" } }
describe("calendar transport and uncertainty", () => {
  it.each(["google", "microsoft"] as const)("accepts only documented DELETE204 for %s", async provider => {
    const f = fixture({ provider, operation: "delete", providerEventId: provider === "google" ? expectedId : "opaque-id" }); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
    expect(await processAppointmentCalendarEvents({ payload: f.payload, now })).toMatchObject({ synced: 1 })
    expect(f.event.providerEventId).toBeNull()
  })
  it.each([200, 201, 205, 202])("rejects unexpected DELETE status %s", async status => {
    const f = fixture({ operation: "delete", providerEventId: expectedId }); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })))
    expect(await processAppointmentCalendarEvents({ payload: f.payload, now })).toMatchObject({ failed: 1, synced: 0 }); expect(f.event.providerEventId).toBe(expectedId)
  })
  it.each(["not-json synthetic-private", JSON.stringify({ private: "x".repeat(524289) })])("bounds malformed and oversized response bodies", async body => {
    const f = fixture(); const fetch = vi.fn().mockResolvedValue(new Response(body)); vi.stubGlobal("fetch", fetch)
    expect(await processAppointmentCalendarEvents({ payload: f.payload, now })).toMatchObject({ failed: 1, synced: 0 }); expect(fetch).toHaveBeenCalledOnce(); expect(String(f.event.lastError)).not.toContain("synthetic-private")
  })
  it("aborts stalled response body on the full request deadline", async () => {
    vi.useFakeTimers({ now }); const f = fixture(); const cancel = vi.fn(); const fetch = vi.fn().mockResolvedValue(new Response(new ReadableStream({ cancel }))); vi.stubGlobal("fetch", fetch)
    const pending = processAppointmentCalendarEvents({ payload: f.payload, now }); await vi.advanceTimersByTimeAsync(10001)
    expect(await pending).toMatchObject({ failed: 1, synced: 0 }); expect(cancel).toHaveBeenCalledOnce(); expect(fetch).toHaveBeenCalledOnce()
  })
  it("propagates cancellation into a pending write without replay", async () => {
    const f = fixture(); const controller = new AbortController(); const fetch = vi.fn(() => { controller.abort(); return new Promise<Response>(() => {}) }); vi.stubGlobal("fetch", fetch)
    expect(await processAppointmentCalendarEvents({ payload: f.payload, now, signal: controller.signal })).toMatchObject({ failed: 1, synced: 0 }); expect(fetch).toHaveBeenCalledOnce()
  })
  it("does not send provider requests after prior cancellation", async () => {
    const f = fixture(); const controller = new AbortController(); controller.abort(); const fetch = vi.fn(); vi.stubGlobal("fetch", fetch)
    await processAppointmentCalendarEvents({ payload: f.payload, now, signal: controller.signal }); expect(fetch).not.toHaveBeenCalled()
  })
  it("blocks Graph replay after a lost write response while preserving transaction identity", async () => {
    const f = fixture({ provider: "microsoft" }); const fetch = vi.fn().mockRejectedValueOnce(new Error("synthetic-private transport")).mockResolvedValueOnce(Response.json(graphEvent, { status: 201 })); vi.stubGlobal("fetch", fetch)
    expect(await processAppointmentCalendarEvents({ payload: f.payload, now })).toMatchObject({ failed: 1 }); expect(f.event.providerEventId).toBeUndefined()
    expect(await processAppointmentCalendarEvents({ payload: f.payload, now: new Date(now.getTime() + 60000) })).toMatchObject({ failed: 1, synced: 0 })
    expect(fetch).toHaveBeenCalledOnce(); expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body)).transactionId).toBe(expectedId); expect(f.event.providerCreateUncertain).toBe(true); expect(f.event.lastError).toContain("reconciliation is required")
  })
  it.each([{ ...graphEvent, transactionId: "wrong" }, { ...graphEvent, id: "" }, { ...graphEvent, isCancelled: true }, { ...graphEvent, start: { ...graphEvent.start, timeZone: "Unknown" } }])("rejects wrong Graph event authority %j", async body => {
    const f = fixture({ provider: "microsoft" }); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body, { status: 201 })))
    expect(await processAppointmentCalendarEvents({ payload: f.payload, now })).toMatchObject({ failed: 1, synced: 0 }); expect(f.event.providerEventId).toBeUndefined()
  })
  it("fails closed when duplicate Google event content differs", async () => {
    const f = fixture(); const fetch = vi.fn().mockResolvedValueOnce(Response.json({}, { status: 409 })).mockResolvedValueOnce(Response.json({ ...googleEvent, summary: "Another appointment" })); vi.stubGlobal("fetch", fetch)
    expect(await processAppointmentCalendarEvents({ payload: f.payload, now })).toMatchObject({ failed: 1, synced: 0 }); expect(f.event.providerEventId).toBeUndefined()
  })
  it("retries only reconciliation GET on 5xx", async () => {
    const f = fixture(); const fetch = vi.fn().mockResolvedValueOnce(Response.json({}, { status: 409 })).mockResolvedValueOnce(Response.json({}, { status: 503 })).mockResolvedValueOnce(Response.json(googleEvent)); vi.stubGlobal("fetch", fetch)
    expect(await processAppointmentCalendarEvents({ payload: f.payload, now })).toMatchObject({ synced: 1 }); expect(fetch.mock.calls.map(call => call[1]?.method ?? "GET")).toEqual(["POST", "GET", "GET"])
  })
  it.each([503, 429])("does not replay transient token POST %s", async status => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "fixture"); vi.stubEnv("GOOGLE_CLIENT_SECRET", "fixture"); const f = fixture({ expired: true }); const fetch = vi.fn().mockResolvedValue(Response.json({}, { status })); vi.stubGlobal("fetch", fetch)
    await processAppointmentCalendarEvents({ payload: f.payload, now }); expect(fetch).toHaveBeenCalledOnce(); expect(f.event.nextAttemptAt).toBe("2026-10-07T10:01:00.000Z")
  })
  it.each([{ access_token: 1 }, { token_type: "Basic" }, { expires_in: -1 }, { expires_in: "3600" }, { expires_in: 1e30 }, { refresh_token: {} }])("rejects malformed token fields %j", async fields => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "fixture"); vi.stubEnv("GOOGLE_CLIENT_SECRET", "fixture"); const f = fixture({ expired: true }); const fetch = vi.fn().mockResolvedValue(Response.json({ access_token: "synthetic-token", token_type: "Bearer", expires_in: 3600, ...fields })); vi.stubGlobal("fetch", fetch)
    expect(await processAppointmentCalendarEvents({ payload: f.payload, now })).toMatchObject({ failed: 1, synced: 0 }); expect(fetch).toHaveBeenCalledOnce(); expect(f.connection.encryptedAccessToken).toBe("synthetic-token")
  })
})

function authorizationFixture(provider: "google" | "microsoft") {
  const state = stateFixture(provider)
  const payload = adapterPayload
  vi.spyOn(payload, "auth").mockResolvedValue({ user: userFixture({ id: 2, role: "owner", tenants: [{ tenant: 1 }] }), permissions: {} })
  vi.spyOn(payload, "find").mockImplementation(async ({ collection }) => paginatedFixture<CalendarDocument>(collection === "appointment-calendar-oauth-states" ? [{ ...state }] : []))
  vi.spyOn(payload.db, "updateOne").mockImplementation(async options => ({ ...state, ...options.data }))
  const create = vi.spyOn(payload, "create").mockResolvedValue(connectionFixture({ id: 8 }))
  const env = { NODE_ENV: "production" as const, GOOGLE_CLIENT_ID: "fixture", GOOGLE_CLIENT_SECRET: "fixture", MICROSOFT_CLIENT_ID: "fixture", MICROSOFT_CLIENT_SECRET: "fixture", SIAB_GOOGLE_CALENDAR_CALLBACK_HOSTS: "fixture.example", SIAB_MICROSOFT_CALENDAR_CALLBACK_HOSTS: "fixture.example" }
  return { create, input: { payload, provider, state: "a".repeat(43), code: "synthetic-code", headers: new Headers({ host: "fixture.example" }), env, now } }
}
const validToken = { access_token: "synthetic-token", refresh_token: "synthetic-refresh", token_type: "Bearer", expires_in: 3600 }
const graphBase = "https://graph.microsoft.com/v1.0/me/calendars?$select=id,name,isDefaultCalendar,canEdit&$top=100"
describe("calendar discovery consumed schemas and pagination", () => {
  it.each([{}, { value: [{ id: "fixture", name: "Fixture", isDefaultCalendar: true }] }, { value: [{ id: "fixture", name: "Fixture", isDefaultCalendar: true, canEdit: "true" }] }])("does not grant calendar write authority from malformed capability %j", async body => {
    const f = authorizationFixture("microsoft"); vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json(validToken)).mockResolvedValueOnce(Response.json({ mail: "fixture@example.test" })).mockResolvedValueOnce(Response.json(body)))
    await expect(completeCalendarAuthorization(f.input)).rejects.toMatchObject({ statusCode: 503 }); expect(f.create).not.toHaveBeenCalled()
  })
  it.each(["https://evil.example/steal", "https://credentials@graph.microsoft.com/v1.0/me/calendars", `${graphBase}&$filter=secret`, `${graphBase}&$select=token`, `${graphBase}#fragment`, graphBase])("rejects hostile or looping pagination before sending credentials %s", async link => {
    const f = authorizationFixture("microsoft"); const fetch = vi.fn().mockResolvedValueOnce(Response.json(validToken)).mockResolvedValueOnce(Response.json({ mail: "fixture@example.test" })).mockResolvedValueOnce(Response.json({ value: [{ id: "fixture", name: "Fixture", isDefaultCalendar: false, canEdit: true }], "@odata.nextLink": link })); vi.stubGlobal("fetch", fetch)
    await expect(completeCalendarAuthorization(f.input)).rejects.toMatchObject({ statusCode: 503 }); expect(fetch).toHaveBeenCalledTimes(3); expect(f.create).not.toHaveBeenCalled()
  })
  it("follows an exact Graph calendar continuation and selects the writable default", async () => {
    const f = authorizationFixture("microsoft"); const fetch = vi.fn().mockResolvedValueOnce(Response.json(validToken)).mockResolvedValueOnce(Response.json({ mail: "fixture@example.test" })).mockResolvedValueOnce(Response.json({ value: [], "@odata.nextLink": `${graphBase}&$skiptoken=opaque` })).mockResolvedValueOnce(Response.json({ value: [{ id: "default", name: "Default", canEdit: true, isDefaultCalendar: true }] })); vi.stubGlobal("fetch", fetch)
    expect(await completeCalendarAuthorization(f.input)).toMatchObject({ calendarName: "Default" }); expect(f.create).toHaveBeenCalledOnce()
  })
  it("rejects unknown Google calendar authority", async () => {
    const f = authorizationFixture("google"); vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json(validToken)).mockResolvedValueOnce(Response.json({ email: "fixture@example.test" })).mockResolvedValueOnce(Response.json({ items: [{ id: "fixture", accessRole: "future-authority", primary: true }] })))
    await expect(completeCalendarAuthorization(f.input)).rejects.toMatchObject({ statusCode: 503 }); expect(f.create).not.toHaveBeenCalled()
  })
  it("bounds repeated Google page tokens without manufacturing absence", async () => {
    const f = authorizationFixture("google"); const fetch = vi.fn().mockResolvedValueOnce(Response.json(validToken)).mockResolvedValueOnce(Response.json({ email: "fixture@example.test" })).mockImplementation(async () => Response.json({ items: [], nextPageToken: "same-token" })); vi.stubGlobal("fetch", fetch)
    await expect(completeCalendarAuthorization(f.input)).rejects.toMatchObject({ statusCode: 503 }); expect(fetch).toHaveBeenCalledTimes(4); expect(f.create).not.toHaveBeenCalled()
  })
})

describe("durable create uncertainty and cleanup authority", () => {
  it("reconciles an uncertain Google create by reading before any write", async () => {
    const f = fixture(); f.event.providerCreateUncertain = true
    const fetch = vi.fn().mockResolvedValue(Response.json(googleEvent)); vi.stubGlobal("fetch", fetch)
    expect(await processAppointmentCalendarEvents({ payload: f.payload, now })).toMatchObject({ synced: 1 })
    expect(fetch.mock.calls.map(call => call[1]?.method ?? "GET")).toEqual(["GET"])
    expect(f.event.providerCreateUncertain).toBe(false)
  })
  it("retains uncertain Google create on read404 without replaying POST", async () => {
    const f = fixture(); f.event.providerCreateUncertain = true
    const fetch = vi.fn().mockResolvedValue(Response.json({}, { status: 404 })); vi.stubGlobal("fetch", fetch)
    expect(await processAppointmentCalendarEvents({ payload: f.payload, now })).toMatchObject({ failed: 1, synced: 0 })
    expect(fetch.mock.calls.map(call => call[1]?.method ?? "GET")).toEqual(["GET"])
    expect(f.event.providerCreateUncertain).toBe(true)
  })
  it("persists intent before the provider write and clears only validated success", async () => {
    const f = fixture(); vi.stubGlobal("fetch", vi.fn(async () => { expect(f.event.providerCreateUncertain).toBe(true); return Response.json(googleEvent) }))
    expect(await processAppointmentCalendarEvents({ payload: f.payload, now })).toMatchObject({ synced: 1 }); expect(f.event.providerCreateUncertain).toBe(false)
  })
  it("preserves uncertainty across malformed success and cancellation", async () => {
    const f = fixture({ provider: "microsoft" }); const fetch = vi.fn().mockResolvedValue(Response.json({ id: "wrong" }, { status: 201 })); vi.stubGlobal("fetch", fetch)
    await processAppointmentCalendarEvents({ payload: f.payload, now }); expect(f.event.providerCreateUncertain).toBe(true)
    f.event.operation = "delete"
    expect(await processAppointmentCalendarEvents({ payload: f.payload, now: new Date(now.getTime() + 60000) })).toMatchObject({ failed: 1, synced: 0 }); expect(fetch).toHaveBeenCalledOnce(); expect(f.event.status).toBe("failed"); expect(f.event.providerCreateUncertain).toBe(true)
  })
  it("does not clear Google unknown create on authoritative read404 because a late write remains possible", async () => {
    const f = fixture({ operation: "delete" }); f.event.providerCreateUncertain = true; const fetch = vi.fn().mockResolvedValue(Response.json({}, { status: 404 })); vi.stubGlobal("fetch", fetch)
    expect(await processAppointmentCalendarEvents({ payload: f.payload, now })).toMatchObject({ failed: 1, synced: 0 }); expect(f.event.providerCreateUncertain).toBe(true); expect(fetch).toHaveBeenCalledOnce()
  })
  it("cleans up an exact deterministic Google event after uncertain create", async () => {
    const f = fixture({ operation: "delete" }); f.event.providerCreateUncertain = true; const fetch = vi.fn().mockResolvedValueOnce(Response.json(googleEvent)).mockResolvedValueOnce(new Response(null, { status: 204 })); vi.stubGlobal("fetch", fetch)
    expect(await processAppointmentCalendarEvents({ payload: f.payload, now })).toMatchObject({ synced: 1 }); expect(f.event.providerCreateUncertain).toBe(false); expect(fetch.mock.calls.map(call => call[1]?.method ?? "GET")).toEqual(["GET", "DELETE"])
  })
  it("retains pre-POST intent conservatively even after a rejection", async () => {
    const f = fixture({ provider: "microsoft" }); const fetch = vi.fn().mockResolvedValue(Response.json({}, { status: 400 })); vi.stubGlobal("fetch", fetch)
    await processAppointmentCalendarEvents({ payload: f.payload, now }); expect(f.event.providerCreateUncertain).toBe(true)
    expect(await processAppointmentCalendarEvents({ payload: f.payload, now })).toMatchObject({ failed: 1, synced: 0 }); expect(fetch).toHaveBeenCalledOnce()
  })
})

describe("uncertainty survives lifecycle reenqueue", () => {
  it("disconnect preserves unknown create state and operation identity", async () => {
    const f = fixture({ provider: "microsoft" }); f.event.providerCreateUncertain = true; const fetch = vi.fn(); vi.stubGlobal("fetch", fetch)
    await disconnectCalendarConnection({ payload: f.payload, tenantId: 1, provider: "microsoft", now })
    expect(f.event).toMatchObject({ providerCreateUncertain: true, eventKey: key, operation: "delete" })
    expect(await processAppointmentCalendarEvents({ payload: f.payload, now })).toMatchObject({ failed: 1, synced: 0 }); expect(fetch).not.toHaveBeenCalled()
  })
  it.each([{ version: 1, expected: 7 }, { version: 2, expected: 0 }])("reconnecting preserves uncertainty and count for version $version", async ({ version, expected }) => {
    const a = authorizationFixture("google"); const f = fixture(); Object.assign(f.event, { providerCreateUncertain: true, attemptCount: 7, eventVersion: version })
    const state = stateFixture("google")
    const appointment = appointmentFixture()
    const payload = await createAtomicTestPayload()
    vi.spyOn(payload, "auth").mockResolvedValue({ user: userFixture({ id: 2, role: "owner", tenants: [{ tenant: 1 }] }), permissions: {} })
    vi.spyOn(payload, "find").mockImplementation(async ({ collection }) => paginatedFixture<CalendarDocument>(collection === "appointment-calendar-oauth-states" ? [{ ...state }] : collection === "appointments" ? [{ ...appointment }] : collection === "appointment-calendar-connections" ? [{ ...f.connection }] : [{ ...f.event }]))
    vi.spyOn(payload.db, "updateOne").mockImplementation(async options => ({ ...state, ...options.data }))
    vi.spyOn(payload, "update").mockImplementation(updateFixture(async options => {
      if (options.collection === "appointment-calendar-oauth-states") return "id" in options ? state : { docs: [state], errors: [] }
      const target = options.collection === "appointment-calendar-connections" ? f.connection : f.event
      Object.assign(target, options.data)
      return target
    }))
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json(validToken)).mockResolvedValueOnce(Response.json({ email: "fixture@example.test" })).mockResolvedValueOnce(Response.json({ items: [{ id: "fixture", accessRole: "owner", primary: true, summary: "Fixture" }] })))
    await completeCalendarAuthorization({ ...a.input, payload })
    expect(f.event).toMatchObject({ status: "queued", attemptCount: expected, eventKey: key, providerCreateUncertain: true })
  })
})

describe("aggregate discovery cancellation", () => {
  it("bounds an otherwise endless sequence of individually timely pages", async () => {
    vi.useFakeTimers({ now }); const f = authorizationFixture("google"); let page = 0
    const fetch = vi.fn().mockResolvedValueOnce(Response.json(validToken)).mockResolvedValueOnce(Response.json({ email: "fixture@example.test" })).mockImplementation(() => new Promise<Response>(resolve => setTimeout(() => resolve(Response.json({ items: [], nextPageToken: `page-${++page}` })), 9000)))
    vi.stubGlobal("fetch", fetch)
    const pending = completeCalendarAuthorization(f.input).catch(error => error)
    await vi.advanceTimersByTimeAsync(30001)
    expect(await pending).toMatchObject({ statusCode: 503 }); expect(fetch).toHaveBeenCalledTimes(6); expect(f.create).not.toHaveBeenCalled()
  })
})

describe("provider-specific create status", () => {
  it.each([{ provider: "google", status: 201, body: googleEvent }, { provider: "microsoft", status: 200, body: graphEvent }, { provider: "google", status: 202, body: googleEvent }] as const)("does not accept unexpected create status $provider/$status", async ({ provider, status, body }) => {
    const f = fixture({ provider }); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body, { status })))
    expect(await processAppointmentCalendarEvents({ payload: f.payload, now })).toMatchObject({ failed: 1, synced: 0 }); expect(f.event.providerEventId).toBeUndefined(); expect(f.event.providerCreateUncertain).toBe(true)
  })
})

describe("actual Payload conditional claim contract", () => {
  it("claims event with bulk where and never id plus where", async () => {
    const f = fixture(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(googleEvent)))
    await processAppointmentCalendarEvents({ payload: f.payload, now })
    const claim = vi.mocked(f.payload.db.updateOne).mock.calls[0]?.[0]
    expect(claim).toHaveProperty("where.and"); expect(claim).not.toHaveProperty("id")
  })
  it("does not contact provider when conditional event lease claim returns no document", async () => {
    const f = fixture(); vi.mocked(f.payload.db.updateOne).mockResolvedValueOnce(null); const fetch = vi.fn(); vi.stubGlobal("fetch", fetch)
    expect(await processAppointmentCalendarEvents({ payload: f.payload, now })).toMatchObject({ skipped: 1, synced: 0 }); expect(fetch).not.toHaveBeenCalled()
  })
  it("claims OAuth state with actual conditional bulk result", async () => {
    const f = authorizationFixture("google"); vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json(validToken)).mockResolvedValueOnce(Response.json({ email: "fixture@example.test" })).mockResolvedValueOnce(Response.json({ items: [{ id: "fixture", accessRole: "owner", primary: true }] })))
    await completeCalendarAuthorization(f.input)
    const claim = vi.mocked(f.input.payload.db.updateOne).mock.calls[0]?.[0]
    expect(claim).toHaveProperty("where.and"); expect(claim).not.toHaveProperty("id")
  })
  it("refuses consumed or raced OAuth state before token exchange", async () => {
    const f = authorizationFixture("google"); vi.mocked(f.input.payload.db.updateOne).mockResolvedValueOnce(null); const fetch = vi.fn(); vi.stubGlobal("fetch", fetch)
    await expect(completeCalendarAuthorization(f.input)).rejects.toThrow("already used"); expect(fetch).not.toHaveBeenCalled()
  })
})

describe("atomic adapter claim regression", () => {
  it("uses atomic database predicate before calendar provider work", async () => {
    const f = fixture(); const atomic = vi.spyOn(f.payload.db, "updateOne").mockResolvedValue(null); const fetch = vi.fn().mockResolvedValue(Response.json(googleEvent)); vi.stubGlobal("fetch", fetch)
    expect(await processAppointmentCalendarEvents({ payload: f.payload, now })).toMatchObject({ synced: 0, skipped: 1 })
    expect(atomic).toHaveBeenCalledOnce(); expect(atomic.mock.calls[0]?.[0]).toMatchObject({ options: { atomic: true } }); expect(fetch).not.toHaveBeenCalled()
  })
  it("uses atomic single-use predicate before OAuth token exchange", async () => {
    const f = authorizationFixture("google"); const atomic = vi.spyOn(f.input.payload.db, "updateOne").mockResolvedValue(null); const fetch = vi.fn().mockResolvedValueOnce(Response.json(validToken)).mockResolvedValueOnce(Response.json({ email: "fixture@example.test" })).mockResolvedValueOnce(Response.json({ items: [{ id: "fixture", accessRole: "owner", primary: true }] })); vi.stubGlobal("fetch", fetch)
    await expect(completeCalendarAuthorization(f.input)).rejects.toThrow("already used"); expect(atomic).toHaveBeenCalledOnce(); expect(fetch).not.toHaveBeenCalled()
  })
})

describe("atomic receipt verification before calendar provider work", () => {
  it("rejects wrong calendar receipt identity before any provider action", async () => {
    const f = fixture(); vi.mocked(f.payload.db.updateOne).mockImplementation(async options => ({ ...f.event, ...options.data, id: 999 })); const fetch = vi.fn(); vi.stubGlobal("fetch", fetch)
    await expect(processAppointmentCalendarEvents({ payload: f.payload, now })).rejects.toThrow("could not be verified atomically"); expect(fetch).not.toHaveBeenCalled()
  })
  it("rejects wrong OAuth receipt identity before token exchange", async () => {
    const f = authorizationFixture("google"); vi.mocked(f.input.payload.db.updateOne).mockResolvedValue({ id: 999 }); const fetch = vi.fn(); vi.stubGlobal("fetch", fetch)
    await expect(completeCalendarAuthorization(f.input)).rejects.toThrow("could not be verified atomically"); expect(fetch).not.toHaveBeenCalled()
  })
})

describe("stale calendar worker resumption", () => {
  it("does not send a create after losing its pre-POST lease fence", async () => {
    const f = fixture(); const claim = vi.mocked(f.payload.db.updateOne)
    claim.mockImplementationOnce(async options => ({ ...f.event, ...options.data })).mockResolvedValueOnce(null)
    const fetch = vi.fn().mockResolvedValue(Response.json(googleEvent)); vi.stubGlobal("fetch", fetch)
    await processAppointmentCalendarEvents({ payload: f.payload, now })
    expect(fetch).not.toHaveBeenCalled(); expect(f.event.status).not.toBe("synced")
  })
  it("does not overwrite a replacement lease after a provider response", async () => {
    const f = fixture({ provider: "microsoft" }); const fetch = vi.fn(async () => {
      Object.assign(f.event, { status: "processing", attemptCount: 2, leaseUntil: "2026-10-07T10:10:00.000Z" })
      vi.mocked(f.payload.db.updateOne).mockResolvedValue(null)
      return Response.json(graphEvent, { status: 201 })
    }); vi.stubGlobal("fetch", fetch)
    await processAppointmentCalendarEvents({ payload: f.payload, now })
    expect(f.event).toMatchObject({ status: "processing", attemptCount: 2, leaseUntil: "2026-10-07T10:10:00.000Z" })
  })
})


describe("stale calendar provider failure", () => {
  it("does not overwrite a replacement lease with the old worker failure", async () => {
    const f = fixture({ provider: "microsoft" })
    vi.stubGlobal("fetch", vi.fn(async () => {
      Object.assign(f.event, { status: "processing", attemptCount: 2, leaseUntil: "2026-10-07T10:10:00.000Z" })
      vi.mocked(f.payload.db.updateOne).mockResolvedValue(null)
      throw new Error("Synthetic provider failure")
    }))
    expect(await processAppointmentCalendarEvents({ payload: f.payload, now })).toMatchObject({ failed: 0, synced: 0, skipped: 1 })
    expect(f.event).toMatchObject({ status: "processing", attemptCount: 2, leaseUntil: "2026-10-07T10:10:00.000Z" })
  })
})


describe("calendar enqueue count versus version invariant", () => {
  it.each([{ version: 1, expected: 7 }, { version: 2, expected: 0 }])("side-effect reenqueue preserves acquired count only for the same version $version", async ({ version, expected }) => {
    const f = fixture()
    Object.assign(f.event, { eventVersion: version, attemptCount: 7, status: "processing", leaseUntil: "2026-10-07T10:05:00.000Z", providerCreateUncertain: true })
    await ensureAppointmentSideEffects({ payload: f.payload, appointmentId: 1, tenantId: 1, eventVersion: 1, status: "confirmed", now })
    expect(f.event).toMatchObject({ eventVersion: 1, status: "queued", attemptCount: expected, leaseUntil: null, providerCreateUncertain: true, eventKey: key })
  })
})

describe("same-version provider follow-up enqueue", () => {
  it("retains acquired count when a just-created event needs deletion after appointment removal", async () => {
    const f = fixture({ provider: "microsoft" })
    let appointmentReads = 0
    vi.mocked(f.payload.find).mockImplementation(async ({ collection }) => paginatedFixture<CalendarDocument>(collection === "appointments" ? (++appointmentReads === 1 ? [appointmentFixture()] : []) : collection === "appointment-calendar-connections" ? [{ ...f.connection }] : [{ ...f.event }]))
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(graphEvent, { status: 201 })))
    expect(await processAppointmentCalendarEvents({ payload: f.payload, now })).toMatchObject({ synced: 0, skipped: 1 })
    expect(f.event).toMatchObject({ status: "queued", operation: "delete", eventVersion: 1, attemptCount: 1, providerEventId: graphEvent.id })
  })
})
