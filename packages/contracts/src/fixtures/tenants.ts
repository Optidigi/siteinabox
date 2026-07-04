import type { RtBlockRoot, RtInlineRoot } from "../rich-text"
import type { MediaRef } from "../site"
import type {
  GeneratedPageSpec,
  GeneratedSiteSettings,
  PublishedSiteSnapshot,
  SiteBlockManifestItem,
  SiteGenerationSpec,
  ThemeTokenSpec,
} from "../generation"

const GENERATED_AT = "2026-06-25T00:00:00.000Z"

const inlineText = (text: string): RtInlineRoot => ({
  t: "root",
  variant: "inline",
  children: [{ t: "text", v: text }],
})

const inlineParts = (parts: Array<{ text: string; marks?: Array<"bold" | "italic" | "underline"> }>): RtInlineRoot => ({
  t: "root",
  variant: "inline",
  children: parts.map((part) => ({ t: "text", v: part.text, ...(part.marks ? { marks: part.marks } : {}) })),
})

const blockText = (text: string): RtBlockRoot => ({
  t: "root",
  variant: "block",
  children: [{ t: "paragraph", children: [{ t: "text", v: text }] }],
})

const paragraphs = (items: string[]): RtBlockRoot => ({
  t: "root",
  variant: "block",
  children: items.map((text) => ({ t: "paragraph", children: [{ t: "text", v: text }] })),
})

const blockRichText = (parts: Array<{ heading?: string; text?: string }>): RtBlockRoot => ({
  t: "root",
  variant: "block",
  children: parts.flatMap((part) => {
    const nodes: RtBlockRoot["children"] = []
    if (part.heading) {
      nodes.push({ t: "heading", level: 2, children: [{ t: "text", v: part.heading }] })
    }
    if (part.text) {
      nodes.push({ t: "paragraph", children: [{ t: "text", v: part.text }] })
    }
    return nodes
  }),
})

const amicareEditorialBody = (): RtBlockRoot => ({
  t: "root",
  variant: "block",
  children: [
    { t: "themed", id: "eyebrow", props: { text: "Over mij" } },
    {
      t: "heading",
      level: 2,
      children: [
        { t: "text", v: "Het vak waar mijn " },
        { t: "text", v: "hart ligt", marks: ["italic"] },
        { t: "text", v: "." },
      ],
    },
    {
      t: "paragraph",
      children: [
        {
          t: "text",
          v: "Tegelijk blijf ik mijzelf graag ontwikkelen, en sta ik open voor nieuwe uitdagingen en opdrachten binnen het werkveld.",
        },
      ],
    },
    {
      t: "paragraph",
      children: [
        {
          t: "text",
          v: "Naast mijn werk ben ik moeder, en geniet ik van het drukke, gezellige gezinsleven. De combinatie van werk en gezin maakt mijn dagen dynamisch — en waardevol.",
        },
      ],
    },
  ],
})

const manifestEntries = (tenantId: string, settings: GeneratedSiteSettings, pages: GeneratedPageSpec[]) => ({
  tenantId,
  version: 1,
  updatedAt: GENERATED_AT,
  entries: [
    { type: "settings" as const, key: "site-settings", updatedAt: settings.updatedAt ?? GENERATED_AT },
    ...pages.map((page) => ({
      type: "page" as const,
      key: page.slug,
      updatedAt: page.updatedAt ?? GENERATED_AT,
    })),
  ],
})

const mediaManifestKey = (media: MediaRef): string | null => {
  if (!media || typeof media === "number") return media == null ? null : String(media)
  if (typeof media === "string") return media
  return media.filename ?? media.url ?? (media.id == null ? null : String(media.id))
}

