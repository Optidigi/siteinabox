import "server-only"

import type { Payload } from "payload"
import {
  AppointmentScheduleSettingsSchema,
  DEFAULT_APPOINTMENT_SCHEDULE,
} from "@siteinabox/contracts"
import {
  asAppointmentSystemPayload,
  relationId,
} from "@/lib/appointments/systemPayload"

const DAY_MS = 24 * 60 * 60_000

const deletedCount = (value: unknown): number => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0
  const record = value as { deletedCount?: unknown; docs?: unknown }
  if (typeof record.deletedCount === "number") return Math.max(0, record.deletedCount)
  return Array.isArray(record.docs) ? record.docs.length : 0
}

export type AppointmentPurgeResult = {
  appointmentsDeleted: number
  oauthStatesDeleted: number
  tenantsExamined: number
  tenantsSkipped: number
  nowISO: string
}

/**
 * Delete appointment records only after their tenant-configured retention
 * window has elapsed. The appointment row owns the visitor name, email,
 * phone and note; its notification/calendar outboxes cascade with it. OAuth
 * correlation states are short-lived and are purged independently.
 */
export async function purgeStaleAppointments(input: {
  payload: Payload
  now?: Date
}): Promise<AppointmentPurgeResult> {
  const payload = asAppointmentSystemPayload(input.payload)
  const now = input.now ?? new Date()
  const nowISO = now.toISOString()
  let appointmentsDeleted = 0
  let tenantsExamined = 0
  let tenantsSkipped = 0
  let page = 1
  while (true) {
    const settings = await payload.find({ collection: "site-settings", limit: 500, page, depth: 0, overrideAccess: true })
    for (const setting of settings.docs) {
      const tenantId = relationId(setting.tenant)
      if (!tenantId) {
        tenantsSkipped += 1
        continue
      }
      tenantsExamined += 1
      const parsed = AppointmentScheduleSettingsSchema.safeParse(setting.appointments)
      const retentionDays = parsed.success ? parsed.data.retentionDays : DEFAULT_APPOINTMENT_SCHEDULE.retentionDays
      if (!Number.isSafeInteger(retentionDays) || retentionDays < 30 || retentionDays > 730) {
        tenantsSkipped += 1
        continue
      }
      const cutoff = new Date(now.getTime() - retentionDays * DAY_MS).toISOString()
      const deleted = await payload.delete({
        collection: "appointments",
        where: {
          and: [
            { tenant: { equals: tenantId } },
            { endAt: { less_than: cutoff } },
          ],
        },
        overrideAccess: true,
        context: { appointmentRetentionPurge: true },
      })
      appointmentsDeleted += deletedCount(deleted)
    }
    if (settings.hasNextPage !== true) break
    page += 1
  }

  const oauthStates = await payload.delete({
    collection: "appointment-calendar-oauth-states",
    where: { expiresAt: { less_than: nowISO } },
    overrideAccess: true,
    context: { appointmentRetentionPurge: true },
  })

  return {
    appointmentsDeleted,
    oauthStatesDeleted: deletedCount(oauthStates),
    tenantsExamined,
    tenantsSkipped,
    nowISO,
  }
}
