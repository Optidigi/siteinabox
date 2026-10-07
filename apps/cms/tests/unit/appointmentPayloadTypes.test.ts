import { postgresAdapter } from "@payloadcms/db-postgres"
import { buildConfig } from "payload"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createTestPayload } from "../_helpers/testPayload"
import { paginatedFixture, siteSettingsFixture, tenantFixture } from "../_helpers/generatedDocs"
import ts from "typescript"
import path from "node:path"
import type { Appointment, AppointmentNotificationDelivery, SiteSetting, Tenant } from "@/payload-types"
import * as mail from "@/lib/email/sendEmail"
import { processAppointmentNotifications } from "@/lib/jobs/appointmentNotifications"


const createAtomicTestPayload = async () => {
  const payload = createTestPayload()
  await payload.init({ config: await buildConfig({ secret: "atomic-claim-fixture-secret", telemetry: false, logger: { options: { level: "silent" } }, typescript: { autoGenerate: false }, db: postgresAdapter({ pool: { connectionString: "postgresql://fixture:fixture@localhost/fixture" } }), collections: [] }), disableDBConnect: true, disableOnInit: true })
  return payload
}

afterEach(() => vi.restoreAllMocks())

const contractSource = `
import type { AppointmentSystemPayload } from "@/lib/appointments/systemPayload"
import type { Appointment, AppointmentCalendarConnection } from "@/payload-types"
declare const payload: AppointmentSystemPayload
const appointment = await payload.findByID({ collection: "appointments", id: 1, depth: 0, overrideAccess: true })
const correct: Appointment = appointment
const wrong: AppointmentCalendarConnection = appointment
payload.create({ collection: "appointment-calendar-events", data: { eventKey: "missing-required" }, depth: 0, overrideAccess: true })
payload.find({ collection: "not-a-real-collection", limit: 1, depth: 0, overrideAccess: true })
payload.create({ collection: "appointment-calendar-events", data: { eventKey: "event", appointment: 1, connection: 2, eventVersion: 1, status: "queued", operation: "upsert", attemptCount: 0, nextAttemptAt: "2026-10-07T00:00:00Z" }, depth: 0, overrideAccess: true })
`

describe("generated appointment Payload contracts", () => {
  it("rejects wrong collection documents, invalid slugs and missing required create fields", () => {
    const configPath = path.resolve(import.meta.dirname, "../../tsconfig.json")
    const config = ts.readConfigFile(configPath, ts.sys.readFile)
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath))
    const file = path.resolve(path.dirname(configPath), "tests/unit/appointment-contract.virtual.ts")
    const host = ts.createCompilerHost(parsed.options)
    const read = host.readFile.bind(host)
    const exists = host.fileExists.bind(host)
    host.readFile = (candidate) => candidate === file ? contractSource : read(candidate)
    host.fileExists = (candidate) => candidate === file || exists(candidate)
    const program = ts.createProgram([file], { ...parsed.options, noEmit: true }, host)
    const diagnostics = ts.getPreEmitDiagnostics(program).filter((diagnostic) => diagnostic.file?.fileName === file)
    const lines = diagnostics.map((diagnostic) => diagnostic.file!.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line + 1)
    expect(lines).toContain(7)
    expect(lines).toContain(8)
    expect(lines).toContain(9)
    expect(lines).not.toContain(6)
    expect(lines).not.toContain(10)
  }, 30_000)

  it("keeps a stale delivery unclaimed through the atomic adapter-update contract", async () => {
    const payload = await createAtomicTestPayload()
    const delivery: AppointmentNotificationDelivery = {
      id: 1, notificationKey: "appointment:2:1:confirmation:visitor", appointment: 2, tenant: 3,
      recipientKind: "visitor", kind: "confirmation", eventVersion: 1, templateVersion: "v1",
      status: "queued", attemptCount: 0, nextAttemptAt: "2026-10-07T00:00:00Z",
      createdAt: "2026-10-07T00:00:00Z", updatedAt: "2026-10-07T00:00:00Z",
    }
    vi.spyOn(payload, "find").mockResolvedValue({ docs: [delivery], totalDocs: 1, limit: 100, totalPages: 1, page: 1, pagingCounter: 1, hasPrevPage: false, hasNextPage: false, prevPage: null, nextPage: null })
    const update = vi.spyOn(payload.db, "updateOne").mockResolvedValue(null)
    await expect(processAppointmentNotifications({ payload, now: new Date("2026-10-07T01:00:00Z") })).resolves.toMatchObject({ sent: 0, skipped: 1 })
    expect(update.mock.calls[0]?.[0]).not.toHaveProperty("id")
    expect(update.mock.calls[0]?.[0]).toHaveProperty("options.atomic", true)
    expect(update.mock.calls[0]?.[0].where).toMatchObject({ and: expect.arrayContaining([{ id: { equals: delivery.id } }]) })
  })
  it("rejects a wrong atomic delivery receipt before any notification provider call", async () => {
    const payload = await createAtomicTestPayload()
    const now = new Date("2026-10-07T01:00:00.000Z")
    const delivery: AppointmentNotificationDelivery = { id: 1, notificationKey: "appointment:2:1:confirmation:visitor", appointment: 2, tenant: 3, recipientKind: "visitor", kind: "confirmation", eventVersion: 1, templateVersion: "v1", status: "queued", attemptCount: 0, nextAttemptAt: "2026-10-07T00:00:00.000Z", createdAt: "2026-10-07T00:00:00.000Z", updatedAt: "2026-10-07T00:00:00.000Z" }
    const find = vi.spyOn(payload, "find").mockResolvedValue({ docs: [delivery], totalDocs: 1, limit: 100, totalPages: 1, page: 1, pagingCounter: 1, hasPrevPage: false, hasNextPage: false, prevPage: null, nextPage: null })
    vi.spyOn(payload.db, "updateOne").mockImplementation(async options => ({ ...delivery, ...options.data, id: 999 }))
    const send = vi.spyOn(mail, "sendEmail")
    await expect(processAppointmentNotifications({ payload, now })).rejects.toThrow("could not be verified atomically")
    expect(find).toHaveBeenCalledOnce(); expect(send).not.toHaveBeenCalled()
  })

})