const toSnapshot = (
  spec: SiteGenerationSpec,
  tenantId: string,
  overrides?: {
    pages?: GeneratedPageSpec[]
    blocks?: SiteBlockManifestItem[]
    assets?: MediaRef[]
  },
): PublishedSiteSnapshot => {
  const pages = overrides?.pages ?? spec.pages
  const assets = overrides?.assets ?? spec.assets
  const baseManifest = manifestEntries(tenantId, spec.settings, pages)

  return {
    schemaVersion: 1,
    tenantId,
    tenantSlug: spec.tenant.slug,
    domain: spec.tenant.domain,
    siteUrl: spec.settings.siteUrl,
    manifest: {
      ...baseManifest,
      entries: [
        ...baseManifest.entries,
        ...(assets ?? []).flatMap((asset) => {
          const key = mediaManifestKey(asset)
          return key ? [{ type: "media" as const, key, updatedAt: GENERATED_AT }] : []
        }),
      ],
    },
    settings: spec.settings,
    pages: pages.map((page) => ({
      ...page,
      status: page.status ?? "published",
      updatedAt: page.updatedAt ?? GENERATED_AT,
    })),
    theme: spec.theme,
    blocks: overrides?.blocks ?? spec.blocks,
    media: assets,
    publishedAt: GENERATED_AT,
  }
}

export const amicareTheme: ThemeTokenSpec = {
  colors: {
    accent: "#a04e32",
    bg: "#fbf7f0",
    ink: "#1f1a14",
    muted: "#5a4f44",
    card: "#ffffff",
    secondary: "#efe9dd",
    rule: "rgba(31, 26, 20, 0.12)",
  },
  fonts: {
    title: "Fraunces Variable, Georgia, serif",
    heading: "Fraunces Variable, Georgia, serif",
    text: "Inter Variable, system-ui, sans-serif",
    script: "Caveat Variable, cursive",
  },
  radius: "0.5rem",
  density: "comfortable",
  borderStyle: "solid",
  mode: "light",
  stylePreset: "warm-care",
}

const canonicalBlocks: SiteBlockManifestItem[] = [
  { slug: "hero", label: "Hero", defaultAnchor: "top" },
  { slug: "featureList", label: "Services", defaultAnchor: "diensten" },
  { slug: "richText", label: "Content" },
  { slug: "cta", label: "CTA", defaultAnchor: "contact" },
  { slug: "contactSection", label: "Contactformulier", defaultAnchor: "contact-form" },
  { slug: "faq", label: "Veelgestelde vragen" },
  { slug: "testimonials", label: "Ervaringen" },
]

const rendererParityBlocks: SiteBlockManifestItem[] = [
  ...canonicalBlocks,
]

const amicareSettings: GeneratedSiteSettings = {
  siteName: "Amicare-Zorg",
  siteUrl: "https://ami-care.nl",
  description: "Amicare-Zorg - werken in de jeugdzorg met hart en toewijding.",
  language: "nl",
  contactEmail: "info@ami-care.nl",
  branding: {
    primaryColor: "#a04e32",
    favicon: { id: "amicare-favicon-svg", url: "/favicon.svg", filename: "favicon.svg", alt: "Amicare-Zorg favicon" },
  },
  chrome: {
    header: {
      variant: "amicareZen",
      behavior: "sticky",
      activeMode: "anchor",
      mobileMenu: "dropdown",
      cta: { label: "Contact", href: "#contact" },
    },
    footer: {
      variant: "amicareZen",
      tagline: "Jeugdzorg met hart en toewijding.",
      copyright: "© Amicare-Zorg",
      columns: [
        { id: "brand", items: [{ type: "brand", label: "Amicare-Zorg", text: "Jeugdzorg met hart en toewijding." }] },
        { id: "business", items: [{ type: "business", label: "Bedrijfsgegevens" }] },
        { id: "contact", items: [{ type: "contact", label: "Contact", links: [{ label: "info@ami-care.nl", href: "mailto:info@ami-care.nl" }] }] },
        { id: "nav", items: [{ type: "navigation", label: "Navigatie" }] },
      ],
    },
  },
  contact: { phone: null, address: null, social: [] },
  nap: {
    legalName: "AMICARE ZORG",
    kvkNumber: "99968347",
    establishmentNumber: "000065004922",
    country: "NL",
  },
  navHeader: [
    { label: "Werkwijze", href: "#werkwijze" },
    { label: "Over", href: "#over" },
    { label: "Wat telt", href: "#wat-telt" },
    { label: "Contact", href: "#contact" },
  ],
  navFooter: [
    { label: "Werkwijze", href: "#werkwijze" },
    { label: "Over", href: "#over" },
    { label: "Wat telt", href: "#wat-telt" },
    { label: "Contact", href: "#contact" },
  ],
  analytics: { provider: "posthog", captureSections: true, captureActions: true, captureForms: true },
  analyticsConsent: {
    enabled: true,
    provider: "posthog",
    consentStorageKey: "siab-analytics-consent",
    consentVersion: "2026-06",
    captureSections: true,
    captureActions: true,
    captureForms: true,
  },
  seoJsonLd: {
    organization: {
      enabled: true,
      type: "Organization",
      name: "Amicare-Zorg",
      url: "https://ami-care.nl",
      logo: { id: "amicare-og", url: "/og-default.png", filename: "og-default.png", alt: "Amicare-Zorg" },
    },
    localBusiness: {
      enabled: true,
      type: "ProfessionalService",
      name: "Amicare-Zorg",
      description: "Jeugdzorg met hart en toewijding.",
      email: "info@ami-care.nl",
      serviceArea: ["Nederland"],
    },
  },
  updatedAt: GENERATED_AT,
}

