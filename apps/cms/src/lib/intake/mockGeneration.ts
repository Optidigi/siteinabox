import type { GeneratedBlockSpec, NormalizedIntake, SiteGenerationSpec } from "@siteinabox/contracts"
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
  const business = normalized.businessName
  const serviceNames = normalized.intakeBrief?.services.length
    ? normalized.intakeBrief.services.slice(0, 4)
    : ["Advies", "Uitvoering"]
  const services = serviceNames.length >= 2 ? serviceNames : [...serviceNames, "Nazorg"]
  const context = sitegenNormalizationContextFromIntake(normalized)
  const contactMethods = context.contactMethods ?? []
  if (contactMethods.length === 0) throw new Error("The mock Sitegen fixture requires at least one supplied contact method.")
  const suppliedImages = suppliedMedia(normalized)
  const firstImage = suppliedImages[0]
  const portrait = suppliedImages.find((asset) =>
    typeof asset === "object" && asset !== null && "alt" in asset && typeof asset.alt === "string" && /portrait|person|professional|owner/i.test(asset.alt),
  )
  return [
    {
      blockType: "hero",
      variant: "hero-01",
      heading: `${business} helpt je verder`,
      body: normalized.intakeBrief?.intro ?? `Heldere hulp voor ${normalized.intakeBrief?.audience ?? "mensen met een concrete vraag"}.`,
      primaryAction: action("Neem contact op", "#contact"),
      secondaryAction: action("Bekijk diensten", "#services"),
      anchor: "hero",
    },
    {
      blockType: "services",
      variant: "services-01",
      heading: "Waarmee kan ik helpen?",
      intro: "Een overzicht van de belangrijkste diensten.",
      items: services.map((title) => ({ title, body: `Praktische ondersteuning rond ${title.toLowerCase()}.`, action: null })),
      anchor: "services",
    },
    {
      blockType: "about",
      heading: "Persoonlijk en duidelijk",
      body: normalized.intakeBrief?.approach ?? "Je weet vooraf wat je kunt verwachten en houdt rechtstreeks contact.",
      ...(portrait ? { portrait } : {}),
      highlights: [{ title: "Rechtstreeks contact", text: "Een vast aanspreekpunt." }, { title: "Duidelijke afspraken", text: "Praktisch en begrijpelijk." }],
      anchor: "about",
    },
    {
      blockType: "process",
      heading: "Zo werken we samen",
      intro: "Van eerste vraag tot een passende oplossing.",
      steps: [
        { title: "Kennismaken", body: "We bespreken je vraag en gewenste resultaat." },
        { title: "Plan maken", body: "Je ontvangt een duidelijke volgende stap." },
        { title: "Aan de slag", body: "We voeren het werk zorgvuldig uit." },
      ],
      anchor: "process",
    },
    {
      blockType: "faq",
      heading: "Veelgestelde vragen",
      intro: "Praktische antwoorden voordat je contact opneemt.",
      items: [
        { question: "Hoe snel kan ik starten?", answer: "Na een korte kennismaking spreken we de eerstvolgende passende stap af." },
        { question: "Kan ik eerst overleggen?", answer: "Ja, een eerste gesprek helpt om de vraag en aanpak helder te krijgen." },
      ],
      anchor: "faq",
    },
    {
      blockType: "cta",
      variant: "cta-01",
      heading: "Even overleggen?",
      body: "Vertel kort waar je hulp bij zoekt.",
      primaryAction: action("Neem contact op", "#contact"),
      secondaryAction: null,
      ...(firstImage ? { image: firstImage } : {}),
      anchor: "next-step",
    },
    {
      blockType: "contact",
      heading: "Neem contact op",
      body: "Mail of bel voor een eerste kennismaking.",
      contactMethods: [...contactMethods],
      serviceArea: normalized.serviceArea,
      openingHours: context.openingHours ?? null,
      bookingAction: context.bookingAction ?? null,
      form: context.form ?? null,
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
      page("index", "Overzicht", blocks, normalized),
      page("diensten", "Diensten", blocks.filter((block) => ["hero", "services", "process", "contact"].includes(block.blockType)), normalized),
      page("contact", "Contact", blocks.filter((block) => ["hero", "contact"].includes(block.blockType)), normalized),
    ],
    blocks: [
      { slug: "hero", label: "Hero" },
      { slug: "services", label: "Services" },
      { slug: "about", label: "About" },
      { slug: "process", label: "Process" },
      { slug: "work", label: "Work" },
      { slug: "reviews", label: "Reviews" },
      { slug: "pricing", label: "Pricing" },
      { slug: "faq", label: "FAQ" },
      { slug: "cta", label: "CTA" },
      { slug: "contact", label: "Contact" },
    ],
    assets: suppliedMedia(normalized),
    generatedAt: new Date().toISOString(),
    generator: { name: "mock-site-generation", version: "sitegen-owned-v1", model: "fixture" },
  }
}
