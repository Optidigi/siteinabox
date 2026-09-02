import "server-only"

import type { Payload } from "payload"
import type { Tenant } from "@/payload-types"
import {
  MailPolicyBlockedError,
  MailSendError,
  asMailLogPayload,
  getPlatformMailSender,
  sendEmail,
} from "@/lib/email/sendEmail"
import {
  APPOINTMENT_NOTIFICATION_TEMPLATE_VERSION,
  tenantAppointmentNotificationTemplate,
  visitorAppointmentNotificationTemplate,
  type AppointmentNotificationKind,
} from "@/lib/email/templates/appointments"
import { resolveVerifiedTenantSender } from "@/lib/tenants/emailSending"
import { redactOperationalMessage } from "@/lib/security/redactOperationalMessage"
import { openAppointmentSecret, APPOINTMENT_MANAGEMENT_KEY_ENV } from "@/lib/appointments/secrets"
import {
  asAppointmentSystemPayload,
  recordNumber,
  recordText,
  relationId,
  type AppointmentSystemRecord,
} from "@/lib/appointments/systemPayload"

const LEASE_MS = 5 * 60_000
const MAX_ATTEMPTS = 6
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 12 * 60 * 60_000]
const PERMANENT_RETRY_AT = "9999-12-31T00:00:00.000Z"

type AppointmentNotificationDelivery = AppointmentSystemRecord

const appointmentKinds = new Set<AppointmentNotificationKind>(["confirmation", "cancelled", "rescheduled"])

const asKind = (value: string | null): AppointmentNotificationKind | null =>
  value && appointmentKinds.has(value as AppointmentNotificationKind)
    ? value as AppointmentNotificationKind
    : null

const iso = (value: unknown): string | null => {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null
  return value
}

const canAttempt = (delivery: AppointmentNotificationDelivery, now: Date): boolean => {
  const status = recordText(delivery, "status")
  if (status === "sent" || status === "cancelled") return false
  const leaseUntil = iso(delivery.leaseUntil)
  if (status === "processing" && leaseUntil && new Date(leaseUntil) > now) return false
  const nextAttemptAt = iso(delivery.nextAttemptAt)
  return !nextAttemptAt || new Date(nextAttemptAt) <= now
}

const retryAt = (now: Date, attemptCount: number): string => {
  const delay = RETRY_DELAYS_MS[Math.min(Math.max(attemptCount - 1, 0), RETRY_DELAYS_MS.length - 1)] ?? 60_000
  return new Date(now.getTime() + delay).toISOString()
}

const recordDocs = (value: unknown): AppointmentSystemRecord[] => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return []
  const docs = (value as { docs?: unknown }).docs
  return Array.isArray(docs) ? docs.filter((doc): doc is AppointmentSystemRecord => Boolean(doc && typeof doc === "object" && !Array.isArray(doc) && "id" in doc)) : []
}

const claimDelivery = async (
  payload: ReturnType<typeof asAppointmentSystemPayload>,
  delivery: AppointmentNotificationDelivery,
  now: Date,
): Promise<AppointmentNotificationDelivery | null> => {
  const attemptCount = recordNumber(delivery, "attemptCount") + 1
  const result = await payload.update({
    collection: "appointment-notification-deliveries",
    id: delivery.id,
    where: {
      and: [
        { id: { equals: delivery.id } },
        {
          or: [
            { and: [{ status: { in: ["queued", "failed"] } }, { nextAttemptAt: { less_than_equal: now.toISOString() } }] },
            { and: [{ status: { equals: "processing" } }, { leaseUntil: { less_than_equal: now.toISOString() } }] },
          ],
        },
      ],
    },
    data: {
      status: "processing",
      attemptCount,
      lastAttemptAt: now.toISOString(),
      leaseUntil: new Date(now.getTime() + LEASE_MS).toISOString(),
      lastError: null,
    },
    depth: 0,
    overrideAccess: true,
    context: { appointmentNotificationLifecycleMutation: true },
  })
  const docs = recordDocs(result)
  if (docs[0]) return docs[0]
  return result && typeof result === "object" && !Array.isArray(result) && "id" in result
    ? result
    : null
}

const validSiteUrl = (value: string | null): string | null => {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" && url.protocol !== "http:") return null
    url.username = ""
    url.password = ""
    return url.toString()
  } catch {
    return null
  }
}

const validEmail = (value: string | null): string | undefined => {
  if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return undefined
  return value.toLowerCase()
}

