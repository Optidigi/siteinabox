import crypto from "node:crypto"
import type { Payload } from "payload"
import { relationshipId } from "@/lib/relationshipId"

type RecordLike = Record<string, any>

export const CUSTOMER_REACCEPTANCE_STATEMENT_VERSION = "customer-reacceptance-2026-07-11.1"
export const CUSTOMER_REACCEPTANCE_STATEMENT =
  "Ik ga akkoord met de bijgewerkte algemene voorwaarden van Site in a Box."

const actionableStatuses = ["pending", "notified", "failed"] as const
const acceptanceActions = ["mandatory_reaccept", "reaccept_on_next_transaction"] as const
const explicitlyAcceptableActions = [...acceptanceActions, "notice_and_continued_use"] as const
const noticeAndUseAction = "notice_and_continued_use"

const documentRecord = (requirement: RecordLike): RecordLike | null =>
  requirement.document && typeof requirement.document === "object" ? requirement.document : null

const relationshipValue = (value: unknown): string | number | null => {
  if (value == null) return null
  if (typeof value === "object") {
    const id = (value as { id?: unknown }).id
    return typeof id === "string" || typeof id === "number" ? id : null
  }
  return typeof value === "string" || typeof value === "number" ? value : null
}

export type CustomerLegalRequirement = {
  id: string | number
  requirementKey: string
  action: "publish_notice" | "direct_notice" | "notice_and_continued_use" | "reaccept_on_next_transaction" | "mandatory_reaccept"
  status: "pending" | "notified" | "failed"
  enforceAt: string | null
  objectionDeadlineAt: string | null
  noticeDeliveredAt: string | null
  qualifyingUseAt: string | null
  resolutionBasis: string | null
  canObject: boolean
  documentId: string | number
  documentType: string
  documentVersion: string
  acceptanceVersion: string | null
  changeSummary: string
  effectiveAt: string
  href: string
  isInitialRelease: boolean
  requiresAcceptance: boolean
  overdue: boolean
}

export type CustomerLegalAcceptance = {
  id: string | number
  documentVersion: string
  acceptanceVersion: string
  acceptedAt: string
  actorEmail: string
  href: string
}

export async function getTenantLegalAcceptanceHistory(
  payload: Payload,
  tenantId: string | number,
): Promise<CustomerLegalAcceptance[]> {
  const result = await payload.find({
    collection: "agreement-acceptances" as any,
    where: { tenant: { equals: tenantId } },
    sort: "-acceptedAt",
    limit: 10,
    depth: 1,
    overrideAccess: true,
  } as any)
  return (result.docs as RecordLike[]).flatMap((acceptance) => {
    const document = acceptance.document && typeof acceptance.document === "object" ? acceptance.document : null
    if (!document) return []
    return [{
      id: acceptance.id,
      documentVersion: String(acceptance.documentVersion),
      acceptanceVersion: String(acceptance.acceptanceVersion),
      acceptedAt: String(acceptance.acceptedAt),
      actorEmail: String(acceptance.actorEmail),
      href: legalDocumentHref(String(document.documentType), String(acceptance.documentVersion)),
    }]
  })
}

export const legalDocumentHref = (documentType: string, documentVersion: string): string => {
  const publicBase = process.env.NEXT_PUBLIC_SIAB_SITE_URL ?? "https://www.siteinabox.nl"
  if (documentType === "platform-terms") return `${publicBase}/juridisch/algemene-voorwaarden/${documentVersion}`
  if (documentType === "platform-privacy") return `${publicBase}/juridisch/privacy-en-cookieverklaring/${documentVersion}`
  return `${publicBase}/privacy-en-cookieverklaring`
}

