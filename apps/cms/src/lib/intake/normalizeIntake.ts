import { createHash } from "node:crypto"
import {
  GenerationInputSchema,
  IntakeSubmissionSchema,
  PublicIntakeSubmissionSchema,
  RawIntakeSubmissionSchema,
  NormalizedIntakeSchema,
  type CompanyFacts,
  type GenerationInput,
  type IntakeSubmission,
  type IntakeBrief,
  type NormalizedIntake,
  type PublicIntakeSubmission,
  type RawIntakeSubmission,
} from "@siteinabox/contracts/generation"
import { slugify } from "@/lib/slugify"

const DOMAIN_REGEX =
  /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/

const sortValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortValue)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, sortValue(entry)]),
  )
}

const cleanText = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const cleaned = value.replace(/\s+/g, " ").trim()
  return cleaned || null
}

const cleanStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value.map(cleanText).filter((entry): entry is string => Boolean(entry))
}

const compactUnique = <T extends string>(values: Array<T | null | undefined>): T[] =>
  Array.from(new Set(values.filter((entry): entry is T => Boolean(entry))))

const normalizeDomain = (domain: unknown, fallbackSlug: string): string => {
  const cleaned = cleanText(domain)?.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "") ?? ""
  if (cleaned && DOMAIN_REGEX.test(cleaned) && /[a-z]/.test(cleaned.split(".").pop() ?? "")) {
    return cleaned
  }
  return `${fallbackSlug}.siteinabox.test`
}

const normalizePages = (pages: IntakeSubmission["pages"]): NormalizedIntake["requestedPages"] => {
  if (!Array.isArray(pages) || pages.length === 0) {
    return [{ slug: "index", title: "Home", purpose: "Homepage" }]
  }

  const seen = new Set<string>()
  return pages.flatMap((page, index) => {
    const title = cleanText(page?.title) ?? (index === 0 ? "Home" : `Page ${index + 1}`)
    const requestedSlug = cleanText(page?.slug) ?? title
    const normalizedSlug = slugify(requestedSlug)
    const slug = index === 0 && (normalizedSlug === "" || normalizedSlug === "home")
      ? "index"
      : normalizedSlug || `page-${index + 1}`
    if (seen.has(slug)) return []
    seen.add(slug)
    return [{
      slug,
      title,
      ...(cleanText(page?.purpose) ? { purpose: cleanText(page?.purpose) } : {}),
    }]
  })
}

export const hashStableValue = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(sortValue(value))).digest("hex")

const isRichRawIntake = (raw: PublicIntakeSubmission): raw is RawIntakeSubmission =>
  RawIntakeSubmissionSchema.safeParse(raw).success

const buildCompanyFactsFromThin = (raw: IntakeSubmission, businessName: string): CompanyFacts => ({
  source: null,
  companyName: businessName,
  secondaryActivities: [],
  ...(cleanText(raw.domain) ? { website: cleanText(raw.domain) } : {}),
  ...(cleanText(raw.industry) ? { mainActivity: cleanText(raw.industry) } : {}),
})

const buildIntakeBriefFromThin = (raw: IntakeSubmission): IntakeBrief => ({
  services: cleanStringArray(raw.goals),
  serviceArea: cleanStringArray(raw.serviceArea),
  workModes: [],
  proofTrust: [],
  contactPreferences: {
    selectedActions: [],
    formOptions: [],
    locationOptions: [],
    ...(cleanText(raw.contactPhone) ? { phoneNumber: cleanText(raw.contactPhone) } : {}),
  },
  callsToAction: [],
  visualPreferences: {
    ...(raw.brand?.colors?.[0] ? { colorSourceType: "custom", colorSourceValue: cleanText(raw.brand.colors[0]) } : {}),
  },
  tone: cleanStringArray(raw.brand?.tone),
  addOnInterest: [],
  ...(cleanText(raw.notes) ? { notes: cleanText(raw.notes) } : {}),
  ...(cleanText(raw.domain) ? { domainInterest: cleanText(raw.domain) } : {}),
  ...(cleanText(raw.contactEmail) ? { emailInterest: cleanText(raw.contactEmail) } : {}),
})

