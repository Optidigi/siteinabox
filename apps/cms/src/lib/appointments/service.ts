import "server-only"

import { createHash, randomBytes } from "node:crypto"
import type { Payload, PayloadRequest, Where } from "payload"
import {
  AppointmentAvailabilityQuerySchema,
  AppointmentBookingInputSchema,
  AppointmentManagementRequestSchema,
  AppointmentScheduleSettingsSchema,
  DEFAULT_APPOINTMENT_SCHEDULE,
  type AppointmentAvailabilityResponse,
  type AppointmentBookingInput,
  type AppointmentBookingResponse,
  type AppointmentManagementResponse,
  type AppointmentScheduleSettings,
} from "@siteinabox/contracts"
import type { Appointment, SiteSetting } from "@/payload-types"
import { relationshipId } from "@/lib/relationshipId"
import { APPOINTMENT_MANAGEMENT_KEY_ENV, sealAppointmentSecret } from "./secrets"
import { ensureAppointmentSideEffects } from "./sideEffects"
import {
  AppointmentScheduleError,
  appointmentStartMatchesSlot,
  buildAppointmentAvailability,
  localDateForInstant,
  type OccupiedAppointment,
} from "./schedule"

type AppointmentRecord = Appointment & {
  eventVersion?: number | null
  managementTokenDigest?: string | null
  managementTokenExpiresAt?: string | null
  encryptedManagementToken?: string | null
}

export class AppointmentUnavailableError extends Error {
  constructor(message = "Appointment booking is not available.") {
    super(message)
    this.name = "AppointmentUnavailableError"
  }
}

export class AppointmentConflictError extends Error {
  constructor(message = "That appointment time is no longer available.") {
    super(message)
    this.name = "AppointmentConflictError"
  }
}

export class AppointmentInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AppointmentInputError"
  }
}

export class AppointmentManagementNotFoundError extends Error {
  constructor() {
    super("The appointment management link is invalid or expired.")
    this.name = "AppointmentManagementNotFoundError"
  }
}

const DAY_MS = 24 * 60 * 60 * 1_000
const MANAGEMENT_TOKEN_BYTES = 32

const requestWithTransaction = (
  request: Partial<PayloadRequest> | undefined,
  transactionID: string | number,
): Partial<PayloadRequest> => ({
  ...(request ?? {}),
  transactionID,
})

const appointmentDate = (value: string | Date): Date => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new AppointmentUnavailableError("Stored appointment data is invalid.")
  return date
}

const numericTenantId = (value: number | string): number => {
  const tenantId = Number(value)
  if (!Number.isSafeInteger(tenantId) || tenantId <= 0) throw new AppointmentUnavailableError("The appointment tenant is invalid.")
  return tenantId
}

const isBookingConflict = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false
  const record = error as { code?: unknown; message?: unknown }
  return record.code === "23P01" || record.code === "23505" ||
    (typeof record.message === "string" && /appointments_active|appointments.*overlap|duplicate key/i.test(record.message))
}

const optionalText = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export const hashAppointmentManagementToken = (token: string): string =>
  createHash("sha256").update(token, "utf8").digest("hex")

const newManagementToken = (): string => randomBytes(MANAGEMENT_TOKEN_BYTES).toString("base64url")

const managementTokenExpiry = (endAt: string, retentionDays: number): string =>
  new Date(appointmentDate(endAt).getTime() + retentionDays * DAY_MS).toISOString()

