import { describe, expect, it, vi } from "vitest"
import type { Appointment, AppointmentCalendarOauthState, SiteSetting } from "@/payload-types"
import { createSiteSettingsData } from "@/lib/queries/siteSettingsDefaults"
import { purgeStaleAppointments } from "@/lib/jobs/purgeStaleAppointments"
import { createTestPayload } from "../_helpers/testPayload"
import { paginatedFixture } from "../_helpers/generatedDocs"

const timestamp = "2026-08-01T00:00:00Z"
const setting = (id: number, tenant: number, retentionDays: number): SiteSetting => {
  const data = createSiteSettingsData(tenant, "Fixture", "https://fixture.example")
  return { ...data, id, appointments: { ...data.appointments, retentionDays }, createdAt: timestamp, updatedAt: timestamp }
}
const appointment = (id: number, tenant: number): Appointment => ({
  id, tenant, status: "completed", startAt: "2026-01-01T09:00:00Z", endAt: "2026-01-01T09:30:00Z",
  timezone: "Europe/Amsterdam", durationMinutes: 30, visitorName: "Fixture", visitorEmail: "fixture@example.com",
  source: "website", eventVersion: 1, createdAt: timestamp, updatedAt: timestamp,
})
const oauthState: AppointmentCalendarOauthState = {
  id: 5, stateDigest: "fixture-state", tenant: 11, user: 1, provider: "google", encryptedCodeVerifier: "fixture-ciphertext",
  returnPath: "/appointments", expiresAt: timestamp, createdAt: timestamp, updatedAt: timestamp,
}

describe("purge stale appointments", () => {
  it("paginates tenant settings and applies each tenant retention cutoff", async () => {
    const payload = createTestPayload()
    const find = vi.spyOn(payload, "find")
      .mockResolvedValueOnce(paginatedFixture([setting(1, 11, 30)], { hasNextPage: true }))
      .mockResolvedValueOnce(paginatedFixture([setting(2, 22, 120)], { page: 2 }))
    const remove = vi.spyOn(payload, "delete")
      .mockResolvedValueOnce({ docs: [appointment(1, 11), appointment(2, 11)], errors: [] })
      .mockResolvedValueOnce({ docs: [appointment(3, 22), appointment(4, 22)], errors: [] })
      .mockResolvedValueOnce({ docs: [oauthState], errors: [] })
    const result = await purgeStaleAppointments({ payload, now: new Date("2026-09-01T00:00:00.000Z") })

    expect(result).toMatchObject({ appointmentsDeleted: 4, oauthStatesDeleted: 1, tenantsExamined: 2, tenantsSkipped: 0 })
    const appointmentDeletes = remove.mock.calls.filter(([args]) => args.collection === "appointments")
    expect(appointmentDeletes).toHaveLength(2)
    expect(appointmentDeletes[0]?.[0]).toMatchObject({ where: { and: [{ tenant: { equals: "11" } }, { endAt: { less_than: "2026-08-02T00:00:00.000Z" } }] } })
    expect(appointmentDeletes[1]?.[0]).toMatchObject({ where: { and: [{ tenant: { equals: "22" } }, { endAt: { less_than: "2026-05-04T00:00:00.000Z" } }] } })
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ collection: "site-settings", page: 2 }))
  })
})
