import "server-only"

import type { Payload } from "payload"
import { getPayload } from "payload"
import config from "@/payload.config"
import { normalisePagination, type PayloadFindResult } from "./paginate"

type RecordLike = Record<string, any>
type Tone = "neutral" | "info" | "success" | "warning" | "destructive"

export type LegalStatusMetric = {
  key: string
  label: string
  value: number | string
  tone: Tone
  href?: string
  helper?: string
}

export type LegalAttentionRow = {
  id: string
  kind: "delivery" | "requirement" | "release"
  severity: "warning" | "destructive"
  title: string
  tenant: string | null
  subject: string
  detail: string
  ageOrDeadline: string | null
  status: string
  href: string
}

export type LegalReleaseRow = {
  id: string
  title: string
  documentType: string
  locale: string
  documentVersion: string
  changeCategory: string
  customerAction: string
  publishedAt: string
  effectiveAt: string
  state: string
  sourceCommit: string
  href: string
}

export type LegalRequirementRow = {
  id: string
  tenant: string | null
  subjectEmail: string
  documentLabel: string
  action: string
  status: string
  enforceAt: string | null
  objectionDeadlineAt: string | null
  notifiedAt: string | null
  noticeDeliveredAt: string | null
  qualifyingUseAt: string | null
  deemedAcceptedAt: string | null
  objectedAt: string | null
  resolutionBasis: string | null
  satisfiedAt: string | null
  href: string
}

export type LegalDeliveryRow = {
  id: string
  tenant: string | null
  recipientMasked: string
  kind: string
  status: string
  attemptCount: number
  nextAttemptAt: string | null
  lastAttemptAt: string | null
  sentAt: string | null
  retryState: string | null
  lastError: string | null
  href: string
}

export type LegalAcceptanceRow = {
  id: string
  tenant: string | null
  actorEmailMasked: string
  documentLabel: string
  documentVersion: string
  acceptedAt: string
  statementVersion: string
  href: string
}

export type LegalAuditRow = {
  id: string
  action: string
  target: string
  actorEmailMasked: string
  reason: string
  occurredAt: string
  requestId: string
  href: string
}

export type LegalListResult<T> = PayloadFindResult<T>
export type LegalListOptions = { page?: number; pageSize?: number; q?: string; status?: string }

type LegalPayload = Pick<Payload, "find" | "count" | "findByID">

const asRecord = (value: unknown): RecordLike | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as RecordLike : null

const text = (value: unknown, fallback = ""): string =>
  typeof value === "string" && value.trim() ? value.trim() : fallback

const relationLabel = (value: unknown, keys: string[]): string | null => {
  const record = asRecord(value)
  if (!record) return null
  for (const key of keys) {
    const candidate = text(record[key])
    if (candidate) return candidate
  }
  return null
}

const tenantLabel = (value: unknown): string | null => relationLabel(value, ["name", "slug", "domain"])
const documentLabel = (value: unknown): string => {
  const record = asRecord(value)
  if (!record) return "Juridisch document"
  return text(record.title) || (record.documentType === "platform-terms" ? "Algemene voorwaarden" : record.documentType === "platform-privacy" ? "Privacy- en cookieverklaring" : "Juridisch document")
}

const iso = (value: unknown): string | null => typeof value === "string" && value ? value : null

