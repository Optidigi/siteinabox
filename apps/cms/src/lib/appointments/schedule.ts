import { TZDate } from "@date-fns/tz"
import {
  AppointmentAvailabilityResponseSchema,
  AppointmentLocalDateSchema,
  MAX_APPOINTMENT_RANGE_DAYS,
  AppointmentScheduleSettingsSchema,
  appointmentTimeToMinutes,
  type AppointmentAvailabilityResponse,
  type AppointmentScheduleSettings,
  type AppointmentTimeWindow,
  type AppointmentWeekday,
} from "@siteinabox/contracts"

export const MAX_APPOINTMENT_SLOTS = 500

export { MAX_APPOINTMENT_RANGE_DAYS } from "@siteinabox/contracts"

export type OccupiedAppointment = {
  startAt: string | Date
  endAt: string | Date
}

export class AppointmentScheduleError extends Error {
  code: "invalid_schedule" | "invalid_range"

  constructor(code: AppointmentScheduleError["code"], message: string) {
    super(message)
    this.name = "AppointmentScheduleError"
    this.code = code
  }
}

const WEEKDAY_INDEX: Record<AppointmentWeekday, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 0,
}

const dateParts = (value: string): [number, number, number] => {
  const [year, month, day] = value.split("-").map(Number)
  return [year!, month!, day!]
}

export const addLocalDays = (value: string, days: number): string => {
  const [year, month, day] = dateParts(value)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return [
    date.getUTCFullYear().toString().padStart(4, "0"),
    (date.getUTCMonth() + 1).toString().padStart(2, "0"),
    date.getUTCDate().toString().padStart(2, "0"),
  ].join("-")
}

export const localDateTimeToInstant = (date: string, time: string, timezone: string): Date => {
  const [year, month, day] = dateParts(date)
  const minutes = appointmentTimeToMinutes(time)
  const zoned = TZDate.tz(timezone, year, month - 1, day, Math.floor(minutes / 60), minutes % 60)
  return new Date(zoned.getTime())
}

const localWeekday = (date: string, timezone: string): number => {
  const [year, month, day] = dateParts(date)
  return TZDate.tz(timezone, year, month - 1, day, 12, 0).getDay()
}

export const localDateForInstant = (instant: Date, timezone: string): string => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant)
  const values = new Map(parts.map((part) => [part.type, part.value]))
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`
}

const localDateTimeForInstant = (instant: Date, timezone: string): string =>
  TZDate.tz(timezone, instant).toISOString()

const dateDistance = (from: string, to: string): number => {
  const [fromYear, fromMonth, fromDay] = dateParts(from)
  const [toYear, toMonth, toDay] = dateParts(to)
  return Math.round((Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) / 86_400_000)
}

const asDate = (value: string | Date): Date => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new AppointmentScheduleError("invalid_schedule", "Stored appointment data contains an invalid date.")
  return date
}

const windowsForDate = (settings: AppointmentScheduleSettings, date: string): AppointmentTimeWindow[] => {
  const override = settings.dateOverrides.find((entry) => entry.date === date)
  if (override) return override.windows
  const weekday = Object.entries(WEEKDAY_INDEX).find(([, index]) => index === localWeekday(date, settings.timezone))?.[0] as AppointmentWeekday | undefined
  return settings.weeklyAvailability.find((entry) => entry.weekday === weekday)?.windows ?? []
}

const isAvailable = (
  candidateStart: Date,
  candidateEnd: Date,
  settings: AppointmentScheduleSettings,
  occupied: OccupiedAppointment[],
): boolean => {
  const start = candidateStart.getTime() - settings.bufferBeforeMinutes * 60_000
  const end = candidateEnd.getTime() + settings.bufferAfterMinutes * 60_000
  return occupied.every((entry) => {
    const occupiedStart = asDate(entry.startAt).getTime() - settings.bufferBeforeMinutes * 60_000
    const occupiedEnd = asDate(entry.endAt).getTime() + settings.bufferAfterMinutes * 60_000
    return start >= occupiedEnd || end <= occupiedStart
  })
}

const validateRange = (from: string, to: string): void => {
  const fromResult = AppointmentLocalDateSchema.safeParse(from)
  const toResult = AppointmentLocalDateSchema.safeParse(to)
  if (!fromResult.success || !toResult.success || to < from || dateDistance(from, to) > MAX_APPOINTMENT_RANGE_DAYS) {
    throw new AppointmentScheduleError("invalid_range", `Availability requests must cover at most ${MAX_APPOINTMENT_RANGE_DAYS} days.`)
  }
}

export function buildAppointmentAvailability(input: {
  settings: AppointmentScheduleSettings
  from: string
  to?: string
  now?: Date
  occupied?: OccupiedAppointment[]
}): AppointmentAvailabilityResponse {
  const parsedSettings = AppointmentScheduleSettingsSchema.safeParse(input.settings)
  if (!parsedSettings.success) {
    throw new AppointmentScheduleError("invalid_schedule", "Appointment availability is not configured correctly.")
  }
  const settings = parsedSettings.data
  const from = input.from
  const to = input.to ?? from
  validateRange(from, to)

  if (!settings.enabled) {
    return { timezone: settings.timezone, from, to, slots: [] }
  }

  const now = input.now ?? new Date()
  const today = localDateForInstant(now, settings.timezone)
  const lastBookableDate = addLocalDays(today, settings.bookingWindowDays)
  const firstDate = from < today ? today : from
  const lastDate = to > lastBookableDate ? lastBookableDate : to
  const minimumStart = now.getTime() + settings.minimumNoticeMinutes * 60_000
  const occupied = input.occupied ?? []
  const slots: AppointmentAvailabilityResponse["slots"] = []

  if (lastDate < firstDate) return { timezone: settings.timezone, from, to, slots }

  for (let dayOffset = 0; dayOffset <= dateDistance(firstDate, lastDate); dayOffset += 1) {
    const date = addLocalDays(firstDate, dayOffset)
    for (const window of windowsForDate(settings, date)) {
      const windowStart = appointmentTimeToMinutes(window.start)
      const windowEnd = appointmentTimeToMinutes(window.end)
      for (let startMinutes = windowStart; startMinutes + settings.durationMinutes <= windowEnd; startMinutes += settings.slotIntervalMinutes) {
        const startAt = localDateTimeToInstant(date, `${Math.floor(startMinutes / 60).toString().padStart(2, "0")}:${(startMinutes % 60).toString().padStart(2, "0")}`, settings.timezone)
        const endAt = new Date(startAt.getTime() + settings.durationMinutes * 60_000)
        if (startAt.getTime() < minimumStart || !isAvailable(startAt, endAt, settings, occupied)) continue
        slots.push({
          startAt: localDateTimeForInstant(startAt, settings.timezone),
          endAt: localDateTimeForInstant(endAt, settings.timezone),
          timezone: settings.timezone,
        })
        if (slots.length >= MAX_APPOINTMENT_SLOTS) {
          return AppointmentAvailabilityResponseSchema.parse({ timezone: settings.timezone, from, to, slots })
        }
      }
    }
  }

  return AppointmentAvailabilityResponseSchema.parse({ timezone: settings.timezone, from, to, slots })
}

export const appointmentStartMatchesSlot = (
  slot: AppointmentAvailabilityResponse["slots"][number],
  startAt: string,
): boolean => new Date(slot.startAt).getTime() === new Date(startAt).getTime()