describe("stale notification worker resumption", () => {
  it.each(["before send", "after response", "after failure"])("preserves the replacement lease %s", async phase => {
    const payload = await createAtomicTestPayload()
    const now = new Date("2026-10-07T10:00:00.000Z")
    vi.spyOn(Date, "now").mockReturnValue(now.getTime())
    const timestamps = { createdAt: "2026-10-07T09:00:00.000Z", updatedAt: "2026-10-07T09:00:00.000Z" }
    const delivery: AppointmentNotificationDelivery = { id: 1, notificationKey: "appointment:2:1:confirmation:tenant", appointment: 2, tenant: 3, recipientKind: "tenant", recipientEmail: "fixture@example.test", kind: "confirmation", eventVersion: 1, templateVersion: "v1", status: "queued", attemptCount: 0, nextAttemptAt: now.toISOString(), ...timestamps }
    const appointment: Appointment = { id: 2, tenant: 3, status: "confirmed", startAt: "2026-10-08T10:00:00.000Z", endAt: "2026-10-08T11:00:00.000Z", timezone: "UTC", durationMinutes: 60, visitorName: "Fixture", visitorEmail: "fixture@example.test", source: "website", eventVersion: 1, ...timestamps }
    const tenant = tenantFixture({ id: 3 })
    const settings = siteSettingsFixture({ tenant: 3 })
    vi.spyOn(payload, "find").mockImplementation(async ({ collection }) => paginatedFixture<Appointment | AppointmentNotificationDelivery | Tenant | SiteSetting>(collection === "appointments" ? [{ ...appointment }] : collection === "tenants" ? [tenant] : collection === "site-settings" ? [settings] : [{ ...delivery }]))
    let replaced = false
    const replaceLease = () => { replaced = true; Object.assign(delivery, { status: "processing", attemptCount: 2, leaseUntil: "2026-10-07T10:10:00.000Z" }) }
    let calls = 0
    const atomic = vi.spyOn(payload.db, "updateOne").mockImplementation(async options => {
      calls += 1
      if (phase === "before send" && calls === 2) replaceLease()
      if (replaced) return null
      Object.assign(delivery, options.data)
      return { ...delivery }
    })
    const send = vi.spyOn(mail, "sendEmail").mockImplementation(async () => {
      replaceLease()
      if (phase === "after failure") throw new Error("Synthetic provider failure")
      return { provider: "fixture", providerMessageId: "fixture-message" }
    })
    expect(await processAppointmentNotifications({ payload, now })).toMatchObject({ sent: 0, failed: 0, skipped: 1 })
    expect(delivery).toMatchObject({ status: "processing", attemptCount: 2, leaseUntil: "2026-10-07T10:10:00.000Z" })
    expect(send).toHaveBeenCalledTimes(phase === "before send" ? 0 : 1)
    expect(atomic).toHaveBeenCalledTimes(phase === "before send" ? 2 : 3)
  })
})