const loadNotificationContext = async (
  payload: ReturnType<typeof asAppointmentSystemPayload>,
  delivery: AppointmentNotificationDelivery,
) => {
  const appointmentId = relationId(delivery.appointment)
  const tenantId = relationId(delivery.tenant)
  if (!appointmentId || !tenantId) return null
  const [appointmentResult, tenantResult] = await Promise.all([
    payload.find({ collection: "appointments", where: { id: { equals: appointmentId } }, limit: 1, depth: 0, overrideAccess: true }),
    payload.find({ collection: "tenants", where: { id: { equals: tenantId } }, limit: 1, depth: 0, overrideAccess: true }),
  ])
  const appointment = appointmentResult.docs[0]
  const tenant = tenantResult.docs[0]
  if (!appointment || !tenant) return null
  const settingsResult = await payload.find({
    collection: "site-settings",
    where: { tenant: { equals: tenantId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const settings = settingsResult.docs[0]
  const siteUrl = validSiteUrl(recordText(settings, "siteUrl"))
  const kind = asKind(recordText(delivery, "kind"))
  const visitorEmail = validEmail(recordText(appointment, "visitorEmail"))
  const visitorName = recordText(appointment, "visitorName")
  const startAt = iso(appointment.startAt)
  const endAt = iso(appointment.endAt)
  const timezone = recordText(appointment, "timezone")
  if (!siteUrl || !kind || !visitorEmail || !visitorName || !startAt || !endAt || !timezone) return null
  const sender = resolveVerifiedTenantSender(tenant as unknown as Pick<Tenant, "emailSending">)
  const replyTo = validEmail(recordText(settings, "contactEmail"))
  return {
    appointment,
    tenant,
    siteUrl,
    kind,
    visitorEmail,
    visitorName,
    startAt,
    endAt,
    timezone,
    note: recordText(appointment, "visitorNote"),
    sender: sender?.senderEmail ?? getPlatformMailSender(),
    replyTo,
    eventVersion: recordNumber(delivery, "eventVersion", 1),
  }
}

const markCancelled = async (
  payload: ReturnType<typeof asAppointmentSystemPayload>,
  delivery: AppointmentNotificationDelivery,
  message: string,
): Promise<void> => {
  await payload.update({
    collection: "appointment-notification-deliveries",
    id: delivery.id,
    data: { status: "cancelled", leaseUntil: null, retryState: "permanent", lastError: redactOperationalMessage(message) },
    depth: 0,
    overrideAccess: true,
    context: { appointmentNotificationLifecycleMutation: true },
  })
}

const markFailed = async (
  payload: ReturnType<typeof asAppointmentSystemPayload>,
  delivery: AppointmentNotificationDelivery,
  now: Date,
  error: unknown,
): Promise<void> => {
  const normalized = error instanceof MailSendError ? error.normalized : null
  const attemptCount = recordNumber(delivery, "attemptCount")
  const retryable = normalized?.retryState === "retryable" && attemptCount < MAX_ATTEMPTS
  const errorMessage = redactOperationalMessage(normalized?.providerErrorMessage ?? (error instanceof Error ? error.message : "Appointment email delivery failed."))
  await payload.update({
    collection: "appointment-notification-deliveries",
    id: delivery.id,
    data: {
      status: "failed",
      leaseUntil: null,
      nextAttemptAt: retryable ? retryAt(now, attemptCount) : PERMANENT_RETRY_AT,
      provider: normalized?.provider ?? null,
      providerMessageId: normalized?.providerMessageId ?? null,
      retryState: retryable ? "retryable" : "permanent",
      lastError: errorMessage,
    },
    depth: 0,
    overrideAccess: true,
    context: { appointmentNotificationLifecycleMutation: true },
  })
}

export async function processAppointmentNotifications(input: {
  payload: Payload
  now?: Date
  limit?: number
}) {
  const payload = asAppointmentSystemPayload(input.payload)
  const now = input.now ?? new Date()
  const limit = Math.max(1, Math.min(Math.floor(input.limit ?? 100), 500))
  const result = await payload.find({
    collection: "appointment-notification-deliveries",
    where: {
      or: [
        { and: [{ status: { in: ["queued", "failed"] } }, { nextAttemptAt: { less_than_equal: now.toISOString() } }] },
        { and: [{ status: { equals: "processing" } }, { leaseUntil: { less_than_equal: now.toISOString() } }] },
      ],
    },
    sort: "nextAttemptAt",
    limit,
    depth: 0,
    overrideAccess: true,
  })

  let sent = 0
  let failed = 0
  let skipped = 0
  for (const delivery of result.docs.slice(0, limit)) {
    if (!canAttempt(delivery, now)) {
      skipped += 1
      continue
    }
    const claimed = await claimDelivery(payload, delivery, now)
    if (!claimed) {
      skipped += 1
      continue
    }
    let context: Awaited<ReturnType<typeof loadNotificationContext>>
    try {
      context = await loadNotificationContext(payload, claimed)
    } catch (error) {
      await markFailed(payload, claimed, now, error)
      failed += 1
      continue
    }
    if (!context) {
      await markCancelled(payload, claimed, "Appointment notification is missing valid appointment, tenant, recipient, or site data.")
      skipped += 1
      continue
    }

    // A lifecycle mutation creates a new event version. Never deliver a
    // message from an older version, even when this worker claimed it just
    // before the mutation committed.
    try {
      const latest = await payload.find({
        collection: "appointments",
        where: { id: { equals: context.appointment.id } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const latestAppointment = latest.docs[0]
      if (!latestAppointment || recordNumber(latestAppointment, "eventVersion", 1) !== context.eventVersion) {
        await markCancelled(payload, claimed, "Superseded by a newer appointment version.")
        skipped += 1
        continue
      }
    } catch (error) {
      await markFailed(payload, claimed, now, error)
      failed += 1
      continue
    }
    const recipientKind = recordText(claimed, "recipientKind")
    const recipient = recipientKind === "tenant"
      ? validEmail(recordText(claimed, "recipientEmail"))
      : context.visitorEmail
    if (!recipient) {
      await markCancelled(payload, claimed, "Appointment notification has no valid recipient.")
      skipped += 1
      continue
    }

    let managementToken: string | undefined
    if (recipientKind !== "tenant") {
      const encrypted = recordText(context.appointment, "encryptedManagementToken")
      if (!encrypted) {
        await markCancelled(payload, claimed, "Appointment management token is unavailable.")
        skipped += 1
        continue
      }
      try {
        managementToken = openAppointmentSecret(encrypted, "appointment-management-token", process.env, APPOINTMENT_MANAGEMENT_KEY_ENV)
      } catch {
        await markCancelled(payload, claimed, "Appointment management token could not be opened.")
        skipped += 1
        continue
      }
    }

    const templateInput = {
      kind: context.kind,
      visitorName: context.visitorName,
      visitorEmail: context.visitorEmail,
      startAt: context.startAt,
      endAt: context.endAt,
      timezone: context.timezone,
      tenantName: recordText(context.tenant, "name") ?? recordText(context.tenant, "domain") ?? "Je website",
      siteUrl: context.siteUrl,
      ...(managementToken ? { managementToken } : {}),
      ...(context.note ? { note: context.note } : {}),
    }
    const message = recipientKind === "tenant"
      ? tenantAppointmentNotificationTemplate(templateInput)
      : visitorAppointmentNotificationTemplate(templateInput)

    try {
      const result = await sendEmail({
        to: recipient,
        from: context.sender,
        ...(context.replyTo ? { replyTo: context.replyTo } : {}),
        subject: message.subject,
        html: message.html,
        text: message.text,
        intent: recipientKind === "tenant" ? "appointments.tenant_notification" : "appointments.visitor_notification",
        category: recipientKind === "tenant" ? "tenant_operational" : "transactional",
        ...(recipientKind === "tenant" ? { tenantSubscriptionCategory: "appointmentBookings" as const } : {}),
        tenant: relationId(claimed.tenant) ?? undefined,
        appointment: context.appointment.id,
        payload: asMailLogPayload(input.payload),
      })
      await payload.update({
        collection: "appointment-notification-deliveries",
        id: claimed.id,
        data: {
          status: "sent",
          sentAt: now.toISOString(),
          nextAttemptAt: now.toISOString(),
          leaseUntil: null,
          provider: result.provider,
          providerMessageId: result.providerMessageId ?? null,
          retryState: "none",
          lastError: null,
        },
        depth: 0,
        overrideAccess: true,
        context: { appointmentNotificationLifecycleMutation: true },
      })
      sent += 1
    } catch (error) {
      if (error instanceof MailPolicyBlockedError) {
        await markCancelled(payload, claimed, error.message)
        skipped += 1
        continue
      }
      await markFailed(payload, claimed, now, error)
      failed += 1
    }
  }
  return { examined: result.docs.length, sent, failed, skipped, templateVersion: APPOINTMENT_NOTIFICATION_TEMPLATE_VERSION }
}