const amicarePages: GeneratedPageSpec[] = [
  {
    id: "amicare-index",
    slug: "index",
    title: "Home",
    status: "published",
    updatedAt: GENERATED_AT,
    seo: {
      title: "Amicare-Zorg",
      description: "Amicare-Zorg - werken in de jeugdzorg met hart en toewijding.",
      ogImage: "/og-default.png",
    },
    blocks: [
      {
        blockType: "hero",
        designVariant: "amicareZenHero",
        anchor: "top",
        eyebrow: inlineText("Voor jongeren en gezinnen"),
        headline: inlineParts([
          { text: "Jeugdzorg met " },
          { text: "hart", marks: ["italic"] },
          { text: " en toewijding." },
        ]),
        subheadline: blockText("Al jarenlang werk ik met toewijding in de jeugdzorg. Dit is het vak dat ik ken — waar mijn hart ligt, en waar ik mij dagelijks voor inzet."),
        pills: [
          { id: "amicare-hero-pill-jeugdzorg", label: "Jeugdzorg" },
          { id: "amicare-hero-pill-begeleiding", label: "Begeleiding" },
          { id: "amicare-hero-pill-vertrouwen", label: "Vertrouwen" },
        ],
        cta: { label: "Contact", href: "#contact" },
        image: { id: "amicare-toys", url: "/media/toys.jpg", filename: "toys.jpg", alt: "Speelgoed" },
      },
      {
        blockType: "featureList",
        designVariant: "amicareCareCards",
        anchor: "werkwijze",
        title: inlineParts([{ text: "Wat voor mij " }, { text: "centraal staat", marks: ["italic"] }, { text: "." }]),
        intro: blockText("Drie dingen"),
        features: [
          { title: inlineText("Aandacht"), description: blockText("Echt luisteren naar wat een jongere of een gezin op dat moment nodig heeft. Zonder aannames vooraf."), icon: "ear" },
          { title: inlineText("Betrokkenheid"), description: blockText("Naast mensen staan, niet erboven. Werken vanuit gelijkwaardigheid en vertrouwen."), icon: "heart-handshake" },
          { title: inlineText("Continuïteit"), description: blockText("Aanwezig blijven, ook als trajecten lang of ingewikkeld worden. De relatie als basis."), icon: "clock" },
        ],
      },
      {
        blockType: "richText",
        designVariant: "amicareEditorial",
        anchor: "over",
        body: amicareEditorialBody(),
      },
      {
        blockType: "cta",
        designVariant: "amicareQuoteContact",
        anchor: "wat-telt",
        headline: inlineText("Vertrouwen ontstaat in de tijd, niet in één gesprek."),
        description: blockText("Daarom werk ik graag in trajecten waar continuïteit en kleine stappen het echte werk doen — voor jongeren, voor gezinnen, en voor de mensen om hen heen."),
        backgroundImage: {
          id: "amicare-bedroom",
          url: "/api/tenant-media/7/bedroom.jpg",
          filename: "bedroom.jpg",
          alt: "Slaapkamer met zacht ochtendlicht",
          width: 1600,
          height: 1067,
        },
      },
      {
        blockType: "cta",
        designVariant: "amicareQuoteContact",
        anchor: "contact",
        headline: inlineText("Wilt u meer informatie of in contact komen?"),
        primary: { label: "info@ami-care.nl", href: "mailto:info@ami-care.nl" },
      },
    ],
  },
]

