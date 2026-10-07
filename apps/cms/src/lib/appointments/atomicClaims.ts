import "server-only"

import type { Payload, Where } from "payload"
import { z } from "zod"
import type { AppointmentCalendarEvent, AppointmentCalendarOauthState, AppointmentNotificationDelivery, CommerceNotificationDelivery, LegalNotificationDelivery } from "@/payload-types"

export type AppointmentAtomicClaimPayload = Pick<Payload, "db">
export class AppointmentAtomicClaimError extends Error {
  constructor() {
    super("Appointment claim could not be verified atomically.")
    this.name = "AppointmentAtomicClaimError"
  }
}

const idSchema = z.number().int().positive().safe()
const countSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1)
const timestampSchema = z.string().datetime({ offset: true })
const leaseSchema = z.object({ id: idSchema, status: z.literal("processing"), attemptCount: countSchema, eventVersion: idSchema, lastAttemptAt: timestampSchema, leaseUntil: timestampSchema, lastError: z.null(), updatedAt: timestampSchema })
const checked = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new AppointmentAtomicClaimError()
  return parsed.data
}

// Only reviewed main-table claim fields reach this internal adapter seam.
// Payload Local API bulk update first selects records, so it is not a CAS.
// The pinned Postgres adapter's atomic:true branch executes UPDATE ... WHERE
// ... RETURNING directly. Unsupported adapters must never fall back to bulk.
const atomicUpdate = async (payload: AppointmentAtomicClaimPayload, collection: "appointment-calendar-oauth-states" | "appointment-calendar-events" | "appointment-notification-deliveries" | "commerce-notification-deliveries" | "legal-notification-deliveries", where: Where, data: Record<string, string | number | boolean | null>): Promise<unknown> => {
  if (!payload.db || payload.db.name !== "postgres" || typeof payload.db.updateOne !== "function") throw new AppointmentAtomicClaimError()
  try {
    const receipt: unknown = await payload.db.updateOne({ collection, where, data, options: { atomic: true }, returning: true })
    return receipt
  } catch {
    throw new AppointmentAtomicClaimError()
  }
}

export async function claimAppointmentCalendarOAuthState(payload: AppointmentAtomicClaimPayload, original: AppointmentCalendarOauthState, now: Date): Promise<AppointmentCalendarOauthState | null> {
  checked(idSchema, original.id)
  const usedAt = checked(timestampSchema, now.toISOString())
  const receipt = await atomicUpdate(payload, "appointment-calendar-oauth-states", { and: [
    { id: { equals: original.id } }, { stateDigest: { equals: original.stateDigest } }, { provider: { equals: original.provider } },
    { updatedAt: { equals: original.updatedAt } }, { usedAt: { equals: null } }, { expiresAt: { greater_than: usedAt } },
  ] }, { usedAt, updatedAt: usedAt })
  if (receipt === null) return null
  const result = checked(z.object({ id: idSchema, stateDigest: z.string(), provider: z.enum(["google", "microsoft"]), usedAt: timestampSchema, updatedAt: timestampSchema }), receipt)
  if (result.id !== original.id || result.stateDigest !== original.stateDigest || result.provider !== original.provider || result.usedAt !== usedAt || result.updatedAt !== usedAt) throw new AppointmentAtomicClaimError()
  return { ...original, usedAt, updatedAt: usedAt }
}

const leaseClaim = async (payload: AppointmentAtomicClaimPayload, collection: "appointment-calendar-events" | "appointment-notification-deliveries", original: AppointmentCalendarEvent | AppointmentNotificationDelivery, now: Date, leaseMs: number): Promise<unknown> => {
  checked(idSchema, original.id)
  checked(idSchema, original.eventVersion)
  checked(countSchema, original.attemptCount)
  const lastAttemptAt = checked(timestampSchema, now.toISOString())
  const leaseUntil = checked(timestampSchema, new Date(now.getTime() + leaseMs).toISOString())
  const attemptCount = original.attemptCount + 1
  return atomicUpdate(payload, collection, { and: [
    { id: { equals: original.id } }, { eventVersion: { equals: original.eventVersion } },
    { attemptCount: { equals: original.attemptCount } }, { updatedAt: { equals: original.updatedAt } },
    ...(collection === "appointment-notification-deliveries" ? [{ or: [{ retryState: { equals: null } }, { retryState: { not_equals: "permanent" } }] }] : []),
    { or: [
      { and: [{ status: { in: ["queued", "failed"] } }, { nextAttemptAt: { less_than_equal: lastAttemptAt } }] },
      { and: [{ status: { equals: "processing" } }, { leaseUntil: { less_than_equal: lastAttemptAt } }] },
    ] },
  ] }, { status: "processing", attemptCount, lastAttemptAt, leaseUntil, lastError: null, updatedAt: lastAttemptAt })
}

