import "server-only"

import type { Payload, PayloadRequest, Where } from "payload"
import { APPOINTMENT_NOTIFICATION_TEMPLATE_VERSION } from "@/lib/email/templates/appointments"

type AppointmentSideEffectRecord = {
  id: string | number
  [key: string]: unknown
}

type AppointmentSideEffectPayload = {
  find(args: {
    collection: string
    where: Where
    limit: number
    page?: number
    depth: number
    overrideAccess: true
    req?: Partial<PayloadRequest>
  }): Promise<{ docs: AppointmentSideEffectRecord[]; hasNextPage?: boolean }>
  create(args: {
    collection: string
    data: Record<string, unknown>
    depth: number
    overrideAccess: true
    req?: Partial<PayloadRequest>
    context?: Record<string, unknown>
  }): Promise<AppointmentSideEffectRecord>
  update(args: {
    collection: string
    id?: string | number
    where?: Where
    data: Record<string, unknown>
    depth: number
    overrideAccess: true
    req?: Partial<PayloadRequest>
    context?: Record<string, unknown>
  }): Promise<AppointmentSideEffectRecord | { docs: AppointmentSideEffectRecord[] }>
}

const sideEffectPayload = (payload: Payload): AppointmentSideEffectPayload =>
  payload as unknown as AppointmentSideEffectPayload

export type AppointmentSideEffectKind = "confirmation" | "cancelled" | "rescheduled"

const lifecycleContext = { appointmentNotificationLifecycleMutation: true }
const calendarLifecycleContext = { appointmentCalendarLifecycleMutation: true }

const notificationKey = (
  appointmentId: string | number,
  eventVersion: number,
  kind: AppointmentSideEffectKind,
  recipientKind: "visitor" | "tenant",
  recipientEmail?: string,
) => `appointment:${appointmentId}:${eventVersion}:${kind}:${recipientKind}:${recipientEmail ?? "visitor"}`

const eventKey = (appointmentId: string | number, connectionId: string | number) =>
  `appointment:${appointmentId}:calendar:${connectionId}`

const createIfMissing = async (
  payload: AppointmentSideEffectPayload,
  input: {
    collection: string
    where: Where
    data: Record<string, unknown>
    req?: Partial<PayloadRequest>
    context?: Record<string, unknown>
  },
): Promise<AppointmentSideEffectRecord> => {
  const existing = await payload.find({ collection: input.collection, where: input.where, limit: 1, depth: 0, overrideAccess: true, ...(input.req ? { req: input.req } : {}) })
  if (existing.docs[0]) return existing.docs[0]
  try {
    return await payload.create({
      collection: input.collection,
      data: input.data,
      depth: 0,
      overrideAccess: true,
      ...(input.req ? { req: input.req } : {}),
      ...(input.context ? { context: input.context } : {}),
    })
  } catch (error) {
    const raced = await payload.find({ collection: input.collection, where: input.where, limit: 1, depth: 0, overrideAccess: true, ...(input.req ? { req: input.req } : {}) })
    if (raced.docs[0]) return raced.docs[0]
    throw error
  }
}

/**
 * Create the durable side effects for one appointment event in the same
 * transaction as the appointment mutation. The workers are deliberately
 * separate from booking/lifecycle requests: email and calendar APIs must not
 * hold the booking transaction open, and a provider outage must not lose the
 * appointment itself.
 */
