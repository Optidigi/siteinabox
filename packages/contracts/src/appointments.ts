import { z } from "zod"
import { backgroundModeSchema, blockBaseShape, optionalMediaRefSchema } from "./blocks/common"

export const APPOINTMENT_WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

export type AppointmentWeekday = (typeof APPOINTMENT_WEEKDAYS)[number]

export const AppointmentWeekdaySchema = z.enum(APPOINTMENT_WEEKDAYS)

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const LOCAL_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/
export const MAX_APPOINTMENT_RANGE_DAYS = 31

const isValidLocalDate = (value: string): boolean => {
  if (!LOCAL_DATE_PATTERN.test(value)) return false
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year!, month! - 1, day!))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day
}

const isValidTimeZone = (value: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

const localDateDistance = (from: string, to: string): number => {
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number)
  const [toYear, toMonth, toDay] = to.split("-").map(Number)
  return Math.round((Date.UTC(toYear!, toMonth! - 1, toDay!) - Date.UTC(fromYear!, fromMonth! - 1, fromDay!)) / 86_400_000)
}

export const AppointmentLocalDateSchema = z.string().regex(LOCAL_DATE_PATTERN, "Use YYYY-MM-DD.").refine(isValidLocalDate, "Use a real calendar date.")
export const AppointmentLocalTimeSchema = z.string().regex(LOCAL_TIME_PATTERN, "Use 24-hour HH:MM.")

export type AppointmentTimeWindow = {
  start: string
  end: string
}

export const AppointmentTimeWindowSchema: z.ZodType<AppointmentTimeWindow> = z.object({
  start: AppointmentLocalTimeSchema,
  end: AppointmentLocalTimeSchema,
}).strict().superRefine((window, ctx) => {
  if (appointmentTimeToMinutes(window.end) <= appointmentTimeToMinutes(window.start)) {
    ctx.addIssue({ code: "custom", path: ["end"], message: "The end time must be after the start time." })
  }
})

export type AppointmentWeeklyAvailability = {
  weekday: AppointmentWeekday
  windows: AppointmentTimeWindow[]
}

export const AppointmentWeeklyAvailabilitySchema: z.ZodType<AppointmentWeeklyAvailability> = z.object({
  weekday: AppointmentWeekdaySchema,
  windows: z.array(AppointmentTimeWindowSchema).max(4),
}).strict()

export type AppointmentDateOverride = {
  date: string
  windows: AppointmentTimeWindow[]
}

export const AppointmentDateOverrideSchema: z.ZodType<AppointmentDateOverride> = z.object({
  date: AppointmentLocalDateSchema,
  windows: z.array(AppointmentTimeWindowSchema).max(4),
}).strict()

const addWindowOrderingIssues = (
  windows: AppointmentTimeWindow[],
  path: Array<string | number>,
  ctx: z.RefinementCtx,
): void => {
  let previousEnd = -1
  for (const [index, window] of windows.entries()) {
    const start = appointmentTimeToMinutes(window.start)
    const end = appointmentTimeToMinutes(window.end)
    if (start < previousEnd) {
      ctx.addIssue({
        code: "custom",
        path: [...path, index, "start"],
        message: "Time windows must be ordered and must not overlap.",
      })
    }
    previousEnd = Math.max(previousEnd, end)
  }
}

export type AppointmentScheduleSettings = {
  enabled: boolean
  timezone: string
  durationMinutes: number
  slotIntervalMinutes: number
  bufferBeforeMinutes: number
  bufferAfterMinutes: number
  minimumNoticeMinutes: number
  minimumCancellationNoticeMinutes: number
  bookingWindowDays: number
  retentionDays: number
  weeklyAvailability: AppointmentWeeklyAvailability[]
  dateOverrides: AppointmentDateOverride[]
}

export const DEFAULT_APPOINTMENT_SCHEDULE = {
  enabled: false,
  timezone: "Europe/Amsterdam",
  durationMinutes: 30,
  slotIntervalMinutes: 30,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  minimumNoticeMinutes: 120,
  minimumCancellationNoticeMinutes: 120,
  bookingWindowDays: 60,
  retentionDays: 90,
  weeklyAvailability: [],
  dateOverrides: [],
} satisfies AppointmentScheduleSettings

