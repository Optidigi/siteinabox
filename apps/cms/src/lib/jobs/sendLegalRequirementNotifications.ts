import type { Payload } from "payload"
import { MailSendError, getPlatformMailSender, sendEmail } from "@/lib/email/sendEmail"
import { LEGAL_REACCEPTANCE_TEMPLATE_VERSION, legalDirectNoticeTemplate, legalReacceptanceTemplate } from "@/lib/email/templates/legalReacceptance"
import { relationshipId } from "@/lib/relationshipId"

type RecordLike = Record<string, any>
const ACTIVE_STATUSES = ["pending", "notified", "failed"]
const REACCEPT_ACTIONS = ["mandatory_reaccept", "reaccept_on_next_transaction"]
const NOTIFIABLE_ACTIONS = [...REACCEPT_ACTIONS, "direct_notice"]
const LEASE_MS = 15 * 60_000
const REMINDER_LEAD_MS = 7 * 24 * 60 * 60_000
const RETRY_DELAYS_MS = [60 * 60_000, 6 * 60 * 60_000, 24 * 60 * 60_000]
const PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SIAB_SITE_URL ?? "https://www.siteinabox.nl"

const relation = (value: unknown): RecordLike | null => value && typeof value === "object" ? value as RecordLike : null
const normalizedHost = (value: unknown) => typeof value === "string"
  ? value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "")
  : ""
const tenantAdminUrl = (tenant: RecordLike) => {
  const domain = normalizedHost(tenant.domain)
  return domain ? `https://admin.${domain}` : null
}
const documentUrl = (document: RecordLike) => document.documentType === "platform-terms"
  ? `${PUBLIC_SITE_URL}/juridisch/algemene-voorwaarden/${document.documentVersion}`
  : `${PUBLIC_SITE_URL}/juridisch/privacy-en-cookieverklaring/${document.documentVersion}`
const retryAt = (now: Date, attemptCount: number) =>
  new Date(now.getTime() + RETRY_DELAYS_MS[Math.min(Math.max(attemptCount - 1, 0), RETRY_DELAYS_MS.length - 1)]!).toISOString()

type NotificationKind = "initial" | "reminder" | "enforcement"

export const dueFollowupKindForRequirement = (requirement: RecordLike, now: Date): NotificationKind | null => {
  if (requirement.action !== "mandatory_reaccept" || !requirement.enforceAt) return "initial"
  const remaining = new Date(requirement.enforceAt).getTime() - now.getTime()
  if (remaining <= 0) return "enforcement"
  if (remaining <= REMINDER_LEAD_MS) return "reminder"
  return "initial"
}

export const legalNotificationKey = (requirement: RecordLike, kind: NotificationKind = "initial") =>
  `${requirement.requirementKey}:${kind}:${LEGAL_REACCEPTANCE_TEMPLATE_VERSION}`