const verifiedLease = (receipt: unknown, original: AppointmentCalendarEvent | AppointmentNotificationDelivery, now: Date, leaseMs: number) => {
  const result = checked(leaseSchema, receipt)
  if (result.id !== original.id || result.eventVersion !== original.eventVersion || result.attemptCount !== original.attemptCount + 1 || result.lastAttemptAt !== now.toISOString() || result.leaseUntil !== new Date(now.getTime() + leaseMs).toISOString() || result.updatedAt !== now.toISOString()) throw new AppointmentAtomicClaimError()
  return result
}

export async function claimAppointmentCalendarEvent(payload: AppointmentAtomicClaimPayload, original: AppointmentCalendarEvent, now: Date, leaseMs: number): Promise<AppointmentCalendarEvent | null> {
  const receipt = await leaseClaim(payload, "appointment-calendar-events", original, now, leaseMs)
  if (receipt === null) return null
  const lease = verifiedLease(receipt, original, now, leaseMs)
  const identity = checked(z.object({ eventKey: z.string().min(1), providerEventId: z.string().min(1).nullable().optional(), providerCreateUncertain: z.boolean().nullable().optional(), operation: z.enum(["upsert", "delete"]) }), receipt)
  if (identity.eventKey !== original.eventKey || identity.operation !== original.operation || (identity.providerEventId ?? null) !== (original.providerEventId ?? null) || (identity.providerCreateUncertain ?? false) !== (original.providerCreateUncertain ?? false)) throw new AppointmentAtomicClaimError()
  // The updatedAt predicate guarded this original generated document snapshot.
  // Merge only validated, owned claim fields; never assert the adapter Document.
  return { ...original, status: lease.status, attemptCount: lease.attemptCount, lastAttemptAt: lease.lastAttemptAt, leaseUntil: lease.leaseUntil, lastError: null, updatedAt: lease.updatedAt }
}

export async function claimAppointmentNotificationDelivery(payload: AppointmentAtomicClaimPayload, original: AppointmentNotificationDelivery, now: Date, leaseMs: number): Promise<AppointmentNotificationDelivery | null> {
  // Permanent processing state is a durable unknown write, including a dead worker.
  // SMTP and the current REST API cannot prove non-delivery or deduplicate a resend.
  if (original.retryState === "permanent") return null
  const receipt = await leaseClaim(payload, "appointment-notification-deliveries", original, now, leaseMs)
  if (receipt === null) return null
  const lease = verifiedLease(receipt, original, now, leaseMs)
  const identity = checked(z.object({ notificationKey: z.string().min(1), kind: z.enum(["confirmation", "cancelled", "rescheduled"]), recipientKind: z.enum(["visitor", "tenant"]) }), receipt)
  if (identity.notificationKey !== original.notificationKey || identity.kind !== original.kind || identity.recipientKind !== original.recipientKind) throw new AppointmentAtomicClaimError()
  return { ...original, status: lease.status, attemptCount: lease.attemptCount, lastAttemptAt: lease.lastAttemptAt, leaseUntil: lease.leaseUntil, lastError: null, updatedAt: lease.updatedAt }
}

export class AppointmentLeaseLostError extends AppointmentAtomicClaimError {
  constructor() { super(); this.name = "AppointmentLeaseLostError" }
}
const transitionFields = {
  eventVersion: idSchema.optional(), attemptCount: countSchema.optional(), nextAttemptAt: timestampSchema.optional(),
  leaseUntil: timestampSchema.nullable().optional(), lastError: z.string().nullable().optional(),
}
const calendarTransitionSchema = z.object({ ...transitionFields,
  status: z.enum(["queued", "processing", "synced", "failed", "cancelled"]).optional(),
  operation: z.enum(["upsert", "delete"]).optional(), providerEventId: z.string().min(1).nullable().optional(),
  providerCreateUncertain: z.boolean().optional(), syncedAt: timestampSchema.optional(),
}).strict()
const notificationTransitionSchema = z.object({ ...transitionFields,
  status: z.enum(["queued", "processing", "sent", "failed", "cancelled"]).optional(),
  sentAt: timestampSchema.optional(), provider: z.string().nullable().optional(), providerMessageId: z.string().nullable().optional(),
  retryState: z.enum(["none", "retryable", "permanent"]).optional(),
}).strict()
export type AppointmentCalendarTransition = z.infer<typeof calendarTransitionSchema>
export type AppointmentNotificationTransition = z.infer<typeof notificationTransitionSchema>

