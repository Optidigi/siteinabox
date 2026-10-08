import { type GeneratedBlockSpec, type NormalizedIntake, type SiteGenerationSpec } from "@siteinabox/contracts"
import { sitegenNormalizationContextFromIntake } from "@/lib/sitegen/normalize"

export type MockGenerationFixture = "generic" | "invalid"

const action = (label: string, href: string) => ({ label, href })

type BlockMediaRef = Exclude<Extract<GeneratedBlockSpec, { blockType: "hero" }>["image"], null | undefined>
type IntakeMedia = Exclude<NonNullable<NonNullable<NormalizedIntake["brandSignals"]>["assets"]>[number], null>

const ownedMediaRef = (asset: IntakeMedia): BlockMediaRef | null => {
  if (typeof asset === "string" || typeof asset === "number") return asset
  const value: {
    id?: string | number
    url?: string
    filename?: string
    alt?: string | null
    width?: number | null
    height?: number | null
  } = {}
  if (typeof asset.id === "string" || typeof asset.id === "number") value.id = asset.id
  if (typeof asset.url === "string" && asset.url.trim()) value.url = asset.url.trim()
  if (typeof asset.filename === "string" && asset.filename.trim()) value.filename = asset.filename.trim()
  if (typeof asset.alt === "string" || asset.alt === null) value.alt = asset.alt
  if (typeof asset.width === "number" || asset.width === null) value.width = asset.width
  if (typeof asset.height === "number" || asset.height === null) value.height = asset.height
  return value.id !== undefined || value.url !== undefined || value.filename !== undefined ? value : null
}

const suppliedMedia = (normalized: NormalizedIntake): BlockMediaRef[] =>
  (normalized.brandSignals?.assets ?? [])
    .filter((asset): asset is IntakeMedia => asset !== null)
    .map(ownedMediaRef)
    .filter((asset): asset is BlockMediaRef => asset !== null)

const blocksFor = (normalized: NormalizedIntake): GeneratedBlockSpec[] => {
  const en = normalized.language === "en"
  const business = normalized.businessName
  const serviceNames = normalized.intakeBrief?.services.length
    ? normalized.intakeBrief.services.slice(0, 4)
    : en ? ["Advice", "Delivery"] : ["Advies", "Uitvoering"]
  const services = serviceNames.length >= 2 ? serviceNames : [...serviceNames, en ? "Follow-up" : "Nazorg"]
  const context = sitegenNormalizationContextFromIntake(normalized)
  const contactMethods = context.contactMethods ?? []
  if (contactMethods.length === 0) throw new Error("The mock Sitegen fixture requires at least one supplied contact method.")
  const suppliedImages = suppliedMedia(normalized)
  const firstImage = suppliedImages[0]
  return [
    {
      blockType: "hero",
      variant: "hero-01",
      heading: en ? `${business} helps you move forward` : `${business} helpt je verder`,
      body: normalized.intakeBrief?.intro ?? (en ? `Clear help for ${normalized.intakeBrief?.audience ?? "people with a concrete question"}.` : `Heldere hulp voor ${normalized.intakeBrief?.audience ?? "mensen met een concrete vraag"}.`),
      primaryAction: action(normalized.language === "en" ? "Get in touch" : "Neem contact op", contactMethods[0]?.href ?? `mailto:${normalized.contact?.email ?? ""}`),
      secondaryAction: action(en ? "View services" : "Bekijk diensten", "#services"),
      anchor: "hero",
    },
    {
      blockType: "services",
      variant: "services-01",
      heading: en ? "How can I help?" : "Waarmee kan ik helpen?",
      intro: en ? "An overview of the main services." : "Een overzicht van de belangrijkste diensten.",
      items: services.map((title) => ({ title, body: en ? `Practical support with ${title.toLowerCase()}.` : `Praktische ondersteuning rond ${title.toLowerCase()}.`, action: null })),
      anchor: "services",
    },
    {
      blockType: "cta",
      variant: "cta-01",
      heading: en ? "Shall we talk?" : "Even overleggen?",
      body: en ? "Tell us briefly what you need help with." : "Vertel kort waar je hulp bij zoekt.",
      primaryAction: action(normalized.language === "en" ? "Get in touch" : "Neem contact op", contactMethods[0]?.href ?? `mailto:${normalized.contact?.email ?? ""}`),
      secondaryAction: null,
      ...(firstImage ? { image: firstImage } : {}),
      anchor: "contact",
    },

  ]
}

const page = (slug: string, title: string, blocks: GeneratedBlockSpec[], normalized: NormalizedIntake) => ({
  slug,
  title,
  status: "draft" as const,
  seo: { title: `${title} | ${normalized.businessName}`, description: `Informatie over ${normalized.businessName}.`, ogImage: null },
  blocks,
})

export function loadMockSiteGenerationSpec(
  normalized: NormalizedIntake,
  fixture: MockGenerationFixture = "generic",
): SiteGenerationSpec {
  const blocks = blocksFor(normalized)
  return {
    schemaVersion: 1,
    intake: normalized,
    tenant: { name: normalized.businessName, slug: fixture === "invalid" ? "Invalid Slug" : normalized.tenantSlug, domain: normalized.primaryDomain, status: "provisioning" },
    theme: { version: 3, appearance: { mode: "system" }, colors: { schemeId: "monochrome" }, fonts: { schemeId: "clear-modern" }, shape: { schemeId: "soft" } },
    settings: {
      siteName: normalized.businessName,
      siteUrl: normalized.siteUrl,
      description: `Informatie over ${normalized.businessName}.`,
      language: normalized.language,
      chrome: {
        navbar: {
          variant: "navbar-01",
          placement: "hero-overlay",
          activeMode: "anchor",
          mobileMenu: "dropdown",
        },
        footer: {
          variant: "footer-01",
        },
      },
      contactEmail: normalized.contact?.email ?? null,
      contact: { phone: normalized.contact?.phone ?? null, address: null, social: [] },
      serviceArea: normalized.serviceArea.map((name) => ({ name })),
    },
    pages: [
      page("index", normalized.language === "en" ? "Overview" : "Overzicht", blocks, normalized),
    ],
    blocks: (["hero", "services", "cta"] as const).map((slug) => ({ slug, label: slug })),
    assets: suppliedMedia(normalized),
    generatedAt: new Date().toISOString(),
    generator: { name: "mock-site-generation", version: "sitegen-owned-v1", model: "fixture" },
  }
}
