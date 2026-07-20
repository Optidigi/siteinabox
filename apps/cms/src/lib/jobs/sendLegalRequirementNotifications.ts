import type { Payload } from "payload"
import type { LegalDocument, LegalNotificationDelivery, LegalRequirement, Tenant } from "@/payload-types"
import { MailSendError, asMailLogPayload, getPlatformMailSender, sendEmail } from "@/lib/email/sendEmail"
import { LEGAL_REACCEPTANCE_TEMPLATE_VERSION, legalContinuedUseNoticeTemplate, legalDirectNoticeTemplate, legalReacceptanceTemplate } from "@/lib/email/templates/legalReacceptance"
import { relationshipId } from "@/lib/relationshipId"
import { redactOperationalMessage } from "@/lib/security/redactOperationalMessage"
import { asRecord } from "@/lib/record"

type RequirementDoc = LegalRequirement & {
  tenant?: Tenant | number | null
  document?: LegalDocument | number | null
}
const ACTIVE_STATUSES = ["pending", "notified", "failed"]
const REACCEPT_ACTIONS = ["mandatory_reaccept", "reaccept_on_next_transaction"]
const NOTICE_AND_USE_ACTION = "notice_and_continued_use"
const NOTIFIABLE_ACTIONS = [...REACCEPT_ACTIONS, "direct_notice", NOTICE_AND_USE_ACTION]
const LEASE_MS = 15 * 60_000
const REMINDER_LEAD_MS = 7 * 24 * 60 * 60_000
const RETRY_DELAYS_MS = [60 * 60_000, 6 * 60 * 60_000, 24 * 60 * 60_000]
const PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SIAB_SITE_URL ?? "https://www.siteinabox.nl"

const relation = <T extends object>(value: unknown): T | null =>
  value && typeof value === "object" ? value as T : null
const normalizedHost = (value: unknown) => typeof value === "string"
  ? value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "")
  : ""
const tenantAdminUrl = (tenant: Tenant) => {
  const domain = normalizedHost(tenant.domain)
  return domain ? `https://admin.${domain}` : null
}
const documentUrl = (document: LegalDocument) => document.documentType === "platform-terms"
  ? `${PUBLIC_SITE_URL}/juridisch/algemene-voorwaarden/${document.documentVersion}`
  : `${PUBLIC_SITE_URL}/juridisch/privacy-en-cookieverklaring/${document.documentVersion}`
const retryAt = (now: Date, attemptCount: number) =>
  new Date(now.getTime() + RETRY_DELAYS_MS[Math.min(Math.max(attemptCount - 1, 0), RETRY_DELAYS_MS.length - 1)]!).toISOString()

type NotificationKind = "initial" | "reminder" | "enforcement"

const promisedObjectionDeadline = (requirement: RequirementDoc, deliveredAt: string): string | null => {
  const document = relation<LegalDocument>(requirement.document)
  const noticeDays = Number(document?.noticeDays ?? 0)
  const deliveryDeadline = noticeDays > 0
    ? new Date(new Date(deliveredAt).getTime() + noticeDays * 24 * 60 * 60_000).toISOString()
    : null
  const existingDeadline = typeof requirement.objectionDeadlineAt === "string" ? requirement.objectionDeadlineAt : null
  return [existingDeadline, deliveryDeadline].filter((value): value is string => Boolean(value)).sort().at(-1) ?? null
}

export const dueFollowupKindForRequirement = (requirement: RequirementDoc, now: Date): NotificationKind | null => {
  if (requirement.action === NOTICE_AND_USE_ACTION && requirement.objectionDeadlineAt) {
    const remaining = new Date(requirement.objectionDeadlineAt).getTime() - now.getTime()
    if (remaining <= 0) return null
    return remaining <= REMINDER_LEAD_MS ? "reminder" : "initial"
  }
  if (requirement.action !== "mandatory_reaccept" || !requirement.enforceAt) return "initial"
  const remaining = new Date(requirement.enforceAt).getTime() - now.getTime()
  if (remaining <= 0) return "enforcement"
  if (remaining <= REMINDER_LEAD_MS) return "reminder"
  return "initial"
}

export const legalNotificationKey = (requirement: RequirementDoc, kind: NotificationKind = "initial") =>
  `${requirement.requirementKey}:${kind}:${LEGAL_REACCEPTANCE_TEMPLATE_VERSION}`