const ownedTransition = async (payload: AppointmentAtomicClaimPayload, collection: "appointment-calendar-events" | "appointment-notification-deliveries", claimed: AppointmentCalendarEvent | AppointmentNotificationDelivery, transition: AppointmentCalendarTransition | AppointmentNotificationTransition): Promise<void> => {
  const leaseUntil = checked(timestampSchema, claimed.leaseUntil)
  const updatedAt = checked(timestampSchema, new Date(Date.now()).toISOString())
  if (claimed.status !== "processing" || Date.parse(leaseUntil) <= Date.parse(updatedAt)) throw new AppointmentLeaseLostError()
  const data: Record<string, string | number | boolean | null> = { updatedAt }
  for (const [key, value] of Object.entries(transition)) if (value !== undefined) data[key] = value
  const receipt = await atomicUpdate(payload, collection, { and: [
    { id: { equals: claimed.id } }, { status: { equals: "processing" } },
    { eventVersion: { equals: claimed.eventVersion } }, { attemptCount: { equals: claimed.attemptCount } },
    { leaseUntil: { equals: leaseUntil } }, { leaseUntil: { greater_than: updatedAt } },
  ] }, data)
  if (receipt === null) throw new AppointmentLeaseLostError()
  const result = checked(z.object({ id: idSchema, eventVersion: idSchema, attemptCount: countSchema, leaseUntil: timestampSchema.nullable(), status: z.string(), updatedAt: timestampSchema }), receipt)
  if (result.id !== claimed.id || result.eventVersion !== (transition.eventVersion ?? claimed.eventVersion) || result.attemptCount !== (transition.attemptCount ?? claimed.attemptCount) || result.leaseUntil !== (transition.leaseUntil === undefined ? leaseUntil : transition.leaseUntil) || result.status !== (transition.status ?? "processing") || result.updatedAt !== updatedAt) throw new AppointmentAtomicClaimError()
  const fields = checked(z.record(z.string(), z.unknown()), receipt)
  for (const [key, value] of Object.entries(data)) if (fields[key] !== value) throw new AppointmentAtomicClaimError()
}

export const transitionAppointmentCalendarEvent = (payload: AppointmentAtomicClaimPayload, claimed: AppointmentCalendarEvent, transition: AppointmentCalendarTransition): Promise<void> => ownedTransition(payload, "appointment-calendar-events", claimed, checked(calendarTransitionSchema, transition))
export const transitionAppointmentNotificationDelivery = (payload: AppointmentAtomicClaimPayload, claimed: AppointmentNotificationDelivery, transition: AppointmentNotificationTransition): Promise<void> => ownedTransition(payload, "appointment-notification-deliveries", claimed, checked(notificationTransitionSchema, transition))


type BusinessNotification = CommerceNotificationDelivery | LegalNotificationDelivery
type BusinessNotificationCollection = "commerce-notification-deliveries" | "legal-notification-deliveries"
const businessLeaseSchema = z.object({ id: idSchema, notificationKey: z.string().min(1), kind: z.string().min(1), status: z.literal("processing"), attemptCount: z.number().int().positive().safe(), lastAttemptAt: timestampSchema, leaseUntil: timestampSchema, updatedAt: timestampSchema })

async function claimBusinessNotification<T extends BusinessNotification>(payload: AppointmentAtomicClaimPayload, collection: BusinessNotificationCollection, original: T, now: Date, leaseMs: number): Promise<T | null> {
  if (original.retryState === "permanent") return null
  checked(idSchema, original.id)
  checked(countSchema, original.attemptCount)
  const lastAttemptAt = checked(timestampSchema, now.toISOString())
  const leaseUntil = checked(timestampSchema, new Date(now.getTime() + leaseMs).toISOString())
  const receipt = await atomicUpdate(payload, collection, { and: [
    { id: { equals: original.id } }, { notificationKey: { equals: original.notificationKey } },
    { kind: { equals: original.kind } }, { attemptCount: { equals: original.attemptCount } }, { updatedAt: { equals: original.updatedAt } },
    { or: [{ retryState: { equals: null } }, { retryState: { not_equals: "permanent" } }] },
    { or: [
      { and: [{ status: { in: ["queued", "failed"] } }, { nextAttemptAt: { less_than_equal: lastAttemptAt } }] },
      { and: [{ status: { equals: "processing" } }, { leaseUntil: { less_than_equal: lastAttemptAt } }] },
    ] },
  ] }, { status: "processing", attemptCount: original.attemptCount + 1, lastAttemptAt, leaseUntil, lastError: null, updatedAt: lastAttemptAt })
  if (receipt === null) return null
  const lease = checked(businessLeaseSchema, receipt)
  if (lease.id !== original.id || lease.notificationKey !== original.notificationKey || lease.kind !== original.kind || lease.attemptCount !== original.attemptCount + 1 || lease.lastAttemptAt !== lastAttemptAt || lease.leaseUntil !== leaseUntil || lease.updatedAt !== lastAttemptAt) throw new AppointmentAtomicClaimError()
  return { ...original, status: lease.status, attemptCount: lease.attemptCount, lastAttemptAt, leaseUntil, lastError: null, updatedAt: lastAttemptAt }
}

