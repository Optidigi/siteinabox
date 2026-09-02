import { describe, expect, it } from "vitest"
import {
  AppointmentBookingInputSchema,
  DEFAULT_APPOINTMENT_SCHEDULE,
} from "@siteinabox/contracts"
import {
  AppointmentScheduleError,
  buildAppointmentAvailability,
} from "@/lib/appointments/schedule"

const mondaySchedule = {
  ...DEFAULT_APPOINTMENT_SCHEDULE,
  enabled: true,
  minimumNoticeMinutes: 0,
  weeklyAvailability: [{
    weekday: "monday" as const,
    windows: [{ start: "09:00", end: "11:00" }],
  }],
}

describe("appointment availability", () => {
  const now = new Date("2026-09-06T08:00:00.000Z")

  it("builds deterministic local-time slots in the configured time zone", () => {
    const result = buildAppointmentAvailability({
      settings: mondaySchedule,
      from: "2026-09-07",
      to: "2026-09-07",
      now,
    })

    expect(result.timezone).toBe("Europe/Amsterdam")
    expect(result.slots).toHaveLength(4)
    expect(result.slots[0]).toMatchObject({
      startAt: "2026-09-07T09:00:00.000+02:00",
      endAt: "2026-09-07T09:30:00.000+02:00",
    })
  })

  it("uses date overrides and removes slots that overlap occupied appointments", () => {
    const occupied = [{
      startAt: "2026-09-07T09:30:00+02:00",
      endAt: "2026-09-07T10:00:00+02:00",
    }]
    const result = buildAppointmentAvailability({
      settings: mondaySchedule,
      from: "2026-09-07",
      now,
      occupied,
    })
    expect(result.slots.map((slot) => slot.startAt)).toEqual([
      "2026-09-07T09:00:00.000+02:00",
      "2026-09-07T10:00:00.000+02:00",
      "2026-09-07T10:30:00.000+02:00",
    ])

    const closed = buildAppointmentAvailability({
      settings: { ...mondaySchedule, dateOverrides: [{ date: "2026-09-07", windows: [] }] },
      from: "2026-09-07",
      now,
    })
    expect(closed.slots).toEqual([])
  })

  it("enforces notice, booking-window, and range limits before returning slots", () => {
    const tooSoon = buildAppointmentAvailability({
      settings: { ...mondaySchedule, minimumNoticeMinutes: 60 * 24 * 2 },
      from: "2026-09-07",
      now,
    })
    expect(tooSoon.slots).toEqual([])

    const outsideWindow = buildAppointmentAvailability({
      settings: { ...mondaySchedule, bookingWindowDays: 1 },
      from: "2026-09-14",
      now,
    })
    expect(outsideWindow.slots).toEqual([])

    expect(() => buildAppointmentAvailability({
      settings: mondaySchedule,
      from: "2026-09-07",
      to: "2026-10-09",
      now,
    })).toThrowError(new AppointmentScheduleError("invalid_range", "Availability requests must cover at most 31 days."))
  })

  it("fails closed for malformed booking input and disabled schedules", () => {
    expect(AppointmentBookingInputSchema.safeParse({
      startAt: "2026-09-07T09:00:00+02:00",
      visitorName: "Visitor",
      visitorEmail: "not-an-email",
    }).success).toBe(false)
    expect(buildAppointmentAvailability({
      settings: DEFAULT_APPOINTMENT_SCHEDULE,
      from: "2026-09-07",
      now,
    }).slots).toEqual([])
  })
})
