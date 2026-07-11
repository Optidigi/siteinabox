import { describe, expect, it } from "vitest"
import { GenerationInputSchema, PublicIntakeSubmissionSchema } from "@siteinabox/contracts/generation"
import { CURRENT_INTAKE_TERMS_ACCEPTANCE } from "@siteinabox/contracts"
import { buildGenerationInput, normalizeIntakeSubmission } from "@/lib/intake/normalizeIntake"

const themeTokens = {
  background: "#ffffff",
  foreground: "#111111",
  card: "#ffffff",
  cardForeground: "#111111",
  primary: "#146c43",
  primaryForeground: "#ffffff",
  secondary: "#e7f3ed",
  secondaryForeground: "#111111",
  muted: "#f3f4f6",
  mutedForeground: "#4b5563",
  accent: "#d1fae5",
  accentForeground: "#111111",
  border: "#d1d5db",
  input: "#d1d5db",
  ring: "#146c43",
  destructive: "#dc2626",
  destructiveForeground: "#ffffff",
}

const richIntake = () => ({
  submittedAt: "2026-06-29T10:00:00.000Z",
  source: "public-intake",
  company: {
    source: "kvk",
    companyName: "Demo Studio",
    kvkNumber: "12345678",
    address: "Stationsplein 1, Roermond",
    website: "https://demo-studio.nl",
    mainActivity: "Interieuradvies",
    secondaryActivities: ["Projectbegeleiding"],
  },
  content: {
    intro: "Wij helpen ondernemers met praktische interieurplannen.",
    offers: [{ value: "Interieuradvies" }, { value: "Projectinrichting" }],
    audience: "Lokale ondernemers",
    situation: "Klanten willen hun ruimte professioneler maken.",
    approach: "We starten met een intake en concreet plan.",
    workModes: ["on_location", "fixed_region"],
    region: "Limburg",
    notes: "Leg nadruk op persoonlijke begeleiding.",
  },
  contact: {
    selectedActions: ["message", "quote"],
    formType: "multiple",
    formOptions: ["message", "quote"],
    primaryAction: "quote",
    phoneNumber: "0612345678",
    whatsappMode: "same",
    whatsappNumber: "",
    locationOptions: ["region"],
    publicRegion: "Limburg",
    publicAddress: "",
    availabilityMode: "appointment_only",
    openingHours: "",
  },
  visual: {
    logo: { mode: "textlogo", file: null, text: "Demo Studio" },
    color: {
      sourceType: "preset",
      sourceValue: "green",
      selectedPalette: "palette_1",
      tokens: themeTokens,
    },
    shape: "slightly_rounded",
    typography: "clear",
  },
  finalDetails: {
    name: "Demo Contact",
    email: "demo@example.com",
    phone: "0612345678",
  },
  legal: {
    businessUseDeclaration: {
      accepted: true,
      statementVersion: "business-use-2026-07-07.1",
      recordedAt: "2026-06-29T10:00:00.000Z",
    },
    termsAcceptance: {
      accepted: true,
      ...CURRENT_INTAKE_TERMS_ACCEPTANCE,
      recordedAt: "2026-06-29T10:00:00.000Z",
    },
    marketingConsent: {
      granted: false,
      statementVersion: "marketing-opt-in-2026-07-07.1",
      recordedAt: "2026-06-29T10:00:00.000Z",
    },
    privacyNotice: {
      documentVersion: "2026-07-07.1",
      url: "https://www.siteinabox.nl/privacy-en-cookieverklaring",
    },
  },
  domain: "demo-studio.nl",
  email: "info@demo-studio.nl",
  addOns: ["email"],
  notes: null,
})

describe("normalizeIntakeSubmission", () => {
  it("maps rich raw wizard state into company facts and an intake brief", () => {
    const raw = PublicIntakeSubmissionSchema.parse(richIntake())
    const normalized = normalizeIntakeSubmission(raw)

    expect(normalized.businessName).toBe("Demo Studio")
    expect(normalized.primaryDomain).toBe("demo-studio.nl")
    expect(normalized.contact).toMatchObject({
      name: "Demo Contact",
      email: "demo@example.com",
      phone: "0612345678",
    })
    expect(normalized.companyFacts).toMatchObject({
      source: "kvk",
      companyName: "Demo Studio",
      kvkNumber: "12345678",
      mainActivity: "Interieuradvies",
      secondaryActivities: ["Projectbegeleiding"],
    })
    expect(normalized.intakeBrief).toMatchObject({
      services: ["Interieuradvies", "Projectinrichting"],
      audience: "Lokale ondernemers",
      workModes: ["on_location", "fixed_region"],
      serviceArea: ["Limburg"],
      callsToAction: ["quote", "message"],
      addOnInterest: ["email"],
    })
    expect(normalized.intakeBrief?.contactPreferences).toMatchObject({
      selectedActions: ["message", "quote"],
      primaryAction: "quote",
      formType: "multiple",
      phoneNumber: "0612345678",
      availabilityMode: "appointment_only",
    })
    expect(normalized.intakeBrief?.visualPreferences).toMatchObject({
      colorSourceType: "preset",
      colorSourceValue: "green",
      selectedPalette: "palette_1",
      colorSchemeId: "emerald-calm",
      fontSchemeId: "clear-modern",
      shapeSchemeId: "soft",
      densitySchemeId: "comfortable",
    })
    expect(JSON.stringify(normalized.intakeBrief?.visualPreferences)).not.toContain("primary")
    expect(normalized.raw).toBeNull()
  })

  it("maps intake visual choices to finite theme preset hints", () => {
    const raw = richIntake()
    raw.visual.color.sourceValue = "#dc2626"
    raw.visual.shape = "rounded"
    raw.visual.typography = "classic"
    const normalized = normalizeIntakeSubmission(PublicIntakeSubmissionSchema.parse(raw))

    expect(normalized.intakeBrief?.visualPreferences).toMatchObject({
      colorSchemeId: "red-confident",
      fontSchemeId: "classic-editorial",
      shapeSchemeId: "rounded",
      densitySchemeId: "comfortable",
    })
  })

  it("does not treat factual company website or contact email as add-on interest", () => {
    const raw = richIntake()
    delete (raw as { domain?: string | null }).domain
    delete (raw as { email?: string | null }).email
    const normalized = normalizeIntakeSubmission(PublicIntakeSubmissionSchema.parse(raw))

    expect(normalized.primaryDomain).toBe("demo-studio.siteinabox.test")
    expect(normalized.companyFacts?.website).toBe("https://demo-studio.nl")
    expect(normalized.intakeBrief?.domainInterest).toBeUndefined()
    expect(normalized.intakeBrief?.emailInterest).toBeUndefined()
    expect(normalized.contact?.email).toBe("demo@example.com")
  })

  it("builds a schema-valid generation input from normalized intake", () => {
    const normalized = normalizeIntakeSubmission(PublicIntakeSubmissionSchema.parse(richIntake()))
    const input = buildGenerationInput(normalized)

    expect(GenerationInputSchema.safeParse(input).success).toBe(true)
    expect(input.status).toBe("ai-prepared")
    expect(input.companyFacts.companyName).toBe("Demo Studio")
    expect(input.brief.services).toEqual(["Interieuradvies", "Projectinrichting"])
    expect((input.brief.visualPreferences as any).tokens).toBeUndefined()
  })
})
