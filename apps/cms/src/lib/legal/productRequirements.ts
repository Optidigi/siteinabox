import "server-only"
import type { Payload } from "payload"
import type { LegalDocument as DocumentRecord } from "@/payload-types"
import type { LegalDocument } from "@siteinabox/legal-content"
import { ensureLegalRequirementsForRelease, ensureConsentRenewalsForRelease } from "./legalDocuments"
import { productDocumentPublication } from "./productLegal"
import { asRecord } from "@/lib/record"

/** Reconcile after activation/restart; drafts/review-only records have no effects. */
export async function syncProductLegalRequirements(payload: Payload, now = new Date()) {
  let synchronized = 0
  for (let page = 1; ; page += 1) {
    const result = await payload.find({ collection: "legal-documents", where: { releaseKey: { contains: "product:" } }, page, limit: 100, depth: 0, overrideAccess: true })
    for (const document of result.docs) {
      const published = await productDocumentPublication(payload, document, now)
      if (!published) continue
      const values = published.metadata.audienceTenantIds
      if (!Array.isArray(values) || values.some(value => typeof value !== "number" || !Number.isSafeInteger(value) || value < 1)) throw new Error("Approved legal audience is unavailable")
      const audience = values as number[]
      const release = releaseFromRecord(document)
      await ensureLegalRequirementsForRelease(payload, document, release, audience)
      // Consent changes are scoped to the owner-approved audience, never every tenant.
      if (new Date(document.effectiveAt) <= now && document.consentAction !== "none") {
        await ensureConsentRenewalsForRelease(payload, release, now, audience)
      }
      synchronized += 1
    }
    if (!result.hasNextPage) break
  }
  return { synchronized }
}

function releaseFromRecord(document: DocumentRecord): LegalDocument {
  if (!["platform-terms", "platform-privacy"].includes(document.documentType) || !["nl", "en"].includes(document.locale)) throw new Error("Product legal type/locale is unavailable")
  return { documentType: document.documentType as LegalDocument["documentType"], locale: document.locale, title: document.documentType,
    slug: document.documentType, documentVersion: document.documentVersion, acceptanceVersion: document.acceptanceVersion ?? null,
    statementVersion: null, replaces: document.replaces ?? null, publishedAt: document.publishedAt, effectiveAt: document.effectiveAt,
    contentHash: document.contentHash as LegalDocument["contentHash"], markdown: document.content, html: "", stablePath: "", permanentPath: "",
    change: { category: document.changeCategory, summary: document.changeSummary, rationale: document.changeRationale,
      customerAction: document.customerAction, consentAction: document.consentAction ?? "none", audience: document.audience ?? "",
      noticeDays: document.noticeDays ?? undefined } }
}
