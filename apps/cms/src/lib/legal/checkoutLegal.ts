import "server-only"
import type { Payload } from "payload"
import { getCurrentLegalDocument } from "@siteinabox/legal-content"
import { getCurrentLegalDocumentRecord, NoEffectiveLegalDocumentError } from "./legalDocuments"
import { isProductLegalKey, legalAcceptanceStatement, productLegalHref } from "./productLegal"
import { legalStatements } from "./statements"

export class CheckoutLegalConflictError extends Error {}

export type CheckoutLegalIdentity = {
  locale: "nl" | "en"
  terms: { id: number | null; version: string; contentHash: string; acceptanceVersion: string | null }
  privacy: { id: number | null; version: string; contentHash: string }
  statement: { version: string; text: string }
}

/** Copy scalar authority before any intervening checkout/provider work. */
export function checkoutLegalIdentity(selection: Pick<NonNullable<Awaited<ReturnType<typeof checkoutLegalDocuments>>>, "locale" | "terms" | "privacy" | "statement">): CheckoutLegalIdentity {
  return { locale: selection.locale,
    terms: { id: "id" in selection.terms ? selection.terms.id : null, version: selection.terms.documentVersion,
      contentHash: selection.terms.contentHash, acceptanceVersion: selection.terms.acceptanceVersion ?? null },
    privacy: { id: "id" in selection.privacy ? selection.privacy.id : null, version: selection.privacy.documentVersion, contentHash: selection.privacy.contentHash },
    statement: { version: selection.statement.version, text: selection.statement.text } }
}

export async function checkoutLegalDocuments(payload: Payload, locale: "nl" | "en", now = new Date()) {
  try {
    const [terms, privacy] = await Promise.all([getCurrentLegalDocumentRecord(payload, "platform-terms", locale, now),
      getCurrentLegalDocumentRecord(payload, "platform-privacy", locale, now)])
    const product = isProductLegalKey(terms.releaseKey)
    if (product !== isProductLegalKey(privacy.releaseKey) || product && terms.releaseKey.split(":")[1] !== privacy.releaseKey.split(":")[1]) throw new Error("Current legal bundle is inconsistent")
    return { locale, terms, privacy, product, statement: await legalAcceptanceStatement(payload, terms, now),
      termsHref: product ? productLegalHref(terms.documentType, locale, terms.documentVersion) : `https://www.siteinabox.nl/juridisch/algemene-voorwaarden/${terms.documentVersion}`,
      privacyHref: product ? productLegalHref(privacy.documentType, locale, privacy.documentVersion) : `https://www.siteinabox.nl/juridisch/privacy-en-cookieverklaring/${privacy.documentVersion}` }
  } catch (error) {
    if (!(error instanceof NoEffectiveLegalDocumentError)) throw error
    if (locale !== "nl") return null
    // Existing Dutch source publications remain the display authority before
    // DB registration. Acceptance still requires the real registered records.
    const terms = getCurrentLegalDocument("platform-terms", "nl", now), privacy = getCurrentLegalDocument("platform-privacy", "nl", now)
    return { locale, terms, privacy, product: false, statement: legalStatements.termsAcceptance,
      termsHref: `https://www.siteinabox.nl${terms.permanentPath}`, privacyHref: `https://www.siteinabox.nl${privacy.permanentPath}` }
  }
}