const businessTransitionSchema = z.object({
  status: z.enum(["queued", "processing", "sent", "failed", "cancelled"]).optional(),
  nextAttemptAt: timestampSchema.nullable().optional(), leaseUntil: timestampSchema.nullable().optional(),
  sentAt: timestampSchema.optional(), failedAt: timestampSchema.optional(),
  provider: z.string().nullable().optional(), providerMessageId: z.string().nullable().optional(),
  retryState: z.enum(["none", "retryable", "permanent"]).optional(), lastError: z.string().nullable().optional(),
}).strict()
const commerceTransitionSchema = businessTransitionSchema.omit({ provider: true, providerMessageId: true })
const legalTransitionSchema = businessTransitionSchema.omit({ failedAt: true }).extend({ nextAttemptAt: timestampSchema.optional() })
export type BusinessNotificationTransition = z.infer<typeof businessTransitionSchema>
export type CommerceNotificationTransition = z.infer<typeof commerceTransitionSchema>
export type LegalNotificationTransition = z.infer<typeof legalTransitionSchema>

async function transitionBusinessNotification(payload: AppointmentAtomicClaimPayload, collection: BusinessNotificationCollection, claimed: BusinessNotification, rawTransition: BusinessNotificationTransition): Promise<void> {
  const transition = checked(collection === "commerce-notification-deliveries" ? commerceTransitionSchema : legalTransitionSchema, rawTransition)
  const leaseUntil = checked(timestampSchema, claimed.leaseUntil)
  const currentTime = Math.max(Date.now(), Date.parse(checked(timestampSchema, claimed.lastAttemptAt)))
  const updatedAt = checked(timestampSchema, new Date(currentTime).toISOString())
  if (claimed.status !== "processing" || Date.parse(leaseUntil) <= currentTime) throw new AppointmentLeaseLostError()
  const data: Record<string, string | number | boolean | null> = { updatedAt }
  for (const [key, value] of Object.entries(transition)) if (value !== undefined) data[key] = value
  const receipt = await atomicUpdate(payload, collection, { and: [
    { id: { equals: claimed.id } }, { notificationKey: { equals: claimed.notificationKey } }, { kind: { equals: claimed.kind } },
    { status: { equals: "processing" } }, { attemptCount: { equals: claimed.attemptCount } },
    { leaseUntil: { equals: leaseUntil } }, { leaseUntil: { greater_than: updatedAt } },
  ] }, data)
  if (receipt === null) throw new AppointmentLeaseLostError()
  const result = checked(z.object({ id: idSchema, notificationKey: z.string().min(1), kind: z.string().min(1), attemptCount: z.number().int().positive().safe() }), receipt)
  if (result.id !== claimed.id || result.notificationKey !== claimed.notificationKey || result.kind !== claimed.kind || result.attemptCount !== claimed.attemptCount) throw new AppointmentAtomicClaimError()
  const fields = checked(z.record(z.string(), z.unknown()), receipt)
  for (const [key, value] of Object.entries(data)) if (fields[key] !== value) throw new AppointmentAtomicClaimError()
}

export const claimCommerceNotificationDelivery = (payload: AppointmentAtomicClaimPayload, original: CommerceNotificationDelivery, now: Date, leaseMs: number) => claimBusinessNotification(payload, "commerce-notification-deliveries", original, now, leaseMs)
export const claimLegalNotificationDelivery = (payload: AppointmentAtomicClaimPayload, original: LegalNotificationDelivery, now: Date, leaseMs: number) => claimBusinessNotification(payload, "legal-notification-deliveries", original, now, leaseMs)
export const transitionCommerceNotificationDelivery = (payload: AppointmentAtomicClaimPayload, claimed: CommerceNotificationDelivery, transition: CommerceNotificationTransition) => transitionBusinessNotification(payload, "commerce-notification-deliveries", claimed, transition)
export const transitionLegalNotificationDelivery = (payload: AppointmentAtomicClaimPayload, claimed: LegalNotificationDelivery, transition: LegalNotificationTransition) => transitionBusinessNotification(payload, "legal-notification-deliveries", claimed, transition)
