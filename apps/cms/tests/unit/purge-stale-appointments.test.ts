import { describe, expect, it, vi } from "vitest"
import type { Payload } from "payload"
import { DEFAULT_APPOINTMENT_SCHEDULE } from "@siteinabox/contracts"
import { purgeStaleAppointments } from "@/lib/jobs/purgeStaleAppointments"

describe("purge stale appointments", () => {
  it("paginates tenant settings and applies each tenant retention cutoff", async () => {
    const find = vi.fn(async (args: { collection: string; page?: number }) => {
      if (args.collection === "site-settings" && args.page === 1) {
        return {
          docs: [{ id: 1, tenant: 11, appointments: { ...DEFAULT_APPOINTMENT_SCHEDULE, retentionDays: 30 } }],
          hasNextPage: true,
        }
      }
      if (args.collection === "site-settings") {
        return {
          docs: [{ id: 2, tenant: 22, appointments: { ...DEFAULT_APPOINTMENT_SCHEDULE, retentionDays: 120 } }],
          hasNextPage: false,
        }
      }
      throw new Error(`unexpected find collection ${args.collection}`)
    })
    const remove = vi.fn(async (args: { collection: string }) => args.collection === "appointments" ? { deletedCount: 2 } : { deletedCount: 1 })
    const payload = { find, delete: remove } as unknown as Payload
    const result = await purgeStaleAppointments({ payload, now: new Date("2026-09-01T00:00:00.000Z") })

    expect(result).toMatchObject({ appointmentsDeleted: 4, oauthStatesDeleted: 1, tenantsExamined: 2, tenantsSkipped: 0 })
    const appointmentDeletes = remove.mock.calls.filter(([args]) => args.collection === "appointments")
    expect(appointmentDeletes).toHaveLength(2)
    expect(appointmentDeletes[0]?.[0]).toMatchObject({ where: { and: [{ tenant: { equals: "11" } }, { endAt: { less_than: "2026-08-02T00:00:00.000Z" } }] } })
    expect(appointmentDeletes[1]?.[0]).toMatchObject({ where: { and: [{ tenant: { equals: "22" } }, { endAt: { less_than: "2026-05-04T00:00:00.000Z" } }] } })
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ collection: "site-settings", page: 2 }))
  })
})
