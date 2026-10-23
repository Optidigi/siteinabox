import "server-only"
import type { Payload } from "payload"
import { getCurrentLegalDocument } from "@siteinabox/legal-content"
import { getCurrentLegalDocumentRecord, NoEffectiveLegalDocumentError } from "./legalDocuments"
import { isProductLegalKey, legalAcceptanceStatement, productLegalHref } from "./productLegal"
import { legalStatements } from "./statements"

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