const buildCompanyFactsFromRich = (raw: RawIntakeSubmission): CompanyFacts => ({
  source: raw.company.source,
  companyName: cleanText(raw.company.companyName) ?? "Invalid intake",
  secondaryActivities: cleanStringArray(raw.company.secondaryActivities),
  ...(cleanText(raw.company.kvkNumber) ? { kvkNumber: cleanText(raw.company.kvkNumber) } : {}),
  ...(cleanText(raw.company.address) ? { address: cleanText(raw.company.address) } : {}),
  ...(cleanText(raw.company.website) ? { website: cleanText(raw.company.website) } : {}),
  ...(cleanText(raw.company.mainActivity) ? { mainActivity: cleanText(raw.company.mainActivity) } : {}),
})

const buildIntakeBriefFromRich = (raw: RawIntakeSubmission): IntakeBrief => {
  const selectedActions = compactUnique(raw.contact.selectedActions)
  const primaryAction = raw.contact.primaryAction === "" ? null : raw.contact.primaryAction
  const callsToAction = compactUnique([primaryAction, ...selectedActions])
  return {
    services: raw.content.offers.map((offer) => cleanText(offer.value)).filter((entry): entry is string => Boolean(entry)),
    workModes: raw.content.workModes,
    serviceArea: compactUnique([cleanText(raw.content.region), cleanText(raw.contact.publicRegion)]),
    proofTrust: [],
    contactPreferences: {
      selectedActions,
      formOptions: raw.contact.formOptions,
      locationOptions: raw.contact.locationOptions,
      ...(primaryAction ? { primaryAction } : {}),
      ...(raw.contact.formType ? { formType: raw.contact.formType } : {}),
      ...(cleanText(raw.contact.phoneNumber) ? { phoneNumber: cleanText(raw.contact.phoneNumber) } : {}),
      ...(cleanText(raw.contact.whatsappNumber) ? { whatsappNumber: cleanText(raw.contact.whatsappNumber) } : {}),
      ...(cleanText(raw.contact.publicRegion) ? { publicRegion: cleanText(raw.contact.publicRegion) } : {}),
      ...(cleanText(raw.contact.publicAddress) ? { publicAddress: cleanText(raw.contact.publicAddress) } : {}),
      ...(raw.contact.availabilityMode ? { availabilityMode: raw.contact.availabilityMode } : {}),
      ...(cleanText(raw.contact.openingHours) ? { openingHours: cleanText(raw.contact.openingHours) } : {}),
    },
    callsToAction,
    visualPreferences: {
      ...(raw.visual.logo.mode ? { logoMode: raw.visual.logo.mode } : {}),
      ...(cleanText(raw.visual.logo.text) ? { logoText: cleanText(raw.visual.logo.text) } : {}),
      ...(raw.visual.color.sourceType ? { colorSourceType: raw.visual.color.sourceType } : {}),
      ...(cleanText(raw.visual.color.sourceValue) ? { colorSourceValue: cleanText(raw.visual.color.sourceValue) } : {}),
      ...(raw.visual.color.selectedPalette ? { selectedPalette: raw.visual.color.selectedPalette } : {}),
      ...(raw.visual.shape ? { shape: raw.visual.shape } : {}),
      ...(raw.visual.typography ? { typography: raw.visual.typography } : {}),
    },
    tone: compactUnique([raw.visual.typography ? `typography:${raw.visual.typography}` : null]),
    addOnInterest: cleanStringArray(raw.addOns),
    ...(cleanText(raw.content.intro) ? { intro: cleanText(raw.content.intro) } : {}),
    ...(cleanText(raw.content.audience) ? { audience: cleanText(raw.content.audience) } : {}),
    ...(cleanText(raw.content.situation) ? { customerSituation: cleanText(raw.content.situation) } : {}),
    ...(cleanText(raw.content.approach) ? { approach: cleanText(raw.content.approach) } : {}),
    ...(cleanText(raw.content.notes) || cleanText(raw.notes)
      ? { notes: [cleanText(raw.content.notes), cleanText(raw.notes)].filter(Boolean).join("\n") }
      : {}),
    ...(cleanText(raw.domain) ? { domainInterest: cleanText(raw.domain) } : {}),
    ...(cleanText(raw.email) ? { emailInterest: cleanText(raw.email) } : {}),
  }
}

