import { describe, expect, it } from "vitest"
import {
  AppointmentAvailabilityQuerySchema,
  AppointmentBookingInputSchema,
  AppointmentBookingResponseSchema,
  AppointmentManagementRequestSchema,
  AppointmentScheduleSettingsSchema,
  AppointmentSectionSchema,
  DEFAULT_APPOINTMENT_PRESENTATION,
  DEFAULT_APPOINTMENT_VARIANT,
  DEFAULT_APPOINTMENT_SCHEDULE,
} from "./appointments"

const schedule = {
  ...DEFAULT_APPOINTMENT_SCHEDULE,
  enabled: true,
  weeklyAvailability: [{
    weekday: "monday",
    windows: [{ start: "09:00", end: "17:00" }],
  }],
}

describe("appointment contracts", () => {
  it("accepts the disabled default and a bounded weekly schedule", () => {
    expect(AppointmentScheduleSettingsSchema.safeParse(DEFAULT_APPOINTMENT_SCHEDULE).success).toBe(true)
    expect(AppointmentScheduleSettingsSchema.safeParse(schedule).success).toBe(true)
  })

  it("keeps lifecycle responses and the section contract explicit", () => {
    expect(AppointmentBookingResponseSchema.safeParse({
      ok: true,
      status: "confirmed",
      managementToken: "x".repeat(32),
    }).success).toBe(true)
    expect(AppointmentManagementRequestSchema.safeParse({
      token: "x".repeat(32),
      action: "reschedule",
      startAt: "2026-09-07T10:00:00+02:00",
    }).success).toBe(true)
    expect(AppointmentSectionSchema.safeParse({
      blockType: "appointments",
      variant: DEFAULT_APPOINTMENT_VARIANT,
      heading: "Plan een kennismaking",
    }).success).toBe(true)
    expect(AppointmentSectionSchema.safeParse({
      blockType: "appointments",
      variant: "appointments-01",
      heading: "Plan een kennismaking",
    }).data?.presentation).toBe(DEFAULT_APPOINTMENT_PRESENTATION)
    expect(AppointmentSectionSchema.safeParse({
      blockType: "appointments",
      variant: DEFAULT_APPOINTMENT_VARIANT,
      heading: "Plan een kennismaking",
    }).data?.backgroundMode).toBe("none")
    expect(AppointmentSectionSchema.safeParse({
      blockType: "appointments",
      variant: "appointments-02",
      heading: "Plan een kennismaking",
    }).success).toBe(false)
  })

  it("supports inherited and explicitly overridden visual effects", () => {
    expect(AppointmentSectionSchema.safeParse({
      blockType: "appointments",
      variant: DEFAULT_APPOINTMENT_VARIANT,
      heading: "Plan een kennismaking",
      backgroundMode: null,
    }).success).toBe(true)
    expect(AppointmentSectionSchema.safeParse({
      blockType: "appointments",
      variant: DEFAULT_APPOINTMENT_VARIANT,
      heading: "Plan een kennismaking",
      backgroundMode: "animation",
    }).success).toBe(true)
    expect(AppointmentSectionSchema.safeParse({
      blockType: "appointments",
      variant: DEFAULT_APPOINTMENT_VARIANT,
      heading: "Plan een kennismaking",
      backgroundMode: "none",
      image: "/supplied-appointment-image.webp",
    }).success).toBe(true)
    expect(AppointmentSectionSchema.safeParse({
      blockType: "appointments",
      variant: DEFAULT_APPOINTMENT_VARIANT,
      heading: "Plan een kennismaking",
      backgroundMode: "image",
    }).success).toBe(false)
    expect(AppointmentSectionSchema.safeParse({
      blockType: "appointments",
      variant: DEFAULT_APPOINTMENT_VARIANT,
      heading: "Plan een kennismaking",
      backgroundMode: "image",
      image: "/supplied-appointment-image.webp",
    }).success).toBe(true)
    expect(AppointmentSectionSchema.safeParse({
      blockType: "appointments",
      variant: DEFAULT_APPOINTMENT_VARIANT,
      heading: "Plan een kennismaking",
      backgroundMode: "animation",
      unsupportedVisualField: true,
    }).success).toBe(false)
  })

  it("rejects duplicate days, duplicate override dates, invalid windows, and unknown fields", () => {
    expect(AppointmentScheduleSettingsSchema.safeParse({
      ...schedule,
      weeklyAvailability: [
        ...schedule.weeklyAvailability,
        { weekday: "monday", windows: [{ start: "10:00", end: "11:00" }] },
      ],
    }).success).toBe(false)
    expect(AppointmentScheduleSettingsSchema.safeParse({
      ...schedule,
      dateOverrides: [
        { date: "2026-09-07", windows: [] },
        { date: "2026-09-07", windows: [] },
      ],
    }).success).toBe(false)
    expect(AppointmentScheduleSettingsSchema.safeParse({
      ...schedule,
      weeklyAvailability: [{ weekday: "monday", windows: [{ start: "17:00", end: "09:00" }] }],
    }).success).toBe(false)
    expect(AppointmentScheduleSettingsSchema.safeParse({
      ...schedule,
      weeklyAvailability: [{
        weekday: "monday",
        windows: [
          { start: "09:00", end: "12:00" },
          { start: "11:00", end: "13:00" },
        ],
      }],
    }).success).toBe(false)
    expect(AppointmentScheduleSettingsSchema.safeParse({
      ...schedule,
      weeklyAvailability: [{
        weekday: "monday",
        windows: [
          { start: "13:00", end: "17:00" },
          { start: "09:00", end: "12:00" },
        ],
      }],
    }).success).toBe(false)
    expect(AppointmentScheduleSettingsSchema.safeParse({
      ...schedule,
      weeklyAvailability: [{
        weekday: "monday",
        windows: [
          { start: "09:00", end: "12:00" },
          { start: "12:00", end: "13:00" },
        ],
      }],
    }).success).toBe(true)
    expect(AppointmentScheduleSettingsSchema.safeParse({ ...schedule, provider: "google" }).success).toBe(false)
  })

  it("requires buffers and interval values to describe a schedulable slot", () => {
    expect(AppointmentScheduleSettingsSchema.safeParse({
      ...schedule,
      durationMinutes: 60,
      bufferAfterMinutes: 15,
      slotIntervalMinutes: 60,
    }).success).toBe(false)
    expect(AppointmentScheduleSettingsSchema.safeParse({
      ...schedule,
      durationMinutes: 480,
      bufferBeforeMinutes: 480,
      bufferAfterMinutes: 481,
    }).success).toBe(false)
  })

  it("accepts offset-bearing bookings and rejects ambiguous timestamps", () => {
    expect(AppointmentBookingInputSchema.safeParse({
      startAt: "2026-09-07T09:00:00+02:00",
      visitorName: "Ada Lovelace",
      visitorEmail: "ada@example.test",
    }).success).toBe(true)
    expect(AppointmentBookingInputSchema.safeParse({
      startAt: "2026-09-07T09:00:00",
      visitorName: "Ada Lovelace",
      visitorEmail: "ada@example.test",
    }).success).toBe(false)
  })

  it("keeps availability queries local-date based and ordered", () => {
    expect(AppointmentAvailabilityQuerySchema.safeParse({ from: "2026-09-07", to: "2026-09-08" }).success).toBe(true)
    expect(AppointmentAvailabilityQuerySchema.safeParse({ from: "2026-09-08", to: "2026-09-07" }).success).toBe(false)
    expect(AppointmentAvailabilityQuerySchema.safeParse({ from: "2026-09-01", to: "2026-10-03" }).success).toBe(false)
    expect(AppointmentAvailabilityQuerySchema.safeParse({ from: "2026-02-30" }).success).toBe(false)
  })
})
