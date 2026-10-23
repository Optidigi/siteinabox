// Payload jobs/CLI and Next server routes share this Node module. Operator
// authentication below applies independently of React's module conditions.
import { isDeepStrictEqual } from "node:util"
import type { Payload } from "payload"
import type { LegalDocument, User } from "@/payload-types"
import { hashLegalContent } from "@siteinabox/legal-content"
import { assertProductLegalReviewable, getProductLegalRelease, getProductLegalStatement, productLegalReleases, productLegalState } from "@siteinabox/legal-content/product"
import { asRecord } from "@/lib/record"
import { platformCmsOrigin } from "@/lib/hostToTenant"
import { legalChangeCategories, legalConsentActions } from "@siteinabox/contracts/legal"

export const isProductLegalKey = (key: unknown) => typeof key === "string" && key.startsWith("product:")
const eventKey = (key: string, state: string) => `product:${key}:${state}`
const oneEvent = async (payload: Pick<Payload, "find">, key: string) => (await payload.find({ collection: "legal-publication-events",
  where: { eventKey: { equals: key } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] ?? null
const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0
const metadataId = (value: unknown): number | null => {
  const id = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

async function operator(payload: Payload, actor: User) {
  if (!actor?.id || actor.role !== "super-admin") throw new Error("A platform legal operator is required")
  const current = await payload.findByID({ collection: "users", id: actor.id, depth: 0, overrideAccess: true })
  if (current.role !== "super-admin" || current.email !== actor.email) throw new Error("Legal operator authority changed")
  return { user: current, context: { governedProductLegal: true } }
}

export async function reviewProductLegalRelease(input: { payload: Payload; actor: User; releaseKey: string;
  approvalRef: string; publishedAt: string; effectiveAt: string; audienceTenantIds: number[]; sourceCommit: string }) {
  const req = await operator(input.payload, input.actor)
  const release = getProductLegalRelease(input.releaseKey)
  assertProductLegalReviewable(release)
  if (!nonEmpty(input.approvalRef) || !/^[a-f0-9]{40}$/.test(input.sourceCommit) ||
      !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(input.publishedAt) || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(input.effectiveAt) ||
      !Number.isFinite(Date.parse(input.publishedAt)) || !Number.isFinite(Date.parse(input.effectiveAt)) ||
      Date.parse(input.publishedAt) > Date.parse(input.effectiveAt) ||
      !Array.isArray(input.audienceTenantIds) || input.audienceTenantIds.some(id => !Number.isSafeInteger(id) || id < 1)) {
    throw new Error("Explicit owner review, dates, source and audience are required")
  }
  for (const doc of release.documents) {
    if ((Date.parse(input.effectiveAt) - Date.parse(input.publishedAt)) < (doc.change.noticeDays ?? 0) * 86400000) {
      throw new Error("Owner-approved notice period is not satisfied")
    }
  }
  const documents = []
  for (const doc of release.documents) {
    const key = `product:${release.releaseKey}:${doc.documentType}:${doc.locale}:${doc.documentVersion}`
    const category = legalChangeCategories.find(value => value === doc.change.category)
    const consentAction = legalConsentActions.find(value => value === doc.change.consentAction)
    if (!category || !consentAction) throw new Error("Legal change decision is invalid")
    let stored = (await input.payload.find({ collection: "legal-documents", where: { releaseKey: { equals: key } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
    if (stored) {
      if (stored.contentHash !== doc.contentHash || stored.content !== doc.markdown || stored.publishedAt !== new Date(input.publishedAt).toISOString() || stored.effectiveAt !== new Date(input.effectiveAt).toISOString()) throw new Error("Reviewed legal identity already has different immutable content/dates")
    } else stored = await input.payload.create({ collection: "legal-documents", req, overrideAccess: true, depth: 0,
      data: { releaseKey: key, documentType: doc.documentType, locale: doc.locale, documentVersion: doc.documentVersion,
        acceptanceVersion: doc.acceptanceVersion, replaces: doc.replaces, content: doc.markdown, contentHash: doc.contentHash,
        sourceCommit: input.sourceCommit, publishedAt: input.publishedAt, effectiveAt: input.effectiveAt,
        changeCategory: category, changeSummary: doc.change.summary, changeRationale: doc.change.rationale,
        customerAction: doc.change.customerAction, consentAction, audience: doc.change.audience, noticeDays: doc.change.noticeDays } })
    documents.push({ id: stored.id, documentType: doc.documentType, locale: doc.locale, documentVersion: doc.documentVersion,
      contentHash: doc.contentHash, acceptanceVersion: doc.acceptanceVersion, statement: doc.documentType === "platform-terms" ? getProductLegalStatement(doc.statementVersion ?? "", doc.locale) : null })
  }
  const metadata = { productBundleKey: release.releaseKey, bundleHash: release.bundleHash, approvalRef: input.approvalRef,
    actorId: String(input.actor.id), actorEmail: input.actor.email, publishedAt: new Date(input.publishedAt).toISOString(), effectiveAt: new Date(input.effectiveAt).toISOString(), documents, audienceTenantIds: [...new Set(input.audienceTenantIds)].sort((a, b) => a - b) }
  const existing = await oneEvent(input.payload, eventKey(release.releaseKey, "reviewed"))
  if (existing) {
    if (!isDeepStrictEqual(existing.metadata, metadata)) throw new Error("Owner review evidence is immutable")
    return existing
  }
  const first = documents[0]
  if (!first) throw new Error("Reviewed bundle is empty")
  return input.payload.create({ collection: "legal-publication-events", req, overrideAccess: true, depth: 0,
    data: { eventKey: eventKey(release.releaseKey, "reviewed"), document: first.id, eventType: "registered",
      occurredAt: new Date().toISOString(), metadata } })
}

export async function activateProductLegalRelease(input: { payload: Payload; actor: User; releaseKey: string;
  authorizationRef: string; expectedBundleHash: string; now?: Date }) {
  const req = await operator(input.payload, input.actor)
  const release = getProductLegalRelease(input.releaseKey)
  assertProductLegalReviewable(release)
  const review = await oneEvent(input.payload, eventKey(release.releaseKey, "reviewed"))
  const metadata = asRecord(review?.metadata)
  if (!metadata || metadata.bundleHash !== release.bundleHash || input.expectedBundleHash !== release.bundleHash ||
      !nonEmpty(metadata.approvalRef) || !nonEmpty(input.authorizationRef)) throw new Error("Matching owner review and separate publication authorization are required")
  const documents = Array.isArray(metadata.documents) ? metadata.documents : []
  if (documents.length !== 4) throw new Error("Reviewed translated bundle is incomplete")
  for (const value of documents) {
    const doc = asRecord(value), id = metadataId(doc?.id)
    if (!doc || !id) throw new Error("Reviewed legal document is missing")
    const stored = await input.payload.findByID({ collection: "legal-documents", id, depth: 0, overrideAccess: true })
    if (stored.contentHash !== doc.contentHash || hashLegalContent(stored.content) !== stored.contentHash || stored.publishedAt !== metadata.publishedAt || stored.effectiveAt !== metadata.effectiveAt) throw new Error("Reviewed legal bytes changed")
  }
  const existing = await oneEvent(input.payload, eventKey(release.releaseKey, "activated"))
  if (existing) {
    const prior = asRecord(existing.metadata)
    if (prior?.authorizationRef !== input.authorizationRef || prior.bundleHash !== release.bundleHash) throw new Error("Publication authorization is immutable")
    return existing
  }
  const firstId = metadataId(asRecord(documents[0])?.id)
  if (!firstId) throw new Error("Reviewed bundle anchor is unavailable")
  return input.payload.create({ collection: "legal-publication-events", req, overrideAccess: true, depth: 0,
    data: { eventKey: eventKey(release.releaseKey, "activated"), document: firstId,
      eventType: "activated", occurredAt: (input.now ?? new Date()).toISOString(),
      metadata: { ...metadata, reviewRef: metadata.approvalRef, authorizationRef: input.authorizationRef, actorId: String(input.actor.id) } } })
}

type ProductDocumentView = Pick<LegalDocument, "id" | "releaseKey" | "publishedAt" | "content" | "contentHash" | "locale" | "documentType" | "documentVersion">
export async function productDocumentPublication(payload: Pick<Payload, "find">, document: ProductDocumentView, at = new Date()) {
  if (!isProductLegalKey(document.releaseKey)) return null
  const key = document.releaseKey.split(":")[1]
  if (!key) return null
  if (productLegalReleases.find(release => release.releaseKey === key)?.draftBlockers.length) return null
  const [review, activation] = await Promise.all([oneEvent(payload, eventKey(key, "reviewed")), oneEvent(payload, eventKey(key, "activated"))])
  const approved = asRecord(review?.metadata), active = asRecord(activation?.metadata)
  if (!approved || !active || !review || !activation || active.productBundleKey !== key ||
      !nonEmpty(approved.bundleHash) || active.bundleHash !== approved.bundleHash || !nonEmpty(approved.approvalRef) || !nonEmpty(approved.actorId) ||
      active.reviewRef !== approved.approvalRef || !nonEmpty(active.authorizationRef) || !nonEmpty(active.actorId) ||
      !isDeepStrictEqual(active.documents, approved.documents) || !isDeepStrictEqual(active.audienceTenantIds, approved.audienceTenantIds) ||
      !Number.isFinite(Date.parse(activation.occurredAt)) || new Date(activation.occurredAt) > at ||
      new Date(document.publishedAt) > at || hashLegalContent(document.content) !== document.contentHash) return null
  const entries = Array.isArray(active.documents) ? active.documents : []
  if (entries.length !== 4) return null
  const combinations = new Set(entries.map(asRecord).filter(item => item && ["nl", "en"].includes(String(item.locale)) &&
    ["platform-terms", "platform-privacy"].includes(String(item.documentType))).map(item => `${item?.documentType}:${item?.locale}`))
  if (combinations.size !== 4 || !/^sha256:[a-f0-9]{64}$/.test(String(active.bundleHash))) return null
  const entry = entries.map(asRecord).find(item => item && metadataId(item.id) === document.id &&
    item.contentHash === document.contentHash && item.locale === document.locale && item.documentVersion === document.documentVersion && item.documentType === document.documentType)
  return entry ? { entry, metadata: active } : null
}

export async function hasProductLegalActivation(payload: Payload, key: string) {
  return Boolean(await oneEvent(payload, eventKey(key.split(":")[1] ?? "", "activated")))
}

export async function productLegalGovernance(payload: Pick<Payload, "find">, key: string) {
  const release = getProductLegalRelease(key)
  const [review, activation] = await Promise.all([oneEvent(payload, eventKey(key, "reviewed")), oneEvent(payload, eventKey(key, "activated"))])
  const r = asRecord(review?.metadata), a = asRecord(activation?.metadata)
  const reviewEvidence = r && nonEmpty(r.bundleHash) && nonEmpty(r.approvalRef) && nonEmpty(r.actorId)
    ? { bundleHash: r.bundleHash, approvalRef: r.approvalRef, actorId: r.actorId } : null
  const activationEvidence = a && activation && nonEmpty(a.bundleHash) && nonEmpty(a.reviewRef) && nonEmpty(a.authorizationRef) && nonEmpty(a.actorId)
    ? { bundleHash: a.bundleHash, reviewRef: a.reviewRef, authorizationRef: a.authorizationRef, actorId: a.actorId, occurredAt: activation.occurredAt } : null
  return { release, state: productLegalState(release, reviewEvidence, activationEvidence) }
}

export async function legalAcceptanceStatement(payload: Payload, document: ProductDocumentView, at = new Date()) {
  if (!isProductLegalKey(document.releaseKey)) return { version: "platform-terms-acceptance-2026-07-07.1", text: "Ik ga akkoord met de algemene voorwaarden." }
  const published = await productDocumentPublication(payload, document, at)
  const statement = asRecord(published?.entry.statement)
  if (!statement || statement.locale !== document.locale || !nonEmpty(statement.version) || !nonEmpty(statement.text)) throw new Error("Published locale-bound acceptance statement is unavailable")
  return { version: statement.version, text: statement.text }
}

export async function equivalentProductDocumentIds(payload: Payload, document: ProductDocumentView & Pick<LegalDocument, "acceptanceVersion">, at = new Date()) {
  if (!isProductLegalKey(document.releaseKey)) return [document.id]
  const publication = await productDocumentPublication(payload, document, at)
  if (!publication) throw new Error("Unpublished terms have no acceptance-equivalence authority")
  const values = publication.metadata.documents
  if (!Array.isArray(values)) throw new Error("Reviewed translated bundle is missing")
  const ids: number[] = []
  for (const value of values) {
    const entry = asRecord(value), id = metadataId(entry?.id)
    if (!entry || !id || entry.documentType !== document.documentType) continue
    const other = await payload.findByID({ collection: "legal-documents", id, depth: 0, overrideAccess: true })
    if (other.acceptanceVersion === document.acceptanceVersion && other.releaseKey.split(":")[1] === document.releaseKey.split(":")[1] &&
        await productDocumentPublication(payload, other, at)) ids.push(other.id)
  }
  if (!ids.includes(document.id)) throw new Error("Current accepted document is not in its reviewed bundle")
  return ids
}

export const productLegalHref = (documentType: string, locale: string, version: string) =>
  `${platformCmsOrigin()}/policies/${encodeURIComponent(locale)}/${encodeURIComponent(documentType)}/${encodeURIComponent(version)}`

export async function getPublishedProductLegalDocument(payload: Payload, documentType: string, locale: string, version: string, at = new Date()) {
  if (!["platform-terms", "platform-privacy"].includes(documentType) || !["nl", "en"].includes(locale) || !/^\d{4}-\d{2}-\d{2}\.\d+$/.test(version)) return null
  const result = await payload.find({ collection: "legal-documents", where: { and: [
    { documentType: { equals: documentType } }, { locale: { equals: locale } }, { documentVersion: { equals: version } },
  ] }, limit: 10, depth: 0, overrideAccess: true })
  for (const doc of result.docs) if (await productDocumentPublication(payload, doc, at)) return doc
  return null
}
