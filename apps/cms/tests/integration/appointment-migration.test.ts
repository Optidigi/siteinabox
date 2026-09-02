import { beforeAll, describe, expect, it } from "vitest"
import type { SiteSetting } from "@/payload-types"
import { getTestPayload } from "./_helpers"

let payload: Awaited<ReturnType<typeof getTestPayload>>

const executeRaw = (raw: string) => payload.db.execute({
  drizzle: payload.db.drizzle,
  raw,
})

describe("appointment module migration", () => {
  beforeAll(async () => {
    payload = await getTestPayload()
  }, 30_000)

  it("creates tenant schedule defaults and prevents overlapping confirmed bookings", async () => {
    const tenant = await payload.create({
      collection: "tenants",
      data: {
        name: "Appointment migration fixture",
        slug: `appointment-migration-${Date.now()}`,
        domain: `appointment-migration-${Date.now()}.test`,
        status: "active",
      },
      overrideAccess: true,
    })

    try {
      const settings = await payload.create({
        collection: "site-settings",
        data: {
          tenant: tenant.id,
          siteName: "Appointment migration fixture",
          siteUrl: "https://appointment-migration.test",
        } as unknown as SiteSetting,
        draft: false,
        overrideAccess: true,
      })
      expect(settings.appointments).toMatchObject({
        enabled: false,
        timezone: "Europe/Amsterdam",
        durationMinutes: 30,
        slotIntervalMinutes: 30,
      })

      const appointmentEffectColumns = await executeRaw(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'pages_blocks_appointments'
          AND column_name IN ('background_mode', 'image_id')
        ORDER BY column_name;
      `)
      expect((appointmentEffectColumns.rows as Array<{ column_name: string }>).map((row) => row.column_name)).toEqual([
        "background_mode",
        "image_id",
      ])

      const first = await payload.create({
        collection: "appointments",
        data: {
          tenant: tenant.id,
          status: "confirmed",
          startAt: "2026-09-07T09:00:00+02:00",
          endAt: "2026-09-07T09:30:00+02:00",
          timezone: "Europe/Amsterdam",
          durationMinutes: 30,
          visitorName: "Ada Lovelace",
          visitorEmail: "ada@example.test",
          source: "website",
          eventVersion: 1,
        },
        draft: false,
        overrideAccess: true,
      })

      await expect(payload.create({
        collection: "appointments",
        data: {
          tenant: tenant.id,
          status: "confirmed",
          startAt: "2026-09-07T09:15:00+02:00",
          endAt: "2026-09-07T09:45:00+02:00",
          timezone: "Europe/Amsterdam",
          durationMinutes: 30,
          visitorName: "Grace Hopper",
          visitorEmail: "grace@example.test",
          source: "website",
          eventVersion: 1,
        },
        draft: false,
        overrideAccess: true,
      })).rejects.toThrow()

      await payload.create({
        collection: "mail-logs",
        data: {
          flow: "appointments.visitor_notification",
          category: "transactional",
          tenant: tenant.id,
          appointment: first.id,
          sender: "noreply@siteinabox.nl",
          recipient: "ada@example.test",
          status: "sent",
          provider: "cloudflare-rest",
          retryState: "none",
        },
        overrideAccess: true,
      })

      await payload.delete({ collection: "appointments", id: first.id, overrideAccess: true })
      const constraints = await executeRaw(`
        SELECT conname
        FROM pg_constraint
        WHERE conname IN ('appointments_end_after_start_check', 'appointments_confirmed_no_overlap')
        ORDER BY conname;
      `)
      const names = constraints.rows as Array<{ conname: string }>
      expect(names.map((row) => row.conname)).toEqual([
        "appointments_confirmed_no_overlap",
        "appointments_end_after_start_check",
      ])

      const mailFlowValues = await executeRaw(`
        SELECT e.enumlabel
        FROM pg_enum AS e
        JOIN pg_type AS t ON t.oid = e.enumtypid
        JOIN pg_namespace AS n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'enum_mail_logs_flow'
          AND e.enumlabel LIKE 'appointments.%'
        ORDER BY e.enumsortorder;
      `)
      expect((mailFlowValues.rows as Array<{ enumlabel: string }>).map((row) => row.enumlabel)).toEqual([
        "appointments.visitor_notification",
        "appointments.tenant_notification",
      ])

      const appointmentMailLogs = await executeRaw(`
        SELECT COUNT(*)::int AS count
        FROM public.mail_logs
        WHERE appointment_id = ${String(first.id)};
      `)
      expect(Number((appointmentMailLogs.rows as Array<{ count: number | string }>)[0]?.count)).toBe(0)

      const appointmentMailForeignKey = await executeRaw(`
        SELECT confdeltype
        FROM pg_constraint
        WHERE conname = 'mail_logs_appointment_fk';
      `)
      expect((appointmentMailForeignKey.rows as Array<{ confdeltype: string }>)[0]?.confdeltype).toBe("c")
    } finally {
      await payload.delete({ collection: "site-settings", where: { tenant: { equals: tenant.id } }, overrideAccess: true }).catch(() => undefined)
      await payload.delete({ collection: "appointments", where: { tenant: { equals: tenant.id } }, overrideAccess: true }).catch(() => undefined)
      await payload.delete({ collection: "tenants", id: tenant.id, overrideAccess: true }).catch(() => undefined)
    }
  }, 30_000)
})
