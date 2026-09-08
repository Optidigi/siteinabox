import { CURRENT_INTAKE_TERMS_ACCEPTANCE } from "@siteinabox/contracts"
import { RawIntakeSubmissionSchema, type RawIntakeSubmission } from "@siteinabox/contracts/generation"
import type { BuilderFacts } from "./facts"
import { BUILDER_DEFAULT_VISUAL_TOKENS } from "./visualDefaults"

export type BuilderLegalAcceptance = {
  businessUseAccepted: boolean
  termsAccepted: boolean
  marketingOptIn: boolean
}

export type BuilderContact = {
  name: string
  email: string
  phone: string
}

export const BUILDER_LEGAL_STATEMENT_VERSIONS = {
  businessUse: "business-use-2026-07-07.1",
  marketing: "marketing-opt-in-2026-07-07.1",
  privacyNotice: {
    documentVersion: "2026-07-07.1",
    url: "https://www.siteinabox.nl/privacy-en-cookieverklaring",
  },
} as const

export const buildRawIntakeFromBuilderFacts = (input: {
  facts: BuilderFacts
  contact: BuilderContact
  legal: BuilderLegalAcceptance
  recordedAt?: string
}): RawIntakeSubmission => {
  if (!input.legal.businessUseAccepted) {
    throw new Error("De zakelijke verklaring is verplicht.")
  }
  if (!input.legal.termsAccepted) {
    throw new Error("Acceptatie van de algemene voorwaarden is verplicht.")
  }
  const recordedAt = input.recordedAt ?? new Date().toISOString()
  const primaryAction = input.facts.selectedActions[0] ?? "message"
  const formOptions = input.facts.formType === "none"
    ? []
    : input.facts.formType === "multiple"
      ? (["message", "quote"] as const)
      : input.facts.formType === "quote" || input.facts.formType === "appointment" || input.facts.formType === "message"
        ? [input.facts.formType]
        : (["message"] as const)

  return RawIntakeSubmissionSchema.parse({
    submittedAt: recordedAt,
    source: "builder",
    company: {
      source: "manual",
      companyName: input.facts.businessName,
      kvkNumber: "",
      address: "",
      website: "",
      mainActivity: input.facts.offers[0]?.value ?? input.facts.businessName,
      secondaryActivities: input.facts.offers.slice(1).map((offer) => offer.value),
    },
    content: {
      intro: input.facts.intro,
      offers: input.facts.offers,
      audience: input.facts.audience,
      situation: input.facts.situation,
      approach: input.facts.approach,
      workModes: ["on_location"],
      region: input.facts.region,
      notes: input.facts.notes,
    },
    contact: {
      selectedActions: input.facts.selectedActions,
      formType: input.facts.formType,
      formOptions,
      primaryAction,
      phoneNumber: input.contact.phone,
      whatsappMode: input.facts.selectedActions.includes("whatsapp") ? "same" : "none",
      whatsappNumber: "",
      locationOptions: ["region"],
      publicRegion: input.facts.region,
      publicAddress: "",
      availabilityMode: input.facts.formType === "appointment" ? "appointment_only" : "none",
      openingHours: "",
    },
    visual: {
      logo: {
        mode: "textlogo",
        file: null,
        text: input.facts.businessName,
      },
      color: {
        sourceType: "preset",
        sourceValue: `${input.facts.colorSchemeId}${input.facts.appearanceMode === "dark" ? " dark" : ""}`,
        selectedPalette: "palette_1",
        tokens: BUILDER_DEFAULT_VISUAL_TOKENS,
      },
      shape: input.facts.shapeSchemeId === "sharp"
        ? "straight"
        : input.facts.shapeSchemeId === "rounded"
          ? "rounded"
          : "slightly_rounded",
      typography: input.facts.fontSchemeId === "classic-editorial"
        ? "classic"
        : input.facts.fontSchemeId === "friendly-organic"
          ? "soft"
          : "clear",
    },
    finalDetails: {
      name: input.contact.name,
      email: input.contact.email,
      phone: input.contact.phone,
    },
    legal: {
      businessUseDeclaration: {
        accepted: true,
        statementVersion: BUILDER_LEGAL_STATEMENT_VERSIONS.businessUse,
        recordedAt,
      },
      termsAcceptance: {
        accepted: true,
        ...CURRENT_INTAKE_TERMS_ACCEPTANCE,
        recordedAt,
      },
      marketingConsent: {
        granted: input.legal.marketingOptIn,
        statementVersion: BUILDER_LEGAL_STATEMENT_VERSIONS.marketing,
        recordedAt,
      },
      privacyNotice: BUILDER_LEGAL_STATEMENT_VERSIONS.privacyNotice,
    },
    domain: null,
    email: null,
    addOns: [],
    notes: input.facts.notes || null,
  })
}