export const AppointmentScheduleSettingsSchema: z.ZodType<AppointmentScheduleSettings> = z.object({
  enabled: z.boolean().default(false),
  timezone: z.string().trim().min(1).refine(isValidTimeZone, "Use a valid IANA time zone."),
  durationMinutes: z.number().int().min(5).max(480),
  slotIntervalMinutes: z.number().int().min(5).max(480),
  bufferBeforeMinutes: z.number().int().min(0).max(240),
  bufferAfterMinutes: z.number().int().min(0).max(240),
  minimumNoticeMinutes: z.number().int().min(0).max(10_080),
  minimumCancellationNoticeMinutes: z.number().int().min(0).max(10_080),
  bookingWindowDays: z.number().int().min(1).max(366),
  retentionDays: z.number().int().min(30).max(730),
  weeklyAvailability: z.array(AppointmentWeeklyAvailabilitySchema).max(7).default([]),
  dateOverrides: z.array(AppointmentDateOverrideSchema).max(366).default([]),
}).strict().superRefine((schedule, ctx) => {
  const weekdays = new Set<AppointmentWeekday>()
  for (const [index, day] of schedule.weeklyAvailability.entries()) {
    if (weekdays.has(day.weekday)) {
      ctx.addIssue({ code: "custom", path: ["weeklyAvailability", index, "weekday"], message: "Each weekday may be configured only once." })
    }
    weekdays.add(day.weekday)
    addWindowOrderingIssues(day.windows, ["weeklyAvailability", index, "windows"], ctx)
  }

  const dates = new Set<string>()
  for (const [index, override] of schedule.dateOverrides.entries()) {
    if (dates.has(override.date)) {
      ctx.addIssue({ code: "custom", path: ["dateOverrides", index, "date"], message: "Each override date may be configured only once." })
    }
    dates.add(override.date)
    addWindowOrderingIssues(override.windows, ["dateOverrides", index, "windows"], ctx)
  }

  if (schedule.durationMinutes + schedule.bufferBeforeMinutes + schedule.bufferAfterMinutes > 1_440) {
    ctx.addIssue({ code: "custom", path: ["durationMinutes"], message: "Appointment duration and buffers must fit within one day." })
  }
  if (schedule.slotIntervalMinutes < schedule.durationMinutes + schedule.bufferBeforeMinutes + schedule.bufferAfterMinutes) {
    ctx.addIssue({ code: "custom", path: ["slotIntervalMinutes"], message: "Slot interval must include the appointment duration and buffers." })
  }
})

export const AppointmentStatuses = ["confirmed", "cancelled", "completed", "no_show"] as const
export type AppointmentStatus = (typeof AppointmentStatuses)[number]
export const AppointmentStatusSchema = z.enum(AppointmentStatuses)

export const AppointmentSources = ["website", "manual"] as const
export type AppointmentSource = (typeof AppointmentSources)[number]
export const AppointmentSourceSchema = z.enum(AppointmentSources)

const ISO_WITH_OFFSET = /(?:Z|[+-]\d{2}:\d{2})$/
const isDateTimeWithOffset = (value: string): boolean => Number.isFinite(Date.parse(value)) && ISO_WITH_OFFSET.test(value)

export const AppointmentBookingInputSchema = z.object({
  startAt: z.string().trim().min(1).max(64).refine(isDateTimeWithOffset, "Use an ISO date-time with a time-zone offset."),
  visitorName: z.string().trim().min(1).max(120),
  visitorEmail: z.string().trim().email().max(254),
  visitorPhone: z.string().trim().max(40).optional(),
  visitorNote: z.string().trim().max(2_000).optional(),
  pageUrl: z.string().trim().max(2_048).optional(),
  honeypot: z.string().max(200).optional(),
}).strict()

export type AppointmentBookingInput = z.infer<typeof AppointmentBookingInputSchema>

export const AppointmentAvailabilityQuerySchema = z.object({
  from: AppointmentLocalDateSchema,
  to: AppointmentLocalDateSchema.optional(),
}).strict().superRefine((query, ctx) => {
  if (query.to && query.to < query.from) {
    ctx.addIssue({ code: "custom", path: ["to"], message: "The end date must not be before the start date." })
  }
  if (query.to && localDateDistance(query.from, query.to) > MAX_APPOINTMENT_RANGE_DAYS) {
    ctx.addIssue({ code: "custom", path: ["to"], message: `Availability requests must cover at most ${MAX_APPOINTMENT_RANGE_DAYS} days.` })
  }
})

export type AppointmentAvailabilityQuery = z.infer<typeof AppointmentAvailabilityQuerySchema>

export const AppointmentSlotSchema = z.object({
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }),
  timezone: z.string().min(1),
}).strict()

export type AppointmentSlot = z.infer<typeof AppointmentSlotSchema>

export const AppointmentAvailabilityResponseSchema = z.object({
  timezone: z.string().min(1),
  from: AppointmentLocalDateSchema,
  to: AppointmentLocalDateSchema,
  slots: z.array(AppointmentSlotSchema).max(500),
}).strict()

export type AppointmentAvailabilityResponse = z.infer<typeof AppointmentAvailabilityResponseSchema>

export const AppointmentBookingResponseSchema = z.object({
  ok: z.literal(true),
  status: z.literal("confirmed"),
  managementToken: z.string().min(32).max(128),
}).strict()

export type AppointmentBookingResponse = z.infer<typeof AppointmentBookingResponseSchema>