export async function ensureAppointmentSideEffects(input: {
  payload: Payload
  appointmentId: string | number
  tenantId: string | number
  eventVersion: number
  kind?: AppointmentSideEffectKind
  status: "confirmed" | "cancelled" | "completed" | "no_show"
  now?: Date
  req?: Partial<PayloadRequest>
}): Promise<void> {
  const payload = sideEffectPayload(input.payload)
  const now = (input.now ?? new Date()).toISOString()
  if (input.kind) {
    // A newer appointment version supersedes queued, failed, or leased mail.
    // The worker checks the appointment again before sending, covering the
    // small race where a delivery is already being processed.
    await payload.update({
      collection: "appointment-notification-deliveries",
      where: {
        and: [
          { appointment: { equals: input.appointmentId } },
          { eventVersion: { less_than: input.eventVersion } },
          { status: { in: ["queued", "failed", "processing"] } },
        ],
      },
      data: {
        status: "cancelled",
        leaseUntil: null,
        retryState: "permanent",
        lastError: "Superseded by a newer appointment version.",
      },
      depth: 0,
      overrideAccess: true,
      ...(input.req ? { req: input.req } : {}),
      context: lifecycleContext,
    })

    const visitorKey = notificationKey(input.appointmentId, input.eventVersion, input.kind, "visitor")
    await createIfMissing(payload, {
      collection: "appointment-notification-deliveries",
      where: { notificationKey: { equals: visitorKey } },
      data: {
        notificationKey: visitorKey,
        appointment: Number(input.appointmentId),
        tenant: Number(input.tenantId),
        recipientKind: "visitor",
        kind: input.kind,
        eventVersion: input.eventVersion,
        templateVersion: APPOINTMENT_NOTIFICATION_TEMPLATE_VERSION,
        status: "queued",
        attemptCount: 0,
        nextAttemptAt: now,
      },
      req: input.req,
      context: lifecycleContext,
    })

    const tenantRecipients = new Set<string>()
    let subscriptionPage = 1
    while (true) {
      const subscriptions = await payload.find({
        collection: "tenant-notification-subscriptions",
        where: {
          and: [
            { tenant: { equals: input.tenantId } },
            { appointmentBookings: { equals: true } },
          ],
        },
        limit: 100,
        page: subscriptionPage,
        depth: 1,
        overrideAccess: true,
        ...(input.req ? { req: input.req } : {}),
      })
      for (const subscription of subscriptions.docs) {
        const email = typeof subscription.email === "string" ? subscription.email.trim().toLowerCase() : ""
        const user = subscription.user && typeof subscription.user === "object" && !Array.isArray(subscription.user)
          ? subscription.user as { email?: unknown; tenants?: unknown }
          : null
        const memberEmail = typeof user?.email === "string" ? user.email.trim().toLowerCase() : ""
        const memberships = Array.isArray(user?.tenants) ? user.tenants : []
        const belongsToTenant = memberships.some((membership) => {
          if (!membership || typeof membership !== "object" || Array.isArray(membership)) return false
          const memberTenant = (membership as { tenant?: unknown }).tenant
          if (typeof memberTenant === "number" || typeof memberTenant === "string") return String(memberTenant) === String(input.tenantId)
          if (!memberTenant || typeof memberTenant !== "object" || Array.isArray(memberTenant)) return false
          const memberTenantId = (memberTenant as { id?: unknown }).id
          return typeof memberTenantId === "number" || typeof memberTenantId === "string"
            ? String(memberTenantId) === String(input.tenantId)
            : false
        })
        if (email && email === memberEmail && belongsToTenant) tenantRecipients.add(email)
      }
      if (subscriptions.hasNextPage !== true) break
      subscriptionPage += 1
    }

    for (const recipientEmail of [...tenantRecipients].sort()) {
      const recipientKind = "tenant" as const
      const key = notificationKey(input.appointmentId, input.eventVersion, input.kind, recipientKind, recipientEmail)
      await createIfMissing(payload, {
        collection: "appointment-notification-deliveries",
        where: { notificationKey: { equals: key } },
        data: {
          notificationKey: key,
          appointment: Number(input.appointmentId),
          tenant: Number(input.tenantId),
          recipientKind,
          recipientEmail,
          kind: input.kind,
          eventVersion: input.eventVersion,
          templateVersion: APPOINTMENT_NOTIFICATION_TEMPLATE_VERSION,
          status: "queued",
          attemptCount: 0,
          nextAttemptAt: now,
        },
        req: input.req,
        context: lifecycleContext,
      })
    }
  }

  const operation = input.status === "confirmed" ? "upsert" : "delete"
  let connectionPage = 1
  while (true) {
    const connections = await payload.find({
      collection: "appointment-calendar-connections",
      where: {
        and: [
          { tenant: { equals: input.tenantId } },
          { status: { in: input.status === "confirmed" ? ["connected"] : ["connected", "reauth_required", "error", "revoked"] } },
        ],
      },
      limit: 100,
      page: connectionPage,
      depth: 0,
      overrideAccess: true,
      ...(input.req ? { req: input.req } : {}),
    })
    for (const connection of connections.docs) {
      const key = eventKey(input.appointmentId, connection.id)
      const existing = await payload.find({
        collection: "appointment-calendar-events",
        where: { eventKey: { equals: key } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
        ...(input.req ? { req: input.req } : {}),
      })
      const data = {
        eventKey: key,
        appointment: Number(input.appointmentId),
        connection: Number(connection.id),
        eventVersion: input.eventVersion,
        status: "queued",
        operation,
        attemptCount: 0,
        nextAttemptAt: now,
        leaseUntil: null,
        lastError: null,
      }
      if (existing.docs[0]) {
        await payload.update({
          collection: "appointment-calendar-events",
          id: existing.docs[0].id,
          data: {
            eventVersion: input.eventVersion,
            status: "queued",
            operation,
            attemptCount: 0,
            nextAttemptAt: now,
            leaseUntil: null,
            lastError: null,
          },
          depth: 0,
          overrideAccess: true,
          ...(input.req ? { req: input.req } : {}),
          context: calendarLifecycleContext,
        })
      } else {
        await createIfMissing(payload, {
          collection: "appointment-calendar-events",
          where: { eventKey: { equals: key } },
          data,
          req: input.req,
          context: calendarLifecycleContext,
        })
      }
    }
    if (connections.hasNextPage !== true) break
    connectionPage += 1
  }
}
