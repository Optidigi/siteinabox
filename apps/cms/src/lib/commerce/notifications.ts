import "server-only"

import type { Payload } from "payload"
import type {
  BillingAgreement,
  CommerceNotificationDelivery,
  DomainRenewalCycle,
  ManagedDomain,
  Tenant,
} from "@/payload-types"

import {
  COMMERCE_NOTIFICATION_TEMPLATE_VERSION,
  commerceNotificationTemplate,
  type CommerceNotificationKind,
} from "@/lib/email/templates/commerce"
import {
  MailSendError,
  asMailLogPayload,
  sendEmail,
} from "@/lib/email/sendEmail"
import { findOneDoc } from "@/lib/payloadCollection"
import { relationshipId } from "@/lib/relationshipId"
import { redactOperationalMessage } from "@/lib/security/redactOperationalMessage"

const LEASE_MS = 15 * 60_000
const RETRY_DELAYS_MS = [60 * 60_000, 6 * 60 * 60_000, 24 * 60 * 60_000]

const numericRelationshipId = (
  value: Parameters<typeof relationshipId>[0],
): number | undefined => {
  const id = relationshipId(value)
  if (id == null) return undefined
  const numeric = Number(id)
  if (!Number.isSafeInteger(numeric)) throw new Error("Expected a numeric Payload relationship id.")
  return numeric
}

export async function ensureCommerceNotification(input: {
  payload: Payload
  kind: CommerceNotificationKind
  tenantId: string | number
  recipient: string
  eventAt: string
  billingAgreementId?: string | number | null
  renewalCycleId?: string | number | null
}): Promise<CommerceNotificationDelivery> {
  const subject = input.billingAgreementId != null
    ? `billing-agreement:${input.billingAgreementId}`
    : `renewal-cycle:${input.renewalCycleId}`
  const notificationKey = [
    subject,
    input.kind,
    input.eventAt,
    COMMERCE_NOTIFICATION_TEMPLATE_VERSION,
  ].join(":")
  const existing = await findOneDoc(input.payload, "commerce-notification-deliveries", {
    notificationKey: { equals: notificationKey },
  })
  if (existing) return existing
  try {
    return await input.payload.create({
      collection: "commerce-notification-deliveries",
      data: {
        notificationKey,
        billingAgreement: input.billingAgreementId == null
          ? undefined
          : Number(input.billingAgreementId),
        renewalCycle: input.renewalCycleId == null ? undefined : Number(input.renewalCycleId),
        tenant: Number(input.tenantId),
        recipient: input.recipient.trim().toLowerCase(),
        kind: input.kind,
        templateVersion: COMMERCE_NOTIFICATION_TEMPLATE_VERSION,
        eventAt: input.eventAt,
        status: "queued",
        attemptCount: 0,
        nextAttemptAt: new Date().toISOString(),
      },
      depth: 0,
      overrideAccess: true,
    }) as CommerceNotificationDelivery
  } catch (error) {
    const raced = await findOneDoc(input.payload, "commerce-notification-deliveries", {
      notificationKey: { equals: notificationKey },
    })
    if (raced) return raced
    throw error
  }
}

export const queueCommerceNotification = (
  payload: Payload,
  deliveryId: string | number,
) => payload.jobs.queue({
  task: "deliver-commerce-notification",
  input: { deliveryId: String(deliveryId) },
  queue: "default",
  overrideAccess: true,
})

const retryAt = (now: Date, attemptCount: number) => new Date(
  now.getTime() +
  RETRY_DELAYS_MS[Math.min(Math.max(attemptCount - 1, 0), RETRY_DELAYS_MS.length - 1)]!,
).toISOString()