export async function getAppointmentSchedule(
  payload: Payload,
  tenantId: number | string,
  req?: Partial<PayloadRequest>,
): Promise<AppointmentScheduleSettings> {
  const result = await payload.find({
    collection: "site-settings",
    where: { tenant: { equals: tenantId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    ...(req ? { req } : {}),
  })
  const settings = result.docs[0] as SiteSetting | undefined
  if (!settings?.appointments) return DEFAULT_APPOINTMENT_SCHEDULE
  const parsed = AppointmentScheduleSettingsSchema.safeParse(settings.appointments)
  if (!parsed.success) throw new AppointmentUnavailableError("Appointment availability is configured incorrectly.")
  return parsed.data
}

const occupiedForRange = async (
  payload: Payload,
  tenantId: number | string,
  from: Date,
  to: Date,
  req?: Partial<PayloadRequest>,
  excludeAppointmentId?: string | number,
): Promise<OccupiedAppointment[]> => {
  const clauses: Where[] = [
    { tenant: { equals: tenantId } },
    { status: { equals: "confirmed" } },
    { startAt: { less_than: to.toISOString() } },
    { endAt: { greater_than: from.toISOString() } },
  ]
  if (excludeAppointmentId != null) clauses.push({ id: { not_equals: excludeAppointmentId } })
  const occupied: OccupiedAppointment[] = []
  let page = 1
  while (true) {
    const result = await payload.find({
      collection: "appointments",
      where: { and: clauses },
      limit: 500,
      page,
      depth: 0,
      overrideAccess: true,
      ...(req ? { req } : {}),
    })
    occupied.push(...result.docs.map((appointment) => ({ startAt: appointment.startAt, endAt: appointment.endAt })))
    if (result.hasNextPage !== true) break
    page += 1
  }
  return occupied
}

const slotsForDate = async (input: {
  payload: Payload
  tenantId: number | string
  settings: AppointmentScheduleSettings
  requestedStart: Date
  now: Date
  req?: Partial<PayloadRequest>
  excludeAppointmentId?: string | number
}): Promise<AppointmentAvailabilityResponse> => {
  const localDate = localDateForInstant(input.requestedStart, input.settings.timezone)
  const occupied = await occupiedForRange(
    input.payload,
    input.tenantId,
    new Date(input.requestedStart.getTime() - DAY_MS),
    new Date(input.requestedStart.getTime() + DAY_MS),
    input.req,
    input.excludeAppointmentId,
  )
  try {
    return buildAppointmentAvailability({
      settings: input.settings,
      from: localDate,
      to: localDate,
      now: input.now,
      occupied,
    })
  } catch (error) {
    if (error instanceof AppointmentScheduleError) throw new AppointmentInputError(error.message)
    throw error
  }
}

const matchingSlot = (availability: AppointmentAvailabilityResponse, requestedStart: Date) => {
  const slot = availability.slots.find((candidate) => appointmentStartMatchesSlot(candidate, requestedStart.toISOString()))
  if (!slot) throw new AppointmentConflictError()
  return slot
}

export async function listAppointmentAvailability(input: {
  payload: Payload
  tenantId: number | string
  query: { from: string; to?: string }
  now?: Date
}): Promise<AppointmentAvailabilityResponse> {
  const parsedQuery = AppointmentAvailabilityQuerySchema.safeParse(input.query)
  if (!parsedQuery.success) throw new AppointmentInputError("The requested availability range is invalid.")
  const settings = await getAppointmentSchedule(input.payload, input.tenantId)
  const from = new Date(`${parsedQuery.data.from}T00:00:00.000Z`)
  const toDate = new Date(`${parsedQuery.data.to ?? parsedQuery.data.from}T23:59:59.999Z`)
  const occupied = settings.enabled
    ? await occupiedForRange(input.payload, input.tenantId, new Date(from.getTime() - DAY_MS), new Date(toDate.getTime() + DAY_MS))
    : []
  try {
    return buildAppointmentAvailability({
      settings,
      from: parsedQuery.data.from,
      to: parsedQuery.data.to,
      now: input.now,
      occupied,
    })
  } catch (error) {
    if (error instanceof AppointmentScheduleError) throw new AppointmentInputError(error.message)
    throw error
  }
}

export async function bookAppointment(input: {
  payload: Payload
  tenantId: number | string
  booking: AppointmentBookingInput
  now?: Date
  req?: PayloadRequest
}): Promise<AppointmentBookingResponse> {
  const parsedBooking = AppointmentBookingInputSchema.safeParse(input.booking)
  if (!parsedBooking.success) throw new AppointmentInputError("The appointment details are invalid.")
  if (optionalText(parsedBooking.data.honeypot)) throw new AppointmentInputError("The appointment request could not be accepted.")

  const tenantId = numericTenantId(input.tenantId)
  const settings = await getAppointmentSchedule(input.payload, tenantId, input.req)
  if (!settings.enabled) throw new AppointmentUnavailableError()

  const now = input.now ?? new Date()
  const requestedStart = appointmentDate(parsedBooking.data.startAt)
  const availability = await slotsForDate({
    payload: input.payload,
    tenantId,
    settings,
    requestedStart,
    now,
    req: input.req,
  })
  const slot = matchingSlot(availability, requestedStart)
  const managementToken = newManagementToken()
  let encryptedManagementToken: string
  try {
    encryptedManagementToken = sealAppointmentSecret(
      managementToken,
      "appointment-management-token",
      process.env,
      APPOINTMENT_MANAGEMENT_KEY_ENV,
    )
  } catch (error) {
    throw new AppointmentUnavailableError(error instanceof Error ? error.message : "Appointment management is not configured.")
  }

  const transactionID = await input.payload.db.beginTransaction()
  if (!transactionID) throw new AppointmentUnavailableError("The appointment could not be secured.")
  const request = requestWithTransaction(input.req, transactionID)
  try {
    const currentOccupancy = await occupiedForRange(
      input.payload,
      tenantId,
      new Date(requestedStart.getTime() - DAY_MS),
      new Date(requestedStart.getTime() + DAY_MS),
      request,
    )
    const currentAvailability = buildAppointmentAvailability({
      settings,
      from: localDateForInstant(requestedStart, settings.timezone),
      to: localDateForInstant(requestedStart, settings.timezone),
      now,
      occupied: currentOccupancy,
    })
    if (!currentAvailability.slots.some((candidate) => appointmentStartMatchesSlot(candidate, requestedStart.toISOString()))) {
      throw new AppointmentConflictError()
    }

    const appointment = await input.payload.create({
      collection: "appointments",
      overrideAccess: true,
      data: {
        tenant: tenantId,
        status: "confirmed",
        startAt: slot.startAt,
        endAt: slot.endAt,
        timezone: settings.timezone,
        durationMinutes: settings.durationMinutes,
        visitorName: parsedBooking.data.visitorName.trim(),
        visitorEmail: parsedBooking.data.visitorEmail.trim().toLowerCase(),
        visitorPhone: optionalText(parsedBooking.data.visitorPhone),
        visitorNote: optionalText(parsedBooking.data.visitorNote),
        pageUrl: optionalText(parsedBooking.data.pageUrl),
        source: "website",
        eventVersion: 1,
        managementTokenDigest: hashAppointmentManagementToken(managementToken),
        managementTokenExpiresAt: managementTokenExpiry(slot.endAt, settings.retentionDays),
        encryptedManagementToken,
      },
      req: request as PayloadRequest,
    }) as AppointmentRecord

    await ensureAppointmentSideEffects({
      payload: input.payload,
      appointmentId: appointment.id,
      tenantId,
      eventVersion: 1,
      kind: "confirmation",
      status: "confirmed",
      now,
      req: request,
    })
    await input.payload.db.commitTransaction(transactionID)
    return { ok: true, status: "confirmed", managementToken }
  } catch (error) {
    await input.payload.db.rollbackTransaction(transactionID).catch(() => undefined)
    if (error instanceof AppointmentConflictError) throw error
    if (isBookingConflict(error)) throw new AppointmentConflictError()
    throw error
  }
}

const appointmentTenantMatches = (appointment: AppointmentRecord, tenantId: number | string): boolean =>
  relationshipId(appointment.tenant) === String(tenantId)

const appointmentEventVersion = (appointment: AppointmentRecord): number => {
  const version = Number(appointment.eventVersion ?? 1)
  return Number.isSafeInteger(version) && version >= 1 ? version : 1
}

const loadManagedAppointment = async (input: {
  payload: Payload
  tenantId: number | string
  token: string
  now: Date
  req?: Partial<PayloadRequest>
}): Promise<AppointmentRecord> => {
  const digest = hashAppointmentManagementToken(input.token)
  const result = await input.payload.find({
    collection: "appointments",
    where: {
      and: [
        { tenant: { equals: input.tenantId } },
        { managementTokenDigest: { equals: digest } },
        { managementTokenExpiresAt: { greater_than: input.now.toISOString() } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    ...(input.req ? { req: input.req } : {}),
  })
  const appointment = result.docs[0] as AppointmentRecord | undefined
  if (!appointment) throw new AppointmentManagementNotFoundError()
  return appointment
}

const managementAppointmentView = (appointment: AppointmentRecord): AppointmentManagementResponse["appointment"] => ({
  status: appointment.status,
  startAt: appointmentDate(appointment.startAt).toISOString(),
  endAt: appointmentDate(appointment.endAt).toISOString(),
  timezone: appointment.timezone,
})

const ensureCancellationAllowed = (appointment: AppointmentRecord, settings: AppointmentScheduleSettings, now: Date): void => {
  if (appointment.status !== "confirmed") throw new AppointmentConflictError("This appointment is no longer open for visitor changes.")
  const cutoff = appointmentDate(appointment.startAt).getTime() - settings.minimumCancellationNoticeMinutes * 60_000
  if (now.getTime() >= cutoff) throw new AppointmentConflictError("This appointment can no longer be changed online.")
}

export async function manageAppointment(input: {
  payload: Payload
  tenantId: number | string
  request: unknown
  now?: Date
}): Promise<AppointmentManagementResponse> {
  const parsed = AppointmentManagementRequestSchema.safeParse(input.request)
  if (!parsed.success) throw new AppointmentInputError("The appointment management request is invalid.")
  const tenantId = numericTenantId(input.tenantId)
  const now = input.now ?? new Date()
  const appointment = await loadManagedAppointment({ payload: input.payload, tenantId, token: parsed.data.token, now })
  if (parsed.data.action === "details") {
    return { ok: true, action: "details", appointment: managementAppointmentView(appointment) }
  }

  const settings = await getAppointmentSchedule(input.payload, tenantId)
  ensureCancellationAllowed(appointment, settings, now)
  const transactionID = await input.payload.db.beginTransaction()
  if (!transactionID) throw new AppointmentUnavailableError("The appointment could not be changed.")
  const request = requestWithTransaction(undefined, transactionID)
  try {
    const current = await loadManagedAppointment({ payload: input.payload, tenantId, token: parsed.data.token, now, req: request })
    ensureCancellationAllowed(current, settings, now)
    const currentVersion = appointmentEventVersion(current)
    if (parsed.data.action === "cancel") {
      const updated = await input.payload.update({
        collection: "appointments",
        id: current.id,
        data: { status: "cancelled", eventVersion: currentVersion + 1 },
        overrideAccess: true,
        req: request as PayloadRequest,
        context: { appointmentLifecycleMutation: true },
      }) as AppointmentRecord
      await ensureAppointmentSideEffects({
        payload: input.payload,
        appointmentId: updated.id,
        tenantId,
        eventVersion: currentVersion + 1,
        kind: "cancelled",
        status: "cancelled",
        now,
        req: request,
      })
      await input.payload.db.commitTransaction(transactionID)
      return { ok: true, action: "cancelled", appointment: managementAppointmentView(updated) }
    }

    const requestedStart = appointmentDate(parsed.data.startAt!)
    const availability = await slotsForDate({
      payload: input.payload,
      tenantId,
      settings,
      requestedStart,
      now,
      req: request,
      excludeAppointmentId: current.id,
    })
    const slot = matchingSlot(availability, requestedStart)
    const updated = await input.payload.update({
      collection: "appointments",
      id: current.id,
      data: {
        status: "confirmed",
        startAt: slot.startAt,
        endAt: slot.endAt,
        timezone: settings.timezone,
        durationMinutes: settings.durationMinutes,
        eventVersion: currentVersion + 1,
        managementTokenExpiresAt: managementTokenExpiry(slot.endAt, settings.retentionDays),
      },
      overrideAccess: true,
      req: request as PayloadRequest,
      context: { appointmentLifecycleMutation: true },
    }) as AppointmentRecord
    await ensureAppointmentSideEffects({
      payload: input.payload,
      appointmentId: updated.id,
      tenantId,
      eventVersion: currentVersion + 1,
      kind: "rescheduled",
      status: "confirmed",
      now,
      req: request,
    })
    await input.payload.db.commitTransaction(transactionID)
    return { ok: true, action: "rescheduled", appointment: managementAppointmentView(updated) }
  } catch (error) {
    await input.payload.db.rollbackTransaction(transactionID).catch(() => undefined)
    if (error instanceof AppointmentConflictError || error instanceof AppointmentInputError || error instanceof AppointmentManagementNotFoundError) throw error
    if (isBookingConflict(error)) throw new AppointmentConflictError()
    throw error
  }
}

const allowedAdminStatus = new Set(["cancelled", "completed", "no_show"])

export async function updateAppointmentStatus(input: {
  payload: Payload
  appointmentId: string | number
  tenantId?: string | number
  status: Appointment["status"]
  req?: PayloadRequest
}): Promise<Appointment> {
  if (!allowedAdminStatus.has(input.status)) throw new AppointmentInputError("The requested appointment status is not an allowed transition.")
  const current = await input.payload.findByID({
    collection: "appointments",
    id: input.appointmentId,
    depth: 0,
    overrideAccess: true,
    ...(input.req ? { req: input.req } : {}),
  }) as AppointmentRecord
  if (input.tenantId != null && !appointmentTenantMatches(current, input.tenantId)) throw new AppointmentManagementNotFoundError()
  if (current.status !== "confirmed") throw new AppointmentConflictError("Only confirmed appointments can change status.")

  const transactionID = await input.payload.db.beginTransaction()
  if (!transactionID) throw new AppointmentUnavailableError("The appointment status could not be changed.")
  const request = requestWithTransaction(input.req, transactionID)
  try {
    const version = appointmentEventVersion(current) + 1
    const updated = await input.payload.update({
      collection: "appointments",
      id: current.id,
      data: { status: input.status, eventVersion: version },
      ...(input.req?.user ? { user: input.req.user } : {}),
      req: request as PayloadRequest,
      overrideAccess: true,
      context: { appointmentLifecycleMutation: true },
    }) as AppointmentRecord
    const tenantId = relationshipId(updated.tenant)
    if (!tenantId) throw new AppointmentUnavailableError("The appointment tenant is invalid.")
    await ensureAppointmentSideEffects({
      payload: input.payload,
      appointmentId: updated.id,
      tenantId,
      eventVersion: version,
      ...(input.status === "cancelled" ? { kind: "cancelled" as const } : {}),
      status: input.status,
      req: request,
    })
    await input.payload.db.commitTransaction(transactionID)
    return updated
  } catch (error) {
    await input.payload.db.rollbackTransaction(transactionID).catch(() => undefined)
    if (error instanceof AppointmentConflictError || error instanceof AppointmentInputError || error instanceof AppointmentManagementNotFoundError) throw error
    if (isBookingConflict(error)) throw new AppointmentConflictError()
    throw error
  }
}