export async function getTenantLegalRequirements(
  payload: Payload,
  tenantId: string | number,
  now = new Date(),
): Promise<CustomerLegalRequirement[]> {
  const result = await payload.find({
    collection: "legal-requirements" as any,
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { status: { in: [...actionableStatuses] } },
      ],
    },
    sort: "enforceAt",
    limit: 100,
    depth: 1,
    overrideAccess: true,
  } as any)

  const projected = (result.docs as RecordLike[]).flatMap((requirement) => {
    if (["publish_notice", "direct_notice"].includes(requirement.action) && requirement.status === "notified") return []
    const document = documentRecord(requirement)
    const documentId = relationshipId(requirement.document)
    if (!document || documentId == null) return []
    const enforceAt = typeof requirement.enforceAt === "string" ? requirement.enforceAt : null
    const action = requirement.action as CustomerLegalRequirement["action"]
    const requiresAcceptance = acceptanceActions.includes(action as (typeof acceptanceActions)[number])
    return [{
      id: requirement.id,
      requirementKey: String(requirement.requirementKey),
      action,
      status: requirement.status as CustomerLegalRequirement["status"],
      enforceAt,
      objectionDeadlineAt: typeof requirement.objectionDeadlineAt === "string" ? requirement.objectionDeadlineAt : null,
      noticeDeliveredAt: typeof requirement.noticeDeliveredAt === "string" ? requirement.noticeDeliveredAt : null,
      qualifyingUseAt: typeof requirement.qualifyingUseAt === "string" ? requirement.qualifyingUseAt : null,
      resolutionBasis: typeof requirement.resolutionBasis === "string" ? requirement.resolutionBasis : null,
      canObject: action === noticeAndUseAction && requirement.status === "notified" && !requirement.objectedAt,
      documentId,
      documentType: String(document.documentType),
      documentVersion: String(document.documentVersion),
      acceptanceVersion: typeof document.acceptanceVersion === "string" ? document.acceptanceVersion : null,
      changeSummary: String(document.changeSummary ?? ""),
      effectiveAt: String(document.effectiveAt),
      href: legalDocumentHref(String(document.documentType), String(document.documentVersion)),
      isInitialRelease: document.replaces == null,
      requiresAcceptance,
      overdue: Boolean(action === "mandatory_reaccept" && enforceAt && new Date(enforceAt) <= now),
    }]
  })
  return [...new Map(projected.map((item) => [`${item.documentId}:${item.action}`, item])).values()]
}