async function claimDelivery(
  payload: Payload,
  delivery: CommerceNotificationDelivery,
  now: Date,
): Promise<CommerceNotificationDelivery | null> {
  if (delivery.status === "sent" || delivery.status === "cancelled") return null
  if (delivery.status === "processing" && delivery.leaseUntil && new Date(delivery.leaseUntil) > now) {
    return null
  }
  if (delivery.nextAttemptAt && new Date(delivery.nextAttemptAt) > now) return null
  const attemptCount = delivery.attemptCount + 1
  const claimed = await payload.update({
    collection: "commerce-notification-deliveries",
    where: {
      and: [
        { id: { equals: delivery.id } },
        {
          or: [
            { status: { in: ["queued", "failed"] } },
            {
              and: [
                { status: { equals: "processing" } },
                { leaseUntil: { less_than_equal: now.toISOString() } },
              ],
            },
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
    context: { commerceNotificationLifecycleMutation: true },
  })
  return Array.isArray(claimed?.docs)
    ? claimed.docs[0] as CommerceNotificationDelivery | undefined ?? null
    : null
}

export async function deliverCommerceNotification(input: {
  payload: Payload
  deliveryId: string | number
  now?: Date
}): Promise<"sent" | "failed" | "skipped"> {
  const now = input.now ?? new Date()
  const delivery = await input.payload.findByID({
    collection: "commerce-notification-deliveries",
    id: input.deliveryId,
    depth: 0,
    overrideAccess: true,
  }) as CommerceNotificationDelivery
  const claimed = await claimDelivery(input.payload, delivery, now)
  if (!claimed) return "skipped"
  const tenantId = relationshipId(claimed.tenant)
  if (!tenantId) throw new Error("Commerce notification is missing a tenant.")
  const tenant = await input.payload.findByID({
    collection: "tenants",
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  }) as Tenant
  let domainName: string | null = null
  const cycleId = relationshipId(claimed.renewalCycle)
  if (cycleId) {
    const cycle = await input.payload.findByID({
      collection: "domain-renewal-cycles",
      id: cycleId,
      depth: 0,
      overrideAccess: true,
    }) as DomainRenewalCycle
    const managedDomainId = relationshipId(cycle.managedDomain)
    if (managedDomainId) {
      const managedDomain = await input.payload.findByID({
        collection: "managed-domains",
        id: managedDomainId,
        depth: 0,
        overrideAccess: true,
      }) as ManagedDomain
      domainName = managedDomain.domainNameAscii
    }
  }
  const template = commerceNotificationTemplate({
    kind: claimed.kind as CommerceNotificationKind,
    eventAt: claimed.eventAt,
    tenantName: tenant.name,
    domainName,
  })
  try {
    await sendEmail({
      to: claimed.recipient,
      subject: template.subject,
      html: template.html,
      text: template.text,
      intent: cycleId ? "commerce.domain" : "commerce.billing",
      category: "transactional",
      tenant: numericRelationshipId(claimed.tenant),
      payload: asMailLogPayload(input.payload),
    })
    await input.payload.update({
      collection: "commerce-notification-deliveries",
      id: claimed.id,
      data: {
        status: "sent",
        sentAt: now.toISOString(),
        leaseUntil: null,
        nextAttemptAt: null,
        lastError: null,
      },
      depth: 0,
      overrideAccess: true,
      context: { commerceNotificationLifecycleMutation: true },
    })
    return "sent"
  } catch (error) {
    const retryable = error instanceof MailSendError && error.normalized.retryState === "retryable"
    await input.payload.update({
      collection: "commerce-notification-deliveries",
      id: claimed.id,
      data: {
        status: "failed",
        failedAt: now.toISOString(),
        leaseUntil: null,
        nextAttemptAt: retryable ? retryAt(now, claimed.attemptCount) : null,
        lastError: redactOperationalMessage(error),
      },
      depth: 0,
      overrideAccess: true,
      context: { commerceNotificationLifecycleMutation: true },
    })
    return "failed"
  }
}

export async function queueDueCommerceNotifications(
  payload: Payload,
  now = new Date(),
): Promise<number> {
  const result = await payload.find({
    collection: "commerce-notification-deliveries",
    where: {
      and: [
        { status: { in: ["queued", "failed"] } },
        { nextAttemptAt: { less_than_equal: now.toISOString() } },
      ],
    },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  for (const delivery of result.docs) {
    await queueCommerceNotification(payload, delivery.id)
  }
  return result.docs.length
}