export const buildGenerationInput = (
  normalizedIntake: NormalizedIntake,
  status: GenerationInput["status"] = "ai-prepared",
): GenerationInput => {
  const companyFacts = normalizedIntake.companyFacts ?? {
    source: null,
    companyName: normalizedIntake.businessName,
    secondaryActivities: [],
  }
  const brief = normalizedIntake.intakeBrief ?? {
    services: normalizedIntake.goals,
    serviceArea: normalizedIntake.serviceArea,
    workModes: [],
    proofTrust: [],
    contactPreferences: {
      selectedActions: [],
      formOptions: [],
      locationOptions: [],
      ...(normalizedIntake.contact?.phone ? { phoneNumber: normalizedIntake.contact.phone } : {}),
    },
    callsToAction: [],
    visualPreferences: {},
    tone: normalizedIntake.brandSignals?.tone ?? [],
    addOnInterest: [],
    ...(normalizedIntake.primaryDomain ? { domainInterest: normalizedIntake.primaryDomain } : {}),
    ...(normalizedIntake.contact?.email ? { emailInterest: normalizedIntake.contact.email } : {}),
  }

  return GenerationInputSchema.parse({
    schemaVersion: 1,
    status,
    companyFacts,
    brief,
    normalizedIntake,
  })
}

export const normalizeIntakeSubmission = (raw: PublicIntakeSubmission): NormalizedIntake => {
  const parsedPublicRaw = PublicIntakeSubmissionSchema.parse(raw)
  const richRaw = isRichRawIntake(parsedPublicRaw) ? parsedPublicRaw : null
  const thinRaw = richRaw ? null : IntakeSubmissionSchema.parse(parsedPublicRaw)
  const legacyRaw = thinRaw ?? ({} as IntakeSubmission)
  const businessNameCandidate = richRaw ? richRaw.company.companyName : legacyRaw.businessName
  const businessName = cleanText(businessNameCandidate)
  if (!businessName) {
    throw new Error("businessName is required")
  }

  const tenantSlug = slugify(businessName)
  if (!tenantSlug) {
    throw new Error("businessName must contain at least one letter or digit")
  }

  const primaryDomain = normalizeDomain(richRaw ? richRaw.domain : legacyRaw.domain, tenantSlug)
  const contact = {
    ...(cleanText(richRaw ? richRaw.finalDetails.name : legacyRaw.contactName)
      ? { name: cleanText(richRaw ? richRaw.finalDetails.name : legacyRaw.contactName) }
      : {}),
    ...(cleanText(richRaw ? richRaw.finalDetails.email : legacyRaw.contactEmail)
      ? { email: cleanText(richRaw ? richRaw.finalDetails.email : legacyRaw.contactEmail) }
      : {}),
    ...(cleanText(richRaw ? richRaw.finalDetails.phone || richRaw.contact.phoneNumber : legacyRaw.contactPhone)
      ? { phone: cleanText(richRaw ? richRaw.finalDetails.phone || richRaw.contact.phoneNumber : legacyRaw.contactPhone) }
      : {}),
  }
  const companyFacts = richRaw ? buildCompanyFactsFromRich(richRaw) : buildCompanyFactsFromThin(legacyRaw, businessName)
  const intakeBrief = richRaw ? buildIntakeBriefFromRich(richRaw) : buildIntakeBriefFromThin(legacyRaw)

  return NormalizedIntakeSchema.parse({
    businessName,
    tenantSlug,
    primaryDomain,
    siteUrl: `https://${primaryDomain}`,
    language: richRaw ? "nl" : cleanText(legacyRaw.language) ?? "nl",
    ...(Object.keys(contact).length > 0 ? { contact } : {}),
    ...(cleanText(richRaw ? richRaw.company.mainActivity : legacyRaw.industry)
      ? { industry: cleanText(richRaw ? richRaw.company.mainActivity : legacyRaw.industry) }
      : {}),
    serviceArea: richRaw ? intakeBrief.serviceArea : cleanStringArray(legacyRaw.serviceArea),
    goals: richRaw ? intakeBrief.services : cleanStringArray(legacyRaw.goals),
    requestedPages: richRaw ? [{ slug: "index", title: "Home", purpose: "Homepage" }] : normalizePages(legacyRaw.pages),
    ...(!richRaw && legacyRaw.brand
      ? {
          brandSignals: {
            colors: cleanStringArray(legacyRaw.brand.colors),
            fonts: cleanStringArray(legacyRaw.brand.fonts),
            tone: cleanStringArray(legacyRaw.brand.tone),
            ...(Array.isArray(legacyRaw.brand.assets) ? { assets: legacyRaw.brand.assets } : {}),
          },
        }
      : {}),
    companyFacts,
    intakeBrief,
    raw: richRaw ? richRaw as Record<string, unknown> : legacyRaw.content && typeof legacyRaw.content === "object" ? legacyRaw.content : null,
  })
}