async function findDelivery(payload: Payload, notificationKey: string) {
  const result = await payload.find({
    collection: "legal-notification-deliveries",
    where: { notificationKey: { equals: notificationKey } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs[0]
}

async function ensureDelivery(payload: Payload, requirement: RequirementDoc, now: Date, kind: NotificationKind) {
  const notificationKey = legalNotificationKey(requirement, kind)
  const existing = await findDelivery(payload, notificationKey)
  if (existing) return existing
  try {
    return await payload.create({
      collection: "legal-notification-deliveries",
      data: {
        notificationKey,
        requirement: requirement.id,
        tenant: Number(relationshipId(requirement.tenant)),
        recipient: requirement.subjectEmail,
        kind,
        templateVersion: LEGAL_REACCEPTANCE_TEMPLATE_VERSION,
        status: "queued",
        attemptCount: 0,
        nextAttemptAt: now.toISOString(),
      },
      depth: 0,
      overrideAccess: true,
    })
  } catch (error) {
    const raced = await findDelivery(payload, notificationKey)
    if (raced) return raced
    throw error
  }
}

const canAttempt = (delivery: LegalNotificationDelivery, now: Date) => {
  if (delivery.status === "sent" || delivery.status === "cancelled") return false
  if (delivery.status === "processing" && delivery.leaseUntil && new Date(delivery.leaseUntil) > now) return false
  return !delivery.nextAttemptAt || new Date(delivery.nextAttemptAt) <= now
}

async function claimDelivery(payload: Payload, delivery: LegalNotificationDelivery, now: Date, attemptCount: number) {
  const claimed = await payload.update({
    collection: "legal-notification-deliveries",
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
  })
  return Array.isArray(claimed?.docs) ? claimed.docs[0] : null
}

async function markRequirementNotified(payload: Payload, requirement: RequirementDoc, sentAt: string) {
  const objectionDeadlineAt = requirement.action === NOTICE_AND_USE_ACTION
    ? promisedObjectionDeadline(requirement, sentAt)
    : undefined
  await payload.update({
    collection: "legal-requirements",
    where: {
      and: [
        { id: { equals: requirement.id } },
        { status: { in: ACTIVE_STATUSES } },
        { action: { in: NOTIFIABLE_ACTIONS } },
      ],
    },
    data: {
      status: "notified",
      notifiedAt: requirement.notifiedAt ?? sentAt,
      noticeDeliveredAt: requirement.action === NOTICE_AND_USE_ACTION
        ? requirement.noticeDeliveredAt ?? sentAt
        : undefined,
      objectionDeadlineAt,
      lastError: null,
    },
    depth: 0,
    overrideAccess: true,
  })
}

async function loadActionableRequirements(payload: Payload) {
  const docs: RequirementDoc[] = []
  const pageSize = 100
  for (let page = 1; ; page += 1) {
    const result = await payload.find({
      collection: "legal-requirements",
      where: { or: [
        { and: [{ action: { in: REACCEPT_ACTIONS } }, { status: { in: ACTIVE_STATUSES } }] },
        { and: [{ action: { equals: "direct_notice" } }, { status: { in: ["pending", "failed"] } }] },
        { and: [{ action: { equals: NOTICE_AND_USE_ACTION } }, { status: { in: ACTIVE_STATUSES } }] },
      ] },
      sort: "createdAt",
      page,
      limit: pageSize,
      depth: 2,
      overrideAccess: true,
    })
    docs.push(...result.docs as RequirementDoc[])
    if (!result.hasNextPage && result.docs.length < pageSize) break
  }
  return docs
}

export async function processLegalRequirementNotifications(input: {
  payload: Payload
  now?: Date
  limit?: number
}) {
  const now = input.now ?? new Date()
  const requirements = await loadActionableRequirements(input.payload)
  const sendLimit = input.limit ?? 100

  let sent = 0
  let failed = 0
  let skipped = 0
  for (const requirement of requirements) {
    if (sent + failed >= sendLimit) break
    const tenant = relation<Tenant>(requirement.tenant)
    const document = relation<LegalDocument>(requirement.document)
    const adminUrl = tenant ? tenantAdminUrl(tenant) : null
    if (!tenant || !document || !adminUrl || !requirement.subjectEmail) {
      skipped += 1
      await input.payload.update({
        collection: "legal-requirements",
        id: requirement.id,
        data: { status: "failed", lastError: "Legal notification is missing tenant, document, admin URL, or recipient data." },
        depth: 0,
        overrideAccess: true,
      })
      continue
    }

    const initial = await ensureDelivery(input.payload, requirement, now, "initial")
    if (initial.status === "sent") {
      await markRequirementNotified(input.payload, requirement, String(initial.sentAt ?? now.toISOString()))
    }
    const followupKind = dueFollowupKindForRequirement(requirement, now)
    const kind: NotificationKind = initial.status === "sent" && followupKind && followupKind !== "initial"
      ? followupKind
      : "initial"
    const delivery = kind === "initial" ? initial : await ensureDelivery(input.payload, requirement, now, kind)
    if (!canAttempt(delivery, now)) {
      skipped += 1
      continue
    }
    const attemptCount = Number(delivery.attemptCount ?? 0) + 1
    const claimed = await claimDelivery(input.payload, delivery, now, attemptCount)
    if (!claimed) {
      skipped += 1
      continue
    }

    const currentRequirement = await input.payload.findByID({
      collection: "legal-requirements",
      id: requirement.id,
      depth: 0,
      overrideAccess: true,
    })
    if (!currentRequirement.status || !ACTIVE_STATUSES.includes(currentRequirement.status) || !currentRequirement.action || !NOTIFIABLE_ACTIONS.includes(currentRequirement.action)) {
      await input.payload.update({
        collection: "legal-notification-deliveries",
        id: delivery.id,
        data: { status: "cancelled", leaseUntil: null, lastError: null },
        depth: 0,
        overrideAccess: true,
      })
      skipped += 1
      continue
    }

    const commonMessage = {
      tenantName: String(tenant.name ?? tenant.domain),
      changeSummary: String(document.changeSummary ?? "De juridische informatie voor de Site in a Box-dienstverlening is bijgewerkt."),
      documentVersion: String(document.documentVersion),
      effectiveAt: String(document.effectiveAt),
      documentUrl: documentUrl(document),
    }
    const effectiveObjectionDeadline = promisedObjectionDeadline(requirement, now.toISOString())
      ?? String(document.effectiveAt)
    const message = requirement.action === NOTICE_AND_USE_ACTION
      ? legalContinuedUseNoticeTemplate({
          ...commonMessage,
          objectionDeadlineAt: effectiveObjectionDeadline,
          settingsUrl: `${adminUrl}/settings#agreements`,
          documentContent: String(document.content ?? ""),
          kind: kind === "reminder" ? "reminder" : "initial",
        })
      : requirement.action === "direct_notice"
        ? legalDirectNoticeTemplate(commonMessage)
      : legalReacceptanceTemplate({
          ...commonMessage,
          enforceAt: requirement.enforceAt,
          settingsUrl: `${adminUrl}/settings#agreements`,
          mandatory: requirement.action === "mandatory_reaccept",
          kind,
        })

    try {
      const result = await sendEmail({
        to: String(requirement.subjectEmail),
        from: getPlatformMailSender(),
        replyTo: "info@siteinabox.nl",
        subject: message.subject,
        html: message.html,
        text: message.text,
        intent: "legal.reacceptance",
        tenant: tenant.id,
        payload: asMailLogPayload(input.payload),
      })
      const sentAt = now.toISOString()
      const marked = await input.payload.update({
        collection: "legal-notification-deliveries",
        where: {
          and: [
            { id: { equals: delivery.id } },
            { status: { equals: "processing" } },
          ],
        },
        data: {
          status: "sent",
          sentAt,
          leaseUntil: null,
          nextAttemptAt: sentAt,
          provider: result.provider,
          providerMessageId: result.providerMessageId ?? null,
          retryState: "none",
        },
        depth: 0,
        overrideAccess: true,
      })
      if (Array.isArray(marked?.docs) && marked.docs.length > 0) {
        await markRequirementNotified(input.payload, requirement, sentAt)
      }
      sent += 1
    } catch (error) {
      const normalized = error instanceof MailSendError ? error.normalized : null
      const permanent = normalized?.retryState === "permanent"
      const message = redactOperationalMessage(normalized?.providerErrorMessage ?? (error instanceof Error ? error.message : "Unknown email delivery error"))
      await input.payload.update({
        collection: "legal-notification-deliveries",
        id: delivery.id,
        data: {
          status: "failed",
          leaseUntil: null,
          nextAttemptAt: permanent ? new Date("9999-12-31T00:00:00.000Z").toISOString() : retryAt(now, attemptCount),
          provider: normalized?.provider,
          retryState: normalized?.retryState ?? "retryable",
          lastError: message,
        },
        depth: 0,
        overrideAccess: true,
      })
      await input.payload.update({
        collection: "legal-requirements",
        id: requirement.id,
        data: { status: "failed", lastError: message },
        depth: 0,
        overrideAccess: true,
      })
      failed += 1
    }
  }
  return { examined: requirements.length, sent, failed, skipped }
}