export function maskEmailRecipient(email: string): string {
  const [local, domain] = email.trim().split("@")
  if (!local || !domain) return "afgeschermd"
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible}${"*".repeat(Math.max(2, Math.min(6, local.length - visible.length)))}@${domain}`
}

const clauses = (...values: Array<Record<string, unknown> | null>): Record<string, unknown> => {
  const active = values.filter(Boolean) as Record<string, unknown>[]
  if (!active.length) return {}
  return active.length === 1 ? active[0]! : { and: active }
}

const count = async (payload: LegalPayload, collection: string, where: Record<string, unknown>) =>
  (await payload.count({ collection: collection as any, where, overrideAccess: true } as any)).totalDocs

const clientFor = async (payload?: LegalPayload): Promise<LegalPayload> => payload ?? await getPayload({ config })

export async function getLegalAttentionItems(
  payload: LegalPayload,
  options: { now?: Date; limit?: number } = {},
): Promise<LegalAttentionRow[]> {
  const now = options.now ?? new Date()
  const limit = options.limit ?? 12
  const [deliveries, requirements, scheduled] = await Promise.all([
    payload.find({
      collection: "legal-notification-deliveries" as any,
      where: { status: { equals: "failed" } },
      sort: "-lastAttemptAt",
      limit,
      depth: 1,
      overrideAccess: true,
    } as any),
    payload.find({
      collection: "legal-requirements" as any,
      where: { status: { in: ["pending", "notified", "failed"] } },
      sort: "enforceAt",
      limit,
      depth: 1,
      overrideAccess: true,
    } as any),
    payload.find({
      collection: "legal-documents" as any,
      where: { effectiveAt: { greater_than: now.toISOString() } },
      sort: "effectiveAt",
      limit,
      depth: 0,
      overrideAccess: true,
    } as any),
  ])

  const ranked: Array<LegalAttentionRow & { rank: number; time: number }> = []
  for (const item of deliveries.docs as RecordLike[]) {
    const permanent = item.retryState === "permanent"
    ranked.push({
      id: `delivery-${item.id}`,
      kind: "delivery",
      severity: permanent ? "destructive" : "warning",
      title: permanent ? "Definitieve verzendfout" : "Verzending opnieuw proberen",
      tenant: tenantLabel(item.tenant),
      subject: maskEmailRecipient(text(item.recipient)),
      detail: permanent ? "De provider heeft deze juridische kennisgeving definitief geweigerd." : "De juridische kennisgeving kon niet worden verzonden.",
      ageOrDeadline: iso(item.lastAttemptAt),
      status: permanent ? "permanent" : "retryable",
      href: `/legal/deliveries/${item.id}`,
      rank: permanent ? 0 : 2,
      time: new Date(item.lastAttemptAt ?? 0).getTime(),
    })
  }
  for (const item of requirements.docs as RecordLike[]) {
    const noticeAndUse = item.action === "notice_and_continued_use"
    const deadline = noticeAndUse ? iso(item.objectionDeadlineAt) : iso(item.enforceAt)
    const elapsed = Boolean(deadline && new Date(deadline) <= now)
    const missingUse = noticeAndUse && elapsed && item.noticeDeliveredAt && !item.qualifyingUseAt
    const explicitRequired = ["mandatory_reaccept", "reaccept_on_next_transaction"].includes(item.action)
    ranked.push({
      id: `requirement-${item.id}`,
      kind: "requirement",
      severity: missingUse ? "warning" : "warning",
      title: missingUse
        ? "Geen kwalificerend gebruik vastgelegd"
        : explicitRequired ? "Expliciete acceptatie vereist" : "Klantreactie afwachten",
      tenant: tenantLabel(item.tenant),
      subject: maskEmailRecipient(text(item.subjectEmail)),
      detail: documentLabel(item.document),
      ageOrDeadline: deadline,
      status: missingUse ? "no_qualifying_use" : explicitRequired ? "explicit_required" : "awaiting_response",
      href: `/legal/requirements/${item.id}`,
      rank: missingUse || explicitRequired ? 1 : 3,
      time: new Date(deadline ?? 0).getTime(),
    })
  }
  for (const item of scheduled.docs as RecordLike[]) {
    ranked.push({
      id: `release-${item.id}`,
      kind: "release",
      severity: "warning",
      title: "Publicatie gepland",
      tenant: null,
      subject: documentLabel(item),
      detail: text(item.changeSummary, "Juridische publicatie wordt binnenkort actief."),
      ageOrDeadline: iso(item.effectiveAt),
      status: "scheduled",
      href: `/legal/releases/${item.id}`,
      rank: 4,
      time: new Date(item.effectiveAt ?? 0).getTime(),
    })
  }
  return ranked
    .sort((a, b) => a.rank - b.rank || a.time - b.time)
    .slice(0, limit)
    .map(({ rank: _rank, time: _time, ...item }) => item)
}

export async function getLegalOperationsOverview(
  payload?: LegalPayload,
  options: { now?: Date; attentionLimit?: number } = {},
): Promise<{ metrics: LegalStatusMetric[]; attention: LegalAttentionRow[] }> {
  const client = await clientFor(payload)
  const now = options.now ?? new Date()
  const actionable = { status: { in: ["pending", "notified", "failed"] } }
  const [activePublications, openRequirements, objectedRequirements, deemedAcceptances, failedDeliveries, attention] = await Promise.all([
    count(client, "legal-documents", { effectiveAt: { less_than_equal: now.toISOString() } }),
    count(client, "legal-requirements", actionable),
    count(client, "legal-requirements", { status: { equals: "objected" } }),
    count(client, "legal-requirements", { deemedAcceptedAt: { exists: true } }),
    count(client, "legal-notification-deliveries", { status: { equals: "failed" } }),
    getLegalAttentionItems(client, { now, limit: options.attentionLimit }),
  ])
  return {
    metrics: [
      { key: "registered-publications", label: "Geregistreerde publicaties", value: activePublications, tone: "neutral", href: "/legal/releases" },
      { key: "open-requirements", label: "Open klantacties", value: openRequirements, tone: openRequirements ? "warning" : "success", href: "/legal/requirements?status=open" },
      { key: "objected-requirements", label: "Bezwaren", value: objectedRequirements, tone: objectedRequirements ? "warning" : "success", href: "/legal/requirements?status=objected" },
      { key: "deemed-acceptances", label: "Stilzwijgend aanvaard", value: deemedAcceptances, tone: "neutral", href: "/legal/requirements?status=deemed" },
      { key: "failed-deliveries", label: "Mislukte verzendingen", value: failedDeliveries, tone: failedDeliveries ? "destructive" : "success", href: "/legal/deliveries?status=failed" },
    ],
    attention,
  }
}

const mapResult = <T, U>(result: PayloadFindResult<T>, mapper: (item: T) => U): PayloadFindResult<U> => ({
  ...result,
  docs: result.docs.map(mapper),
})

export async function listLegalReleases(options: LegalListOptions = {}, payload?: LegalPayload): Promise<LegalListResult<LegalReleaseRow>> {
  const client = await clientFor(payload)
  const { page, limit } = normalisePagination(options)
  const query = options.q?.trim()
  const result = await client.find({
    collection: "legal-documents" as any,
    where: clauses(query ? { or: [{ releaseKey: { like: query } }, { changeSummary: { like: query } }, { sourceCommit: { like: query } }] } : null),
    sort: "-publishedAt",
    page,
    limit,
    depth: 0,
    overrideAccess: true,
  } as any) as PayloadFindResult<RecordLike>
  const now = new Date()
  return mapResult(result, (item): LegalReleaseRow => ({
    id: String(item.id), title: documentLabel(item), documentType: text(item.documentType), locale: text(item.locale),
    documentVersion: text(item.documentVersion), changeCategory: text(item.changeCategory), customerAction: text(item.customerAction),
    publishedAt: text(item.publishedAt), effectiveAt: text(item.effectiveAt),
    state: new Date(item.effectiveAt) > now ? "scheduled" : "active", sourceCommit: text(item.sourceCommit), href: `/legal/releases/${item.id}`,
  }))
}

export async function listLegalRequirements(options: LegalListOptions = {}, payload?: LegalPayload): Promise<LegalListResult<LegalRequirementRow>> {
  const client = await clientFor(payload)
  const { page, limit } = normalisePagination(options)
  const query = options.q?.trim()
  const statusWhere = options.status === "open"
    ? { status: { in: ["pending", "notified", "failed"] } }
    : options.status === "deemed"
      ? { deemedAcceptedAt: { exists: true } }
      : options.status && options.status !== "all" ? { status: { equals: options.status } } : null
  const result = await client.find({
    collection: "legal-requirements" as any,
    where: clauses(statusWhere, query ? { or: [{ subjectEmail: { like: query } }, { requirementKey: { like: query } }] } : null),
    sort: "enforceAt", page, limit, depth: 1, overrideAccess: true,
  } as any) as PayloadFindResult<RecordLike>
  return mapResult(result, (item): LegalRequirementRow => ({
    id: String(item.id), tenant: tenantLabel(item.tenant), subjectEmail: maskEmailRecipient(text(item.subjectEmail)), documentLabel: documentLabel(item.document),
    action: text(item.action), status: text(item.status), enforceAt: iso(item.enforceAt), objectionDeadlineAt: iso(item.objectionDeadlineAt),
    notifiedAt: iso(item.notifiedAt), noticeDeliveredAt: iso(item.noticeDeliveredAt), qualifyingUseAt: iso(item.qualifyingUseAt),
    deemedAcceptedAt: iso(item.deemedAcceptedAt), objectedAt: iso(item.objectedAt), resolutionBasis: text(item.resolutionBasis) || null,
    satisfiedAt: iso(item.satisfiedAt), href: `/legal/requirements/${item.id}`,
  }))
}

export async function listLegalDeliveries(options: LegalListOptions = {}, payload?: LegalPayload): Promise<LegalListResult<LegalDeliveryRow>> {
  const client = await clientFor(payload)
  const { page, limit } = normalisePagination(options)
  const query = options.q?.trim()
  const result = await client.find({
    collection: "legal-notification-deliveries" as any,
    where: clauses(options.status && options.status !== "all" ? { status: { equals: options.status } } : null, query ? { or: [{ recipient: { like: query } }, { notificationKey: { like: query } }] } : null),
    sort: "-lastAttemptAt", page, limit, depth: 1, overrideAccess: true,
  } as any) as PayloadFindResult<RecordLike>
  return mapResult(result, (item): LegalDeliveryRow => ({
    id: String(item.id), tenant: tenantLabel(item.tenant), recipientMasked: maskEmailRecipient(text(item.recipient)), kind: text(item.kind), status: text(item.status),
    attemptCount: Number(item.attemptCount ?? 0), nextAttemptAt: iso(item.nextAttemptAt), lastAttemptAt: iso(item.lastAttemptAt), sentAt: iso(item.sentAt),
    retryState: text(item.retryState) || null, lastError: item.lastError ? "Verzendfout beschikbaar in detail" : null, href: `/legal/deliveries/${item.id}`,
  }))
}

export async function listLegalAcceptances(options: LegalListOptions = {}, payload?: LegalPayload): Promise<LegalListResult<LegalAcceptanceRow>> {
  const client = await clientFor(payload)
  const { page, limit } = normalisePagination(options)
  const query = options.q?.trim()
  const result = await client.find({
    collection: "agreement-acceptances" as any,
    where: clauses(query ? { or: [{ actorEmail: { like: query } }, { evidenceKey: { like: query } }] } : null),
    sort: "-acceptedAt", page, limit, depth: 1, overrideAccess: true,
  } as any) as PayloadFindResult<RecordLike>
  return mapResult(result, (item): LegalAcceptanceRow => ({
    id: String(item.id), tenant: tenantLabel(item.tenant), actorEmailMasked: maskEmailRecipient(text(item.actorEmail)), documentLabel: documentLabel(item.document),
    documentVersion: text(item.documentVersion), acceptedAt: text(item.acceptedAt), statementVersion: text(item.statementVersion), href: `/legal/acceptances/${item.id}`,
  }))
}

export async function listLegalAuditEvents(options: LegalListOptions = {}, payload?: LegalPayload): Promise<LegalListResult<LegalAuditRow>> {
  const client = await clientFor(payload)
  const { page, limit } = normalisePagination(options)
  const query = options.q?.trim()
  const result = await client.find({
    collection: "legal-operator-events" as any,
    where: clauses(query ? { or: [{ actorEmail: { like: query } }, { targetId: { like: query } }, { requestId: { like: query } }] } : null),
    sort: "-occurredAt", page, limit, depth: 0, overrideAccess: true,
  } as any) as PayloadFindResult<RecordLike>
  return mapResult(result, (item): LegalAuditRow => ({
    id: String(item.id), action: text(item.action), target: `${text(item.targetCollection)}:${text(item.targetId)}`,
    actorEmailMasked: maskEmailRecipient(text(item.actorEmail)), reason: text(item.reason), occurredAt: text(item.occurredAt),
    requestId: text(item.requestId), href: `/admin/collections/legal-operator-events/${item.id}`,
  }))
}

export async function getLegalRecord(collection: "legal-documents" | "legal-requirements" | "legal-notification-deliveries" | "agreement-acceptances", id: string | number): Promise<RecordLike | null> {
  const payload = await getPayload({ config })
  try {
    return await payload.findByID({ collection, id, depth: 2, overrideAccess: true } as any) as RecordLike
  } catch (error) {
    const status = (error as { status?: unknown })?.status
    if (status === 404 || (error as { name?: unknown })?.name === "NotFound") return null
    throw error
  }
}