export async function acceptCustomerLegalRequirement(input: {
  payload: Payload
  requirementId: string | number
  tenantId: string | number
  actorUserId: string | number
  actorEmail: string
  requestId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  now?: Date
}) {
  const requirement = await input.payload.findByID({
    collection: "legal-requirements" as any,
    id: input.requirementId,
    depth: 1,
    overrideAccess: true,
  } as any) as RecordLike
  if (relationshipId(requirement.tenant) !== String(input.tenantId)) throw new Error("Legal requirement does not belong to this tenant.")
  if (requirement.status === "satisfied") return requirement
  if (requirement.status === "waived") return requirement
  if (!actionableStatuses.includes(requirement.status)) throw new Error("Legal requirement cannot be accepted in its current state.")
  if (!explicitlyAcceptableActions.includes(requirement.action)) throw new Error("This legal notice does not allow explicit acceptance.")

  const document = documentRecord(requirement)
  const documentId = relationshipId(requirement.document)
  const documentValue = relationshipValue(requirement.document)
  const tenantValue = relationshipValue(requirement.tenant)
  if (!document || documentId == null || documentValue == null || tenantValue == null || !document.acceptanceVersion) {
    throw new Error("The legal document is not available for acceptance.")
  }

  const evidenceKey = `${requirement.requirementKey}:acceptance:${document.acceptanceVersion}`
  const existing = await input.payload.find({
    collection: "agreement-acceptances" as any,
    where: { evidenceKey: { equals: evidenceKey } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  } as any)
  const acceptedAt = (input.now ?? new Date()).toISOString()
  let acceptance = existing.docs[0]
  if (!acceptance) {
    try {
      acceptance = await input.payload.create({
        collection: "agreement-acceptances" as any,
        data: {
          evidenceKey,
          tenant: tenantValue,
          document: documentValue,
          documentVersion: document.documentVersion,
          acceptanceVersion: document.acceptanceVersion,
          contentHash: document.contentHash,
          statementVersion: CUSTOMER_REACCEPTANCE_STATEMENT_VERSION,
          statementText: CUSTOMER_REACCEPTANCE_STATEMENT,
          actorUser: input.actorUserId,
          actorEmail: input.actorEmail,
          acceptedAt,
          requestId: input.requestId ?? crypto.randomUUID(),
          ipAddress: input.ipAddress ?? undefined,
          userAgent: input.userAgent ?? undefined,
        },
        depth: 0,
        overrideAccess: true,
      } as any)
    } catch (error) {
      const raced = await input.payload.find({
        collection: "agreement-acceptances" as any,
        where: { evidenceKey: { equals: evidenceKey } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      } as any)
      acceptance = raced.docs[0]
      if (!acceptance) throw error
    }
  }

  const matching = await input.payload.find({
    collection: "legal-requirements" as any,
    where: {
      and: [
        { tenant: { equals: input.tenantId } },
        { document: { equals: documentId } },
        { action: { equals: requirement.action } },
        { status: { in: [...actionableStatuses] } },
      ],
    },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  } as any)
  const satisfied = await Promise.all((matching.docs as RecordLike[]).map((item) => input.payload.update({
    collection: "legal-requirements" as any,
    id: item.id,
    data: {
      status: "satisfied",
      satisfiedAt: acceptedAt,
      acceptance: acceptance.id,
      resolutionBasis: "explicit_acceptance",
      resolutionEvidence: { acceptanceId: acceptance.id },
      lastError: null,
    },
    depth: 0,
    overrideAccess: true,
  } as any)))
  const requirementIds = (matching.docs as RecordLike[]).map((item) => item.id)
  if (requirementIds.length) {
    const deliveries = await input.payload.find({
      collection: "legal-notification-deliveries" as any,
      where: {
        and: [
          { requirement: { in: requirementIds } },
          { status: { in: ["queued", "processing", "failed"] } },
        ],
      },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    } as any)
    await Promise.all((deliveries.docs as RecordLike[]).map((delivery) => input.payload.update({
      collection: "legal-notification-deliveries" as any,
      id: delivery.id,
      data: { status: "cancelled", leaseUntil: null, lastError: null },
      depth: 0,
      overrideAccess: true,
    } as any)))
  }
  return satisfied.find((item: RecordLike) => String(item.id) === String(requirement.id)) ?? satisfied[0]
}

export async function assertTenantPublicationAllowed(
  payload: Payload,
  tenantId: string | number,
  now = new Date(),
) {
  const requirements = await getTenantLegalRequirements(payload, tenantId, now)
  const blocking = requirements.find((item) => item.action === "mandatory_reaccept" && item.overdue)
  if (blocking) {
    throw new Error("Legal acceptance required. Open Settings to accept the updated terms before publishing.")
  }
}

export async function satisfyRequirementsFromTransaction(input: {
  payload: Payload
  tenantId: string | number
  actorEmail: string
  documentId: string | number
  acceptanceId: string | number
  acceptedAt: string
}) {
  const result = await input.payload.find({
    collection: "legal-requirements" as any,
    where: {
      and: [
        { tenant: { equals: input.tenantId } },
        { document: { equals: input.documentId } },
        { action: { in: [...acceptanceActions] } },
        { status: { in: [...actionableStatuses] } },
      ],
    },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  } as any)
  await Promise.all((result.docs as RecordLike[]).map((requirement) => input.payload.update({
    collection: "legal-requirements" as any,
    id: requirement.id,
    data: {
      status: "satisfied",
      satisfiedAt: input.acceptedAt,
      acceptance: input.acceptanceId,
      resolutionBasis: "transaction_acceptance",
      resolutionEvidence: { acceptanceId: input.acceptanceId, actorEmail: input.actorEmail },
      lastError: null,
    },
    depth: 0,
    overrideAccess: true,
  } as any)))
}

export async function objectToNoticeAndContinuedUse(input: {
  payload: Payload
  requirementId: string | number
  tenantId: string | number
  actorUserId: string | number
  actorEmail: string
  reason?: string | null
  requestId?: string | null
  now?: Date
}) {
  const requirement = await input.payload.findByID({
    collection: "legal-requirements" as any,
    id: input.requirementId,
    depth: 1,
    overrideAccess: true,
  } as any) as RecordLike
  if (relationshipId(requirement.tenant) !== String(input.tenantId)) throw new Error("Legal requirement does not belong to this tenant.")
  if (requirement.action !== noticeAndUseAction) throw new Error("This requirement does not support objection.")
  if (!actionableStatuses.includes(requirement.status)) throw new Error("Legal requirement cannot be objected to in its current state.")

  const objectedAt = (input.now ?? new Date()).toISOString()
  return input.payload.update({
    collection: "legal-requirements" as any,
    id: requirement.id,
    data: {
      status: "objected",
      objectedAt,
      resolutionBasis: "objection",
      resolutionEvidence: {
        actorUserId: input.actorUserId,
        actorEmail: input.actorEmail,
        reason: input.reason ?? null,
        requestId: input.requestId ?? crypto.randomUUID(),
      },
      lastError: null,
    },
    depth: 0,
    overrideAccess: true,
  } as any)
}

export async function recordQualifyingContinuedUse(input: {
  payload: Payload
  tenantId: string | number
  occurredAt?: Date
  evidenceType: string
  evidenceId: string
  req?: any
}) {
  const request = input.req ? { req: input.req } : {}
  const occurredAt = (input.occurredAt ?? new Date()).toISOString()
  const result = await input.payload.find({
    collection: "legal-requirements" as any,
    where: {
      and: [
        { tenant: { equals: input.tenantId } },
        { action: { equals: noticeAndUseAction } },
        { status: { equals: "notified" } },
        { noticeDeliveredAt: { exists: true } },
      ],
    },
    limit: 100,
    depth: 0,
    overrideAccess: true,
    ...request,
  } as any)
  return Promise.all((result.docs as RecordLike[]).filter((item) => !item.objectedAt).map((item) => input.payload.update({
    collection: "legal-requirements" as any,
    id: item.id,
    data: {
      qualifyingUseAt: item.qualifyingUseAt ?? occurredAt,
      resolutionEvidence: {
        ...(item.resolutionEvidence && typeof item.resolutionEvidence === "object" ? item.resolutionEvidence : {}),
        qualifyingUse: { type: input.evidenceType, id: input.evidenceId, occurredAt },
      },
    },
    depth: 0,
    overrideAccess: true,
    ...request,
  } as any)))
}

export async function resolveNoticeAndContinuedUseRequirements(input: {
  payload: Payload
  now?: Date
}) {
  const now = input.now ?? new Date()
  const resolvedAt = now.toISOString()
  const result = await input.payload.find({
    collection: "legal-requirements" as any,
    where: {
      and: [
        { action: { equals: noticeAndUseAction } },
        { status: { equals: "notified" } },
        { objectionDeadlineAt: { less_than_equal: resolvedAt } },
        { noticeDeliveredAt: { exists: true } },
        { qualifyingUseAt: { exists: true } },
      ],
    },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  } as any)
  return Promise.all((result.docs as RecordLike[]).filter((item) =>
    !item.objectedAt &&
    typeof item.noticeDeliveredAt === "string" &&
    typeof item.qualifyingUseAt === "string" &&
    new Date(item.noticeDeliveredAt) <= new Date(item.qualifyingUseAt) &&
    new Date(item.qualifyingUseAt) <= now,
  ).map((item) => input.payload.update({
    collection: "legal-requirements" as any,
    id: item.id,
    data: {
      status: "satisfied",
      satisfiedAt: resolvedAt,
      deemedAcceptedAt: resolvedAt,
      resolutionBasis: "qualifying_continued_use",
      resolutionEvidence: {
        ...(item.resolutionEvidence && typeof item.resolutionEvidence === "object" ? item.resolutionEvidence : {}),
        noticeDeliveredAt: item.noticeDeliveredAt,
        objectionDeadlineAt: item.objectionDeadlineAt,
      },
      lastError: null,
    },
    depth: 0,
    overrideAccess: true,
  } as any)))
}
