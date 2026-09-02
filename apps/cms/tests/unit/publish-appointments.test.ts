import { describe, expect, it } from "vitest"
import { validatePublishedAppointmentSchedule } from "@/lib/publish/siteSnapshots"
import { DEFAULT_APPOINTMENT_SCHEDULE } from "@siteinabox/contracts"

const pagesWithAppointments = [{
  blocks: [{
    blockType: "appointments" as const,
    variant: "appointments-01" as const,
    presentation: "dialog" as const,
    backgroundMode: "none" as const,
    heading: "Plan an appointment",
    availabilityLabel: "Availability",
    bookingLabel: "Book an appointment",
    confirmationHeading: "Appointment confirmed",
  }],
}]

describe("validatePublishedAppointmentSchedule", () => {
  it("allows published pages without an appointment section", () => {
    expect(() => validatePublishedAppointmentSchedule([{ blocks: [] }], null)).not.toThrow()
  })

  it("requires an enabled schedule with a configured window", () => {
    expect(() => validatePublishedAppointmentSchedule(pagesWithAppointments, DEFAULT_APPOINTMENT_SCHEDULE)).toThrow(/enabled and at least one schedule window/)
    expect(() => validatePublishedAppointmentSchedule(pagesWithAppointments, {
      ...DEFAULT_APPOINTMENT_SCHEDULE,
      enabled: true,
    })).toThrow(/enabled and at least one schedule window/)
  })

  it("accepts a weekly or date-override window", () => {
    expect(() => validatePublishedAppointmentSchedule(pagesWithAppointments, {
      ...DEFAULT_APPOINTMENT_SCHEDULE,
      enabled: true,
      weeklyAvailability: [{ weekday: "monday", windows: [{ start: "09:00", end: "10:00" }] }],
    })).not.toThrow()
    expect(() => validatePublishedAppointmentSchedule(pagesWithAppointments, {
      ...DEFAULT_APPOINTMENT_SCHEDULE,
      enabled: true,
      dateOverrides: [{ date: "2030-01-01", windows: [{ start: "09:00", end: "10:00" }] }],
    })).not.toThrow()
  })
})
