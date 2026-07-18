import "server-only"

import type { Payload } from "payload"
import {
  createPublicLegalManifest,
  getLegalReleases,
  type LegalDocument,
  type LegalDocumentType,
  type PublicLegalManifest,
} from "@siteinabox/legal-content"
import { relationshipId } from "@/lib/relationshipId"

type PayloadRecord = Record<string, any>

const releaseKey = (release: Pick<LegalDocument, "documentType" | "locale" | "documentVersion">) =>
  `${release.documentType}:${release.locale}:${release.documentVersion}`

const eventKey = (release: LegalDocument, eventType: string) =>
  `${releaseKey(release)}:${eventType}`

const findOne = async (
  payload: Payload,
  collection: string,
  where: Record<string, unknown>,
): Promise<PayloadRecord | null> => {
  const result = await payload.find({
    collection: collection as any,
    where: where as any,
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return (result.docs[0] as PayloadRecord | undefined) ?? null
}

const ensurePublicationEvent = async (
  payload: Payload,
  document: PayloadRecord,
  release: LegalDocument,
  eventType: "registered" | "scheduled" | "activated",
  occurredAt: string,
) => {
  const key = eventKey(release, eventType)
  const existing = await findOne(payload, "legal-publication-events", { eventKey: { equals: key } })
  if (existing) return existing
  return payload.create({
    collection: "legal-publication-events" as any,
    data: {
      eventKey: key,
      document: document.id,
      eventType,
      occurredAt,
      metadata: {
        documentVersion: release.documentVersion,
        acceptanceVersion: release.acceptanceVersion,
        contentHash: release.contentHash,
      },
    },
    depth: 0,
    overrideAccess: true,
  } as any)
}

export async function ensureLegalRequirementsForRelease(
  payload: Payload,
  document: PayloadRecord,
  release: LegalDocument,
) {
  if (release.change.customerAction === "none" || release.change.customerAction === "publish_notice") return []
  const ownerDocs: PayloadRecord[] = []
  for (let page = 1; ; page += 1) {
    const users = await payload.find({
      collection: "users",
      where: { role: { equals: "owner" } },
      page,
      limit: 100,
      depth: 1,
      overrideAccess: true,
    })
    ownerDocs.push(...users.docs as PayloadRecord[])
    if (!users.hasNextPage && users.docs.length < 100) break
  }
  const requirements: PayloadRecord[] = []
  for (const user of ownerDocs) {
    if (typeof user.email !== "string") continue
    for (const membership of user.tenants ?? []) {
      const tenantId = relationshipId(membership?.tenant)
      if (!tenantId) continue
      const key = `${releaseKey(release)}:user:${user.id}:tenant:${tenantId}:${release.change.customerAction}`
      let requirement = await findOne(payload, "legal-requirements", { requirementKey: { equals: key } })
      if (!requirement) {
        requirement = await payload.create({
          collection: "legal-requirements" as any,
          data: {
            requirementKey: key,
            tenant: tenantId,
            subjectEmail: user.email,
            document: document.id,
            action: release.change.customerAction,
            status: "pending",
            enforceAt: ["mandatory_reaccept", "reaccept_on_next_transaction"].includes(release.change.customerAction)
              ? release.effectiveAt
              : undefined,
            objectionDeadlineAt: release.change.customerAction === "notice_and_continued_use"
              ? release.effectiveAt
              : undefined,
          },
          depth: 0,
          overrideAccess: true,
        } as any) as PayloadRecord
      }
      requirements.push(requirement)
    }
  }
  return requirements
}

export const analyticsConsentVersionForRelease = (
  release: Pick<LegalDocument, "documentType" | "locale" | "documentVersion">,
) => `legal:${release.documentType}:${release.locale}:${release.documentVersion}`

export async function ensureConsentRenewalsForRelease(
  payload: Payload,
  release: LegalDocument,
  at = new Date(),
) {
  if (!["renew_analytics", "renew_all_optional"].includes(release.change.consentAction)) return []
  if (release.change.audience === "siteinabox_visitors") return []
  if (new Date(release.effectiveAt) > at) return []

  const consentVersion = analyticsConsentVersionForRelease(release)
  const renewed: PayloadRecord[] = []
  for (let page = 1; ; page += 1) {
    const tenants = await payload.find({
      collection: "tenants",
      page,
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })
    for (const tenant of tenants.docs as PayloadRecord[]) {
      const manifest = tenant.siteManifest
      const consent = manifest?.analyticsConsent
      if (!manifest || typeof manifest !== "object" || !consent || typeof consent !== "object" || consent.enabled === false) continue
      if (consent.consentVersion === consentVersion) continue
      renewed.push(await payload.update({
        collection: "tenants",
        id: tenant.id,
        data: {
          siteManifest: {
            ...manifest,
            analyticsConsent: { ...consent, consentVersion },
          },
        },
        depth: 0,
        overrideAccess: true,
      } as any) as PayloadRecord)
    }
    if (!tenants.hasNextPage && tenants.docs.length < 100) break
  }
  return renewed
}

export const verifyPublicLegalManifest = async (input: {
  manifestUrl: string
  expected?: PublicLegalManifest
  fetchImpl?: typeof fetch
}) => {
  const response = await (input.fetchImpl ?? fetch)(input.manifestUrl, {
    headers: { accept: "application/json" },
    cache: "no-store",
  })
  if (!response.ok) throw new Error(`Public legal manifest returned ${response.status}.`)
  const actual = await response.json() as PublicLegalManifest
  const expected = input.expected ?? createPublicLegalManifest()

  for (const release of expected.documents) {
    const publicRelease = actual.documents?.find((candidate) =>
      candidate.documentType === release.documentType &&
      candidate.locale === release.locale &&
      candidate.documentVersion === release.documentVersion,
    )
    if (!publicRelease) {
      throw new Error(`Public legal manifest is missing ${release.documentType}/${release.locale}/${release.documentVersion}.`)
    }
    if (publicRelease.contentHash !== release.contentHash) {
      throw new Error(`Public legal hash mismatch for ${release.documentType}/${release.locale}/${release.documentVersion}.`)
    }
  }
  return actual
}

export async function syncLegalDocuments(input: {
  payload: Payload
  now?: Date
  sourceCommit?: string
  manifestUrl?: string | null
  fetchImpl?: typeof fetch
}) {
  const now = input.now ?? new Date()
  const nowIso = now.toISOString()
  const releases = getLegalReleases()
  if (input.manifestUrl) {
    await verifyPublicLegalManifest({
      manifestUrl: input.manifestUrl,
      expected: createPublicLegalManifest(now),
      fetchImpl: input.fetchImpl,
    })
  }

  const documents: PayloadRecord[] = []
  for (const release of releases) {
    const key = releaseKey(release)
    let document = await findOne(input.payload, "legal-documents", { releaseKey: { equals: key } })
    if (document) {
      if (document.contentHash !== release.contentHash || document.content !== release.markdown) {
        throw new Error(`Immutable legal release mismatch for ${key}. Publish a corrective version instead.`)
      }
    } else {
      document = await input.payload.create({
        collection: "legal-documents" as any,
        data: {
          releaseKey: key,
          documentType: release.documentType,
          locale: release.locale,
          documentVersion: release.documentVersion,
          acceptanceVersion: release.acceptanceVersion ?? undefined,
          replaces: release.replaces ?? undefined,
          content: release.markdown,
          contentHash: release.contentHash,
          sourceCommit: input.sourceCommit ?? process.env.SIAB_GIT_SHA ?? "development",
          publishedAt: release.publishedAt,
          effectiveAt: release.effectiveAt,
          changeCategory: release.change.category,
          changeSummary: release.change.summary,
          changeRationale: release.change.rationale,
          customerAction: release.change.customerAction,
          consentAction: release.change.consentAction,
          audience: release.change.audience,
          noticeDays: release.change.noticeDays,
        },
        depth: 0,
        overrideAccess: true,
      } as any) as PayloadRecord
    }

    await ensurePublicationEvent(input.payload, document, release, "registered", nowIso)
    if (new Date(release.effectiveAt) <= now) {
      await ensurePublicationEvent(input.payload, document, release, "activated", release.effectiveAt)
      await ensureConsentRenewalsForRelease(input.payload, release, now)
    } else {
      await ensurePublicationEvent(input.payload, document, release, "scheduled", nowIso)
    }
    await ensureLegalRequirementsForRelease(input.payload, document, release)
    documents.push(document)
  }

  return { documents, synchronized: documents.length }
}

export async function getCurrentLegalDocumentRecord(
  payload: Payload,
  documentType: LegalDocumentType,
  locale = "nl",
  at = new Date(),
): Promise<PayloadRecord> {
  const result = await payload.find({
    collection: "legal-documents" as any,
    where: {
      and: [
        { documentType: { equals: documentType } },
        { locale: { equals: locale } },
        { publishedAt: { less_than_equal: at.toISOString() } },
        { effectiveAt: { less_than_equal: at.toISOString() } },
      ],
    },
    sort: "-effectiveAt",
    limit: 1,
    depth: 0,
    overrideAccess: true,
  } as any)
  const document = result.docs[0] as PayloadRecord | undefined
  if (!document) throw new Error(`No effective ${documentType}/${locale} legal document is registered.`)
  return document
}