async function findDelivery(payload: Payload, notificationKey: string) {
  const result = await payload.find({
    collection: "legal-notification-deliveries" as any,
    where: { notificationKey: { equals: notificationKey } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  } as any)
  return result.docs[0] as RecordLike | undefined
}

async function ensureDelivery(payload: Payload, requirement: RecordLike, now: Date, kind: NotificationKind) {
  const notificationKey = legalNotificationKey(requirement, kind)
  const existing = await findDelivery(payload, notificationKey)
  if (existing) return existing
  try {
    return await payload.create({
      collection: "legal-notification-deliveries" as any,
      data: {
        notificationKey,
        requirement: requirement.id,
        tenant: relationshipId(requirement.tenant),
        recipient: requirement.subjectEmail,
        kind,
        templateVersion: LEGAL_REACCEPTANCE_TEMPLATE_VERSION,
        status: "queued",
        attemptCount: 0,
        nextAttemptAt: now.toISOString(),
      },
      depth: 0,
      overrideAccess: true,
    } as any) as RecordLike
  } catch (error) {
    const raced = await findDelivery(payload, notificationKey)
    if (raced) return raced
    throw error
  }
}

const canAttempt = (delivery: RecordLike, now: Date) => {
  if (delivery.status === "sent" || delivery.status === "cancelled") return false
  if (delivery.status === "processing" && delivery.leaseUntil && new Date(delivery.leaseUntil) > now) return false
  return !delivery.nextAttemptAt || new Date(delivery.nextAttemptAt) <= now
}

async function claimDelivery(payload: Payload, delivery: RecordLike, now: Date, attemptCount: number) {
  const claimed = await payload.update({
    collection: "legal-notification-deliveries" as any,
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
  } as any) as any
  return Array.isArray(claimed?.docs) ? claimed.docs[0] : null
}

async function markRequirementNotified(payload: Payload, requirement: RecordLike, sentAt: string) {
  await payload.update({
    collection: "legal-requirements" as any,
    where: {
      and: [
        { id: { equals: requirement.id } },
        { status: { in: ACTIVE_STATUSES } },
        { action: { in: NOTIFIABLE_ACTIONS } },
      ],
    },
    data: { status: "notified", notifiedAt: requirement.notifiedAt ?? sentAt, lastError: null },
    depth: 0,
    overrideAccess: true,
  } as any)
}

async function loadActionableRequirements(payload: Payload) {
  const docs: RecordLike[] = []
  const pageSize = 100
  for (let page = 1; ; page += 1) {
    const result = await payload.find({
      collection: "legal-requirements" as any,
      where: { or: [
        { and: [{ action: { in: REACCEPT_ACTIONS } }, { status: { in: ACTIVE_STATUSES } }] },
        { and: [{ action: { equals: "direct_notice" } }, { status: { in: ["pending", "failed"] } }] },
      ] },
      sort: "createdAt",
      page,
      limit: pageSize,
      depth: 2,
      overrideAccess: true,
    } as any)
    docs.push(...result.docs as RecordLike[])
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
    const tenant = relation(requirement.tenant)
    const document = relation(requirement.document)
    const adminUrl = tenant ? tenantAdminUrl(tenant) : null
    if (!tenant || !document || !adminUrl || !requirement.subjectEmail) {
      skipped += 1
      await input.payload.update({
        collection: "legal-requirements" as any,
        id: requirement.id,
        data: { status: "failed", lastError: "Legal notification is missing tenant, document, admin URL, or recipient data." },
        depth: 0,
        overrideAccess: true,
      } as any)
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
      collection: "legal-requirements" as any,
      id: requirement.id,
      depth: 0,
      overrideAccess: true,
    } as any) as RecordLike
    if (!ACTIVE_STATUSES.includes(currentRequirement.status) || !NOTIFIABLE_ACTIONS.includes(currentRequirement.action)) {
      await input.payload.update({
        collection: "legal-notification-deliveries" as any,
        id: delivery.id,
        data: { status: "cancelled", leaseUntil: null, lastError: null },
        depth: 0,
        overrideAccess: true,
      } as any)
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
    const message = requirement.action === "direct_notice"
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
        payload: input.payload as any,
      })
      const sentAt = now.toISOString()
      const marked = await input.payload.update({
        collection: "legal-notification-deliveries" as any,
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
      } as any) as any
      if (Array.isArray(marked?.docs) && marked.docs.length > 0) {
        await markRequirementNotified(input.payload, requirement, sentAt)
      }
      sent += 1
    } catch (error) {
      const normalized = error instanceof MailSendError ? error.normalized : null
      const permanent = normalized?.retryState === "permanent"
      const message = normalized?.providerErrorMessage ?? (error instanceof Error ? error.message : "Unknown email delivery error")
      await input.payload.update({
        collection: "legal-notification-deliveries" as any,
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
      } as any)
      await input.payload.update({
        collection: "legal-requirements" as any,
        id: requirement.id,
        data: { status: "failed", lastError: message },
        depth: 0,
        overrideAccess: true,
      } as any)
      failed += 1
    }
  }
  return { examined: requirements.length, sent, failed, skipped }
}