export const AppointmentCalendarProviders = ["google", "microsoft"] as const
export type AppointmentCalendarProvider = (typeof AppointmentCalendarProviders)[number]
export const AppointmentCalendarProviderSchema = z.enum(AppointmentCalendarProviders)

export const AppointmentCalendarConnectionStatuses = [
  "connected",
  "reauth_required",
  "revoked",
  "error",
] as const
export type AppointmentCalendarConnectionStatus = (typeof AppointmentCalendarConnectionStatuses)[number]
export const AppointmentCalendarConnectionStatusSchema = z.enum(AppointmentCalendarConnectionStatuses)

export const AppointmentCalendarEventStatuses = [
  "queued",
  "processing",
  "synced",
  "failed",
  "cancelled",
] as const
export type AppointmentCalendarEventStatus = (typeof AppointmentCalendarEventStatuses)[number]
export const AppointmentCalendarEventStatusSchema = z.enum(AppointmentCalendarEventStatuses)

export const AppointmentManagementActions = ["details", "cancel", "reschedule"] as const
export type AppointmentManagementAction = (typeof AppointmentManagementActions)[number]
export const AppointmentManagementActionSchema = z.enum(AppointmentManagementActions)

export const AppointmentManagementRequestSchema = z.object({
  token: z.string().trim().min(32).max(128),
  action: AppointmentManagementActionSchema,
  startAt: z.string().trim().min(1).max(64).refine(isDateTimeWithOffset, "Use an ISO date-time with a time-zone offset.").optional(),
}).strict().superRefine((request, ctx) => {
  if (request.action === "reschedule" && !request.startAt) {
    ctx.addIssue({ code: "custom", path: ["startAt"], message: "A new start time is required when rescheduling." })
  }
  if (request.action !== "reschedule" && request.startAt) {
    ctx.addIssue({ code: "custom", path: ["startAt"], message: "A new start time is only valid when rescheduling." })
  }
})
export type AppointmentManagementRequest = z.infer<typeof AppointmentManagementRequestSchema>

export const AppointmentManagementResponseSchema = z.object({
  ok: z.literal(true),
  action: z.enum(["details", "cancelled", "rescheduled"]),
  appointment: z.object({
    status: AppointmentStatusSchema,
    startAt: z.string().datetime({ offset: true }),
    endAt: z.string().datetime({ offset: true }),
    timezone: z.string().min(1),
  }).strict(),
}).strict()
export type AppointmentManagementResponse = z.infer<typeof AppointmentManagementResponseSchema>

export const APPOINTMENT_VARIANTS = ["appointments-01"] as const
export type AppointmentVariant = (typeof APPOINTMENT_VARIANTS)[number]
export const DEFAULT_APPOINTMENT_VARIANT = "appointments-01" satisfies AppointmentVariant

export const APPOINTMENT_PRESENTATIONS = ["inline", "dialog"] as const
export type AppointmentPresentation = (typeof APPOINTMENT_PRESENTATIONS)[number]
export const DEFAULT_APPOINTMENT_PRESENTATION = "dialog" satisfies AppointmentPresentation

/**
 * Sitegen/CMS-facing semantic booking section. Scheduling facts stay in
 * SiteSettings.appointments; this block owns only the copy and presentation
 * surface that lets a visitor start the booking flow.
 */
export const AppointmentSectionSchema = z.object({
  blockType: z.literal("appointments"),
  variant: z.enum(APPOINTMENT_VARIANTS),
  presentation: z.enum(APPOINTMENT_PRESENTATIONS).default(DEFAULT_APPOINTMENT_PRESENTATION),
  ...blockBaseShape,
  // Appointment effects are additive to the supplied image-led base. A new
  // appointment therefore defaults to no extra effect; null still means
  // inherit the site-wide setting for explicitly migrated/overridden data.
  backgroundMode: backgroundModeSchema.default("none"),
  image: optionalMediaRefSchema,
  heading: z.string().trim().min(1).max(160),
  body: z.string().trim().max(800).nullable().optional(),
  availabilityLabel: z.string().trim().min(1).max(80).default("Beschikbaarheid"),
  bookingLabel: z.string().trim().min(1).max(80).default("Afspraak aanvragen"),
  confirmationHeading: z.string().trim().min(1).max(160).default("Afspraak bevestigd"),
  confirmationBody: z.string().trim().max(500).nullable().optional(),
  privacyNote: z.string().trim().max(500).nullable().optional(),
}).strict().superRefine((block, ctx) => {
  if (block.backgroundMode === "image" && !block.image) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["image"],
      message: "An image background override requires a supplied image.",
    })
  }
})
export type AppointmentSection = z.infer<typeof AppointmentSectionSchema>

export const appointmentTimeToMinutes = (value: string): number => {
  const [hours, minutes] = value.split(":").map(Number)
  return hours! * 60 + minutes!
}
