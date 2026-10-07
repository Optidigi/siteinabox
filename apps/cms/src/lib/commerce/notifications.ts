import "server-only"

import type { Payload } from "payload"
import type {
  CommerceNotificationDelivery,
  DomainRenewalCycle,
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
import { claimCommerceNotificationDelivery, transitionCommerceNotificationDelivery } from "@/lib/appointments/atomicClaims"
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
  businessEventKey?: string
  billingAgreementId?: string | number | null
  renewalCycleId?: string | number | null
}): Promise<CommerceNotificationDelivery> {
  const subject = input.billingAgreementId != null
    ? `billing-agreement:${input.billingAgreementId}`
    : `renewal-cycle:${input.renewalCycleId}`
  const notificationKey = [
    subject,
    input.kind,
    input.businessEventKey ?? input.eventAt,
    COMMERCE_NOTIFICATION_TEMPLATE_VERSION,
  ].join(":")
  const existing = await findOneDoc(input.payload, "commerce-notification-deliveries", {
    notificationKey: { equals: notificationKey },
  })
  if (existing) {
    if (
      input.businessEventKey &&
      existing.eventAt !== input.eventAt &&
      !["sent", "cancelled"].includes(existing.status)
    ) {
      return await input.payload.update({
        collection: "commerce-notification-deliveries",
        id: existing.id,
        data: { eventAt: input.eventAt },
        depth: 0,
        overrideAccess: true,
        context: { commerceNotificationLifecycleMutation: true },
      })
    }
    return existing
  }
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
    })
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
  })
  const claimed = await claimCommerceNotificationDelivery(input.payload, delivery, now, LEASE_MS)
  if (!claimed) return "skipped"
  let markerAttempted = false
  let dispatchStarted = false
  let verifiedReceipt = false
  try {
    const tenantId = relationshipId(claimed.tenant)
    if (!tenantId) throw new Error("Commerce notification is missing a tenant.")
    const tenant = await input.payload.findByID({
      collection: "tenants",
      id: tenantId,
      depth: 0,
      overrideAccess: true,
    })
    let domainName: string | null = null
    let renewalCycle: DomainRenewalCycle | null = null
    const agreementId = relationshipId(claimed.billingAgreement)
    if (
      agreementId &&
      [
        "payment_received",
        "domain_verification_required",
        "site_live_handoff",
      ].includes(claimed.kind)
    ) {
      const agreement = await input.payload.findByID({
        collection: "billing-agreements",
        id: agreementId,
        depth: 0,
        overrideAccess: true,
      })
      const orderId = relationshipId(agreement.originatingOrder)
      if (orderId) {
        const managedDomains = await input.payload.find({
          collection: "managed-domains",
          where: { originatingOrder: { equals: orderId } },
          limit: 2,
          depth: 0,
          overrideAccess: true,
        })
        if (managedDomains.docs.length === 1) {
          domainName = managedDomains.docs[0]!.domainNameAscii
        }
      }
    }
    const cycleId = relationshipId(claimed.renewalCycle)
    if (cycleId) {
      renewalCycle = await input.payload.findByID({
        collection: "domain-renewal-cycles",
        id: cycleId,
        depth: 0,
        overrideAccess: true,
      })
      if (
        ["renewed", "cancelled"].includes(renewalCycle.state) &&
        (
          /^domain_renewal_(?:90|60|30|14|7|1)d$/.test(claimed.kind) ||
          claimed.kind === "domain_renewal_admin_7d"
        )
      ) {
        await transitionCommerceNotificationDelivery(input.payload, claimed, {
            status: "cancelled",
            nextAttemptAt: null,
            leaseUntil: null,
            lastError: null,
          })
        return "skipped"
      }
      const managedDomainId = relationshipId(renewalCycle.managedDomain)
      if (managedDomainId) {
        const managedDomain = await input.payload.findByID({
          collection: "managed-domains",
          id: managedDomainId,
          depth: 0,
          overrideAccess: true,
        })
        domainName = managedDomain.domainNameAscii
      }
    }
    if (claimed.kind === "site_live_handoff") {
      if (!agreementId) {
        throw new Error("Live handoff delivery is missing its billing agreement.")
      }
      const { retryLiveHandoffForBillingAgreement } = await import(
        "@/lib/publish/liveHandoffEmail"
      )
      markerAttempted = true
      await transitionCommerceNotificationDelivery(input.payload, claimed, { retryState: "permanent" })
      dispatchStarted = true
      const result = await retryLiveHandoffForBillingAgreement(
        input.payload,
        agreementId,
      )
      if (result !== "sent") {
        throw new Error("Live handoff delivery could not be completed.")
      }
      verifiedReceipt = true
      await transitionCommerceNotificationDelivery(input.payload, claimed, {
        status: "sent", retryState: "none", sentAt: now.toISOString(),
        leaseUntil: null, nextAttemptAt: null, lastError: null,
      })
      return "sent"
    }
    const template = commerceNotificationTemplate({
      kind: claimed.kind,
      eventAt: claimed.eventAt,
      tenantName: tenant.name,
      domainName,
      currency: renewalCycle?.currency,
      providerOperationPriceNetMinor: renewalCycle?.providerOperationPriceNetMinor,
      includedAllowanceNetMinor: renewalCycle?.includedAllowanceNetMinor,
      surchargeNetMinor: renewalCycle?.surchargeNetMinor,
      vatAmountMinor: renewalCycle?.vatAmountMinor,
      grossAmountMinor: renewalCycle?.grossAmountMinor,
      financialCoverageState: renewalCycle?.financialCoverageState,
      providerRenewalMode: renewalCycle?.providerRenewalMode,
      providerAutorenew: renewalCycle?.providerAutorenew,
      registrarSafeCutoffAt: renewalCycle?.registrarSafeCutoffAt,
      paymentChargeAt: renewalCycle?.paymentChargeAt,
      providerBalanceAvailableMinor: renewalCycle?.providerBalanceAvailableMinor,
      providerBalanceReservedMinor: renewalCycle?.providerBalanceReservedMinor,
      providerBalanceCurrency: renewalCycle?.providerBalanceCurrency,
      providerBalanceCheckedAt: renewalCycle?.providerBalanceCheckedAt,
      adminExceptionCode: renewalCycle?.adminExceptionCode,
    })
    markerAttempted = true
    await transitionCommerceNotificationDelivery(input.payload, claimed, { retryState: "permanent" })
    dispatchStarted = true
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
    verifiedReceipt = true
    await transitionCommerceNotificationDelivery(input.payload, claimed, {
      status: "sent", retryState: "none", sentAt: now.toISOString(),
      leaseUntil: null, nextAttemptAt: null, lastError: null,
    })
    return "sent"
  } catch (error) {
    // A verified provider receipt or an unverified marker write must never reopen delivery.
    if (verifiedReceipt || markerAttempted && !dispatchStarted) throw error
    const definitiveRejection = error instanceof MailSendError && error.normalized.providerErrorCode !== "E_PROVIDER_WRITE_INDETERMINATE"
    const retryable = claimed.attemptCount <= RETRY_DELAYS_MS.length && (!dispatchStarted || definitiveRejection && error.normalized.retryState === "retryable")
    await transitionCommerceNotificationDelivery(input.payload, claimed, {
      status: "failed", retryState: retryable ? "retryable" : "permanent",
      failedAt: now.toISOString(), leaseUntil: null,
      nextAttemptAt: retryable ? retryAt(now, claimed.attemptCount) : null,
      lastError: redactOperationalMessage(error),
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
        { or: [{ retryState: { equals: null } }, { retryState: { not_equals: "permanent" } }] },
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