const amicareRendererPages: GeneratedPageSpec[] = amicarePages.map((page) => ({
  ...page,
  blocks: page.blocks.map((block) => {
    if (block.blockType !== "contactSection") return block
    return {
      ...block,
      fields: block.fields.map((field) => ({
        ...field,
        maxLength: field.type === "textarea" ? 2000 : field.name === "email" ? 240 : 160,
      })),
      provider: {
        provider: "siab" as const,
        action: "/api/forms",
        method: "POST" as const,
        hiddenFields: [{ name: "tenant", value: "amicare" }],
        honeypotField: "company",
        successMessage: "Bedankt, je bericht is verzonden.",
        errorMessage: "Verzenden is niet gelukt. Mail eventueel direct naar info@ami-care.nl.",
        analyticsEnabled: true,
      },
    }
  }),
}))

export const amicareSiteGenerationSpec: SiteGenerationSpec = {
  schemaVersion: 1,
  intake: {
    businessName: "Amicare-Zorg",
    tenantSlug: "amicare",
    primaryDomain: "ami-care.nl",
    siteUrl: "https://ami-care.nl",
    language: "nl",
    industry: "Jeugdzorg",
    serviceArea: ["Nederland"],
    goals: ["CMS-backed tenant renderer parity", "Renderer-compatible data validation"],
    requestedPages: [{ slug: "index", title: "Home", purpose: "Homepage" }],
  },
  tenant: { name: "Amicare-Zorg", slug: "amicare", domain: "ami-care.nl", status: "active" },
  theme: amicareTheme,
  settings: amicareSettings,
  pages: amicareRendererPages,
  blocks: canonicalBlocks,
  assets: [
    { id: "amicare-bedroom", url: "/media/bedroom.jpg", filename: "bedroom.jpg", alt: "Rustige kinderkamer" },
    { id: "amicare-toys", url: "/media/toys.jpg", filename: "toys.jpg", alt: "Speelgoed" },
    { id: "amicare-og", url: "/og-default.png", filename: "og-default.png", alt: "Amicare-Zorg social image" },
    { id: "amicare-favicon-svg", url: "/favicon.svg", filename: "favicon.svg", alt: "Amicare-Zorg favicon" },
    { id: "amicare-favicon", url: "/favicon.ico", filename: "favicon.ico", alt: "Amicare-Zorg favicon" },
    { id: "amicare-apple-touch-icon", url: "/apple-touch-icon.png", filename: "apple-touch-icon.png", alt: "Amicare-Zorg app icon" },
  ],
  generatedAt: GENERATED_AT,
  generator: { name: "legacy-tenant-migration", version: "phase-5" },
}

export const amicarePublishedSiteSnapshot = toSnapshot(amicareSiteGenerationSpec, "tenant-amicare")
export const tenantSiteGenerationSpecs = [amicareSiteGenerationSpec] as const
export const tenantPublishedSiteSnapshots = [amicarePublishedSiteSnapshot] as const
