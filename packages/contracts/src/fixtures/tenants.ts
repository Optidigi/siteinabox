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
    { t: "heading", level: 2, children: [{ t: "text", v: "Het vak waar mijn hart ligt." }] },
    {
      t: "paragraph",
      children: [
        {
          t: "text",
          v: "Amicare-Zorg biedt begeleiding vanuit betrokkenheid, duidelijkheid en respect voor de persoonlijke situatie van ieder kind en gezin.",
        },
      ],
    },
    {
      t: "paragraph",
      children: [
        {
          t: "text",
          v: "Ik geloof in rust, vertrouwen en kleine stappen die jongeren helpen om weer grip te krijgen op hun dag.",
        },
      ],
    },
    {
      t: "blockquote",
      children: [
        {
          t: "paragraph",
          children: [{ t: "text", v: "Jeugdzorg werkt wanneer een jongere zich gezien voelt." }],
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

export const amblastTheme: ThemeTokenSpec = {
  colors: {
    accent: "#ffd500",
    bg: "#ffffff",
    ink: "#333333",
    muted: "#6b6b6b",
    card: "#f8f8f8",
    secondary: "#4ca5ed",
    rule: "#dedede",
  },
  fonts: {
    title: "Barlow, Arial, sans-serif",
    heading: "Barlow, Arial, sans-serif",
    text: "Barlow, Arial, sans-serif",
  },
  radius: "6px",
  density: "comfortable",
  borderStyle: "solid",
  mode: "light",
  stylePreset: "industrial-cleaning",
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
  { slug: "mediaHero", label: "Media hero", defaultAnchor: "top" },
  { slug: "infoCardList", label: "Info cards" },
  { slug: "serviceCarousel", label: "Services" },
  { slug: "beforeAfterGallery", label: "Before/after gallery" },
  { slug: "contactDetails", label: "Contact details" },
]

const amicareSettings: GeneratedSiteSettings = {
  siteName: "Amicare-Zorg",
  siteUrl: "https://amicare.optidigi.nl",
  description: "Amicare-Zorg - werken in de jeugdzorg met hart en toewijding.",
  language: "nl",
  contactEmail: "info@ami-care.nl",
  branding: { primaryColor: "#a04e32" },
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
      url: "https://amicare.optidigi.nl",
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
        variant: "amicareZenHero",
        anchor: "top",
        analytics: { sectionVariant: "amicare-zen-hero" },
        eyebrow: inlineText("Amicare-Zorg"),
        headline: inlineParts([
          { text: "Jeugdzorg met " },
          { text: "hart", marks: ["italic"] },
          { text: " en toewijding" },
        ]),
        subheadline: blockText("Persoonlijke begeleiding, rust en structuur voor jongeren en gezinnen die tijdelijk extra steun nodig hebben."),
        pills: [{ label: "Jeugdzorg" }, { label: "Begeleiding" }, { label: "Vertrouwen" }],
        cta: { label: "Neem contact op", href: "#contact" },
        image: { id: "amicare-bedroom", url: "/media/bedroom.jpg", filename: "bedroom.jpg", alt: "Rustige kinderkamer" },
      },
      {
        blockType: "featureList",
        variant: "amicareCareCards",
        anchor: "werkwijze",
        analytics: { sectionVariant: "amicare-care-cards" },
        title: inlineParts([{ text: "Werken vanuit " }, { text: "rust", marks: ["italic"] }]),
        intro: blockText("Mijn werkwijze"),
        features: [
          { title: inlineText("Veiligheid"), description: blockText("Een rustige basis met voorspelbare begeleiding."), icon: "heart" },
          { title: inlineText("Samenwerking"), description: blockText("Afstemming met gezin, verwijzers en betrokken professionals."), icon: "users" },
          { title: inlineText("Ontwikkeling"), description: blockText("Praktische stappen richting zelfstandigheid en vertrouwen."), icon: "sparkles" },
        ],
      },
      {
        blockType: "richText",
        variant: "amicareEditorial",
        anchor: "over",
        analytics: { sectionVariant: "amicare-editorial" },
        body: amicareEditorialBody(),
      },
      {
        blockType: "cta",
        variant: "amicareQuoteContact",
        anchor: "wat-telt",
        analytics: { sectionVariant: "amicare-quote-contact" },
        eyebrow: inlineText("Wat telt"),
        headline: inlineText("Echt verschil maken voor jongeren en gezinnen."),
        description: blockText("Neem contact op om rustig te bekijken welke ondersteuning passend is."),
        primary: { label: "Neem contact op", href: "#contact" },
        secondary: { label: "Mail Amicare", href: "mailto:info@ami-care.nl" },
        backgroundImage: { id: "amicare-toys", url: "/media/toys.jpg", filename: "toys.jpg", alt: "Speelgoed" },
      },
      {
        blockType: "testimonials",
        variant: "amicareStoryCards",
        anchor: "ervaringen",
        analytics: { sectionVariant: "amicare-story-cards" },
        title: "Ervaringen",
        items: [
          {
            quote: "Er was meteen rust en duidelijkheid. Dat maakte het voor ons gezin veel makkelijker om stappen te zetten.",
            author: "Ouder",
            role: "Begeleidingstraject",
          },
          {
            quote: "De afspraken waren helder en de begeleiding sloot aan bij wat de jongere op dat moment aankon.",
            author: "Verwijzer",
            role: "Samenwerking",
          },
        ],
      },
      {
        blockType: "faq",
        variant: "amicareWarmAccordion",
        anchor: "vragen",
        analytics: { sectionVariant: "amicare-warm-accordion" },
        title: inlineText("Veelgestelde vragen"),
        items: [
          {
            question: inlineText("Voor wie is Amicare-Zorg bedoeld?"),
            answer: blockText("Voor jongeren en gezinnen die tijdelijk extra begeleiding, structuur of afstemming nodig hebben."),
          },
          {
            question: inlineText("Hoe start een kennismaking?"),
            answer: blockText("We beginnen met rustig contact en bespreken samen welke ondersteuning passend is."),
          },
        ],
      },
      {
        blockType: "contactSection",
        variant: "amicareContactForm",
        anchor: "contact",
        analytics: { sectionVariant: "amicare-contact-form" },
        title: inlineText("Neem contact op"),
        description: blockText("Stuur een bericht om rustig te bespreken welke ondersteuning passend is."),
        formName: "amicare-contact",
        submitLabel: "Verzenden",
        fields: [
          { name: "name", label: "Naam", type: "text", required: true },
          { name: "email", label: "E-mail", type: "email", required: true },
          { name: "phone", label: "Telefoon", type: "tel", required: false },
          { name: "message", label: "Bericht", type: "textarea", required: true },
        ],
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

const contactFields = [
  { name: "name", label: "Naam", type: "text" as const, required: true },
  { name: "email", label: "Email", type: "email" as const, required: true },
  { name: "phone", label: "Tel. nummer", type: "tel" as const, required: true },
  { name: "message", label: "Omschrijving project", type: "textarea" as const },
]

const quoteContactBlock = {
  blockType: "contactSection" as const,
  variant: "form",
  anchor: "contact-form",
  title: inlineText("Vraag hier uw vrijblijvende offerte aan"),
  description: blockText("Neem gerust contact met ons op en wij zoeken de beste optie voor u en uw project."),
  formName: "amblast-offerte",
  submitLabel: "Verzenden",
  fields: contactFields,
}

const directContactBlock = {
  blockType: "contactSection" as const,
  variant: "form",
  anchor: "contact-form",
  title: inlineText("Neem gerust contact op"),
  description: blockText("Neem gerust contact met ons op en wij zoeken de beste optie voor u en uw project."),
  formName: "amblast-contact",
  submitLabel: "Verzenden",
  fields: [
    { name: "name", label: "Naam", type: "text" as const, required: true },
    { name: "email", label: "Email", type: "email" as const, required: true },
    { name: "subject", label: "Onderwerp", type: "text" as const, required: true },
    { name: "message", label: "Bericht", type: "textarea" as const },
  ],
}

const withAmblastWeb3FormsProvider = (block: typeof quoteContactBlock | typeof directContactBlock) => ({
  ...block,
  fields: block.fields.map((field) => ({
    ...field,
    maxLength: field.type === "textarea" ? 2000 : 400,
  })),
  provider: {
    provider: "web3forms" as const,
    action: "https://api.web3forms.com/submit",
    method: "POST" as const,
    hiddenFields: [
      { name: "from_name", value: "Amblast | Facility Services" },
      { name: "subject", value: "Bericht via amblast.optidigi.nl" },
    ],
    honeypotField: "botcheck",
    fallbackHref: "mailto:info@amblast.nl",
    successMessage: "Bedankt, uw bericht is verzonden.",
    errorMessage: "Verzenden is niet gelukt. Mail eventueel direct naar info@amblast.nl.",
    analyticsEnabled: false,
  },
})

const serviceFeatures = [
  {
    title: inlineText("Industriële schoonmaak"),
    description: blockText("Machines, productielijnen, opslagtanks, hogedrukreiniging en preventief of correctief onderhoud."),
    icon: "spray-can",
  },
  {
    title: inlineText("Papierindustrie"),
    description: blockText("Reinigen van papiermachines, droogpartijen, perspartijen, filters en vloeren. Verwijderen van pulp- en stofafzetting en verminderen van brand- en storingsrisico's."),
    icon: "factory",
  },
  {
    title: inlineText("Vloeren reiniging"),
    description: blockText("Professionele veeg- en schrobmachines voor grote oppervlakken zoals magazijnen en fabriekshallen."),
    icon: "sparkles",
  },
  {
    title: inlineText("Facility management"),
    description: blockText("Een totaalservice voor onderhoud en reiniging van fabriekshallen en industriële complexen."),
    icon: "building",
  },
]

const amblastMedia = {
  logo: { id: "amblast-logo", url: "/uploads/logo/cropped-AMBlast_logo.png", filename: "cropped-AMBlast_logo.png", alt: "Amblast logo", width: 714, height: 179 },
  logoSmall: { id: "amblast-logo-small", url: "/uploads/logo/cropped-AMBlast_logo-300x75.png", filename: "cropped-AMBlast_logo-300x75.png", alt: "Amblast logo", width: 300, height: 75 },
  faviconUpload: { id: "amblast-upload-favicon", url: "/uploads/logo/AMBlast_favicon.png", filename: "AMBlast_favicon.png", alt: "Amblast favicon" },
  favicon: { id: "amblast-favicon", url: "/favicon.ico", filename: "favicon.ico", alt: "Amblast favicon" },
  favicon32: { id: "amblast-favicon-32", url: "/favicon-32x32.png", filename: "favicon-32x32.png", alt: "Amblast favicon" },
  appleTouchIcon: { id: "amblast-apple-touch-icon", url: "/apple-touch-icon.png", filename: "apple-touch-icon.png", alt: "Amblast app icon" },
  icon192: { id: "amblast-icon-192", url: "/icon-192.png", filename: "icon-192.png", alt: "Amblast app icon" },
  icon512: { id: "amblast-icon-512", url: "/icon-512.png", filename: "icon-512.png", alt: "Amblast app icon" },
  og: { id: "amblast-og", url: "/og-default.png", filename: "og-default.png", alt: "Amblast social image" },
  heroHome: { id: "amblast-hero-home", url: "/uploads/hero/IMG_20210723_135545-scaled-e1631503963184.jpg", filename: "IMG_20210723_135545-scaled-e1631503963184.jpg", alt: "Industriële reiniging", width: 2560, height: 1920 },
  heroHomeWebp: { id: "amblast-hero-home-webp", url: "/uploads/hero/IMG_20210723_135545-scaled-e1631503963184.webp", filename: "IMG_20210723_135545-scaled-e1631503963184.webp", alt: "Industriële reiniging" },
  heroHomeAvif: { id: "amblast-hero-home-avif", url: "/uploads/hero/IMG_20210723_135545-scaled-e1631503963184.avif", filename: "IMG_20210723_135545-scaled-e1631503963184.avif", alt: "Industriële reiniging" },
  heroAbout: { id: "amblast-hero-about", url: "/uploads/hero/IMG_20210319_160356-scaled.jpg", filename: "IMG_20210319_160356-scaled.jpg", alt: "Amblast werkzaamheden", width: 2560, height: 1920 },
  heroServices: { id: "amblast-hero-services", url: "/uploads/hero/IMG_20210827_152238-scaled.jpg", filename: "IMG_20210827_152238-scaled.jpg", alt: "Amblast diensten", width: 2560, height: 1920 },
  heroPortfolio: { id: "amblast-hero-portfolio", url: "/uploads/hero/IMG_20210507_091012s-scaled.jpg", filename: "IMG_20210507_091012s-scaled.jpg", alt: "Amblast portfolio", width: 2560, height: 1920 },
  serviceIndustrial: { id: "amblast-service-pressure-washer-1", url: "/uploads/service-cards/pressure-washer-1.png", filename: "pressure-washer-1.png", alt: "Hogedrukreiniger", width: 512, height: 512 },
  servicePaper: { id: "amblast-service-open-box-1", url: "/uploads/service-cards/open-box-1.png", filename: "open-box-1.png", alt: "Papierindustrie", width: 512, height: 512 },
  serviceFloors: { id: "amblast-service-household-1", url: "/uploads/service-cards/household-1.png", filename: "household-1.png", alt: "Vloeren reiniging", width: 512, height: 512 },
  serviceOther: { id: "amblast-service-sweeping-1", url: "/uploads/service-cards/sweeping-1.png", filename: "sweeping-1.png", alt: "Overige industrieën", width: 512, height: 512 },
  serviceFacility: { id: "amblast-service-house", url: "/uploads/service-cards/003-house.png", filename: "003-house.png", alt: "Facility management", width: 512, height: 512 },
  serviceFloorsGrid: { id: "amblast-service-household", url: "/uploads/service-cards/household.png", filename: "household.png", alt: "Vloeren reiniging", width: 512, height: 512 },
  servicePaperGrid: { id: "amblast-service-pressure-washer", url: "/uploads/service-cards/pressure-washer.png", filename: "pressure-washer.png", alt: "Papier industrie", width: 512, height: 512 },
  serviceIndustrialGrid: { id: "amblast-service-sweeping", url: "/uploads/service-cards/sweeping.png", filename: "sweeping.png", alt: "Industriële schoonmaak", width: 512, height: 512 },
  iconHours: { id: "amblast-icon-hours", url: "/uploads/icons/Icons-3.png", filename: "Icons-3.png", alt: "Openingstijden", width: 200, height: 209 },
  iconContact: { id: "amblast-icon-contact", url: "/uploads/icons/Icons-1.png", filename: "Icons-1.png", alt: "Contact", width: 195, height: 159 },
  iconLocation: { id: "amblast-icon-location", url: "/uploads/icons/Icons-2.png", filename: "Icons-2.png", alt: "Locatie", width: 208, height: 210 },
  iconEmail: { id: "amblast-icon-email", url: "/uploads/icons/Icons-10.png", filename: "Icons-10.png", alt: "Email", width: 299, height: 295 },
  iconWorkHours: { id: "amblast-icon-work-hours", url: "/uploads/icons/Icons-1-3.png", filename: "Icons-1-3.png", alt: "Werktijden", width: 318, height: 318 },
  iconPrice: { id: "amblast-icon-price", url: "/uploads/icons/BANKING-AND-FINANCE-Black-06.png", filename: "BANKING-AND-FINANCE-Black-06.png", alt: "Concurrerende prijzen", width: 340, height: 340 },
  iconAvailability: { id: "amblast-icon-availability", url: "/uploads/icons/ECO-AND-GREEN-ENERGY-Black-16.png", filename: "ECO-AND-GREEN-ENERGY-Black-16.png", alt: "Maandag t/m zondag", width: 340, height: 340 },
  iconService: { id: "amblast-icon-service", url: "/uploads/icons/BANKING-AND-FINANCE-Black-28.png", filename: "BANKING-AND-FINANCE-Black-28.png", alt: "Persoonlijke service", width: 340, height: 340 },
  aboutPortrait: { id: "amblast-about-portrait", url: "/uploads/portfolio/IMG_20210723_083536-576x1024.jpg", filename: "IMG_20210723_083536-576x1024.jpg", alt: "Amblast werkzaamheden", width: 576, height: 1024 },
  beforeOil: { id: "amblast-before-oil", url: "/uploads/portfolio/1-olie-scaled.jpg", filename: "1-olie-scaled.jpg", alt: "Voor reiniging olie", width: 2560, height: 1920 },
  afterOil: { id: "amblast-after-oil", url: "/uploads/portfolio/2-olie-scaled.jpg", filename: "2-olie-scaled.jpg", alt: "Na reiniging olie", width: 2560, height: 1920 },
  beforeMachine: { id: "amblast-before-machine", url: "/uploads/portfolio/IMG_20210402_144215-scaled.jpg", filename: "IMG_20210402_144215-scaled.jpg", alt: "Voor reiniging machine", width: 2560, height: 1920 },
  afterMachine: { id: "amblast-after-machine", url: "/uploads/portfolio/IMG_20210402_151225-scaled.jpg", filename: "IMG_20210402_151225-scaled.jpg", alt: "Na reiniging machine", width: 2560, height: 1920 },
} satisfies Record<string, Exclude<MediaRef, number | string | null>>

const amblastSettings: GeneratedSiteSettings = {
  siteName: "Amblast | Facility Services",
  siteUrl: "https://amblast.optidigi.nl",
  description: "Specialist in industriële schoonmaak in Limburg.",
  language: "nl-NL",
  contactEmail: "info@amblast.nl",
  branding: {
    primaryColor: "#ffd500",
    logo: { id: "amblast-logo", url: "/uploads/logo/cropped-AMBlast_logo.png", filename: "cropped-AMBlast_logo.png", alt: "Amblast logo", width: 714, height: 179 },
    favicon: { id: "amblast-favicon", url: "/favicon.ico", filename: "favicon.ico", alt: "Amblast favicon" },
  },
  chrome: {
    header: {
      variant: "amblastIndustrial",
      logo: { id: "amblast-logo", url: "/uploads/logo/cropped-AMBlast_logo.png", filename: "cropped-AMBlast_logo.png", alt: "Amblast logo", width: 714, height: 179 },
      behavior: "static",
      activeMode: "path",
      mobileMenu: "dropdown",
      cta: { label: "Contact", href: "/contact" },
    },
    footer: {
      variant: "amblastIndustrial",
      logo: { id: "amblast-logo", url: "/uploads/logo/cropped-AMBlast_logo.png", filename: "cropped-AMBlast_logo.png", alt: "Amblast logo", width: 714, height: 179 },
      tagline: "Manage your facility",
      copyright: "Copyright © 2026 Amblast",
      legalLinks: [{ label: "Privacy verklaring", href: "/privacy" }],
      columns: [
        { id: "brand", items: [{ type: "brand", label: "Amblast", text: "Manage your facility" }] },
        { id: "menu", items: [{ type: "navigation", label: "Menu" }] },
        {
          id: "contact",
          items: [{
            type: "contact",
            label: "Contact",
            text: "Heinsbergerweg 172\n6045 CK Roermond",
            links: [
              { label: "info@amblast.nl", href: "mailto:info@amblast.nl" },
              { label: "+31 6 19 96 36 51", href: "tel:+31619963651" },
            ],
          }],
        },
        {
          id: "info",
          items: [{
            type: "business",
            label: "Info",
            text: "KvK: 72128690\nBTW ID: NL002407752B08\nIBAN: NL45 INGB 0008 6149 44\nBIC: INGBNL2A",
          }],
        },
      ],
    },
  },
  contact: {
    phone: "+31619963651",
    address: "Heinsbergerweg 172, 6045 CK Roermond",
    social: [],
  },
  nap: {
    legalName: "Amblast",
    kvkNumber: "72128690",
    streetAddress: "Heinsbergerweg 172",
    city: "Roermond",
    postalCode: "6045 CK",
    country: "NL",
  },
  hours: [
    { day: "monday", open: "00:00", close: "23:59" },
    { day: "tuesday", open: "00:00", close: "23:59" },
    { day: "wednesday", open: "00:00", close: "23:59" },
    { day: "thursday", open: "00:00", close: "23:59" },
    { day: "friday", open: "00:00", close: "23:59" },
    { day: "saturday", open: "00:00", close: "23:59" },
    { day: "sunday", open: "00:00", close: "23:59" },
  ],
  serviceArea: [{ name: "Limburg" }],
  navHeader: [
    { label: "Home", href: "/" },
    { label: "Over ons", href: "/over-ons" },
    { label: "Onze diensten", href: "/diensten" },
    { label: "Portfolio", href: "/portfolio" },
  ],
  navFooter: [
    { label: "Home", href: "/" },
    { label: "Over ons", href: "/over-ons" },
    { label: "Onze diensten", href: "/diensten" },
    { label: "Portfolio", href: "/portfolio" },
    { label: "Contact", href: "/contact" },
  ],
  seoJsonLd: {
    organization: {
      enabled: true,
      type: "HomeAndConstructionBusiness",
      name: "Amblast | Facility Services",
      url: "https://amblast.optidigi.nl",
      logo: { id: "amblast-logo", url: "/uploads/logo/cropped-AMBlast_logo.png", filename: "cropped-AMBlast_logo.png", alt: "Amblast logo", width: 714, height: 179 },
    },
    localBusiness: {
      enabled: true,
      type: "HomeAndConstructionBusiness",
      name: "Amblast",
      description: "Specialist in industriële schoonmaak in Limburg.",
      telephone: "+31619963651",
      email: "info@amblast.nl",
      serviceArea: ["Limburg"],
    },
  },
  updatedAt: GENERATED_AT,
}

const amblastPages: GeneratedPageSpec[] = [
  {
    id: "amblast-index",
    slug: "index",
    title: "Home",
    status: "published",
    updatedAt: GENERATED_AT,
    seo: {
      title: "Amblast | Specialist in industriële schoonmaak",
      description: "Specialist in industriële schoonmaak. Amblast is dé partner voor industriële reiniging in de papierindustrie en andere productieomgevingen in Limburg.",
      ogImage: "/og-default.png",
    },
    blocks: [
      {
        blockType: "hero",
        anchor: "top",
        headline: inlineText("Specialist in industriële schoonmaak"),
        subheadline: blockText("Amblast is dé partner voor industriële reiniging in de papierindustrie en andere productieomgevingen. Wij zorgen dat uw machines, installaties en productieruimtes veilig, hygiënisch en optimaal blijven functioneren."),
        cta: { label: "Contact", href: "/contact" },
        image: { id: "amblast-hero-home", url: "/uploads/hero/IMG_20210723_135545-scaled-e1631503963184.jpg", filename: "IMG_20210723_135545-scaled-e1631503963184.jpg", alt: "Industriële reiniging" },
      },
      {
        blockType: "featureList",
        anchor: "diensten",
        title: inlineText("Waarvoor kunt u bij ons terecht?"),
        intro: blockText("Onze diensten"),
        features: serviceFeatures.slice(0, 3),
      },
      {
        blockType: "richText",
        anchor: "papierindustrie",
        body: blockRichText([
          {
            heading: "Industriële reiniging in de papierindustrie",
            text: "Amblast helpt productiebedrijven hun machines, productielijnen en werkvloeren schoon, veilig en efficiënt te houden.",
          },
        ]),
      },
      {
        blockType: "cta",
        anchor: "contact",
        headline: inlineText("Geinteresseerd in een van onze diensten?"),
        description: blockText("Neem gerust contact met ons op en wij zoeken de beste optie voor u of uw project."),
        primary: { label: "Contact", href: "/contact" },
      },
      quoteContactBlock,
    ],
  },
  {
    id: "amblast-over-ons",
    slug: "over-ons",
    title: "Over ons",
    status: "published",
    updatedAt: GENERATED_AT,
    seo: {
      title: "Over ons | Amblast",
      description: "Amblast is een familiebedrijf gespecialiseerd in industriële reiniging. Actief in de papier- en voedingsindustrie in Limburg.",
    },
    blocks: [
      {
        blockType: "hero",
        headline: inlineText("Over ons"),
        subheadline: blockText("Amblast is een familiebedrijf en gespecialiseerd in industriële reiniging."),
        image: { id: "amblast-hero-about", url: "/uploads/hero/IMG_20210319_160356-scaled.jpg", filename: "IMG_20210319_160356-scaled.jpg", alt: "Amblast werkzaamheden" },
      },
      {
        blockType: "richText",
        body: blockRichText([
          {
            heading: "Amblast manages your facility.",
            text: "Wij zijn actief in sectoren zoals de papierindustrie en voedingsindustrie, waar schoonmaak onmisbaar is om veilig en efficiënt te kunnen produceren.",
          },
          {
            heading: "Waar wij voor staan",
            text: "Betrouwbaarheid, jonge en gedreven teams, eerlijke beloning en resultaatgericht werken.",
          },
          {
            heading: "Onze specialisatie",
            text: "Reiniging van machines, productielijnen en fabriekshallen, plus oplossingen voor andere industriële sectoren.",
          },
        ]),
      },
      {
        blockType: "featureList",
        title: inlineText("Onze waarden"),
        features: [
          { title: inlineText("Betrouwbaarheid"), description: blockText("Afspraken nakomen en kwaliteit leveren."), icon: "check-circle" },
          { title: inlineText("Gedreven teams"), description: blockText("Gemotiveerde mensen die aanpakken en resultaat neerzetten."), icon: "users" },
          { title: inlineText("Eerlijke beloning"), description: blockText("Goed werk hoort goed beloond te worden."), icon: "heart" },
        ],
      },
      quoteContactBlock,
    ],
  },
  {
    id: "amblast-diensten",
    slug: "diensten",
    title: "Diensten",
    status: "published",
    updatedAt: GENERATED_AT,
    seo: {
      title: "Diensten | Amblast",
      description: "Onze diensten - Facility management, papierindustrie, vloerenreiniging en industriële schoonmaak. Amblast levert maatwerk reiniging in heel Limburg.",
    },
    blocks: [
      {
        blockType: "hero",
        headline: inlineText("Onze diensten"),
        image: { id: "amblast-hero-services", url: "/uploads/hero/IMG_20210827_152238-scaled.jpg", filename: "IMG_20210827_152238-scaled.jpg", alt: "Amblast diensten" },
      },
      {
        blockType: "featureList",
        title: inlineText("Facility services voor productieomgevingen"),
        intro: blockText("Van periodiek onderhoud tot specialistische reiniging van machines, vloeren en fabriekshallen."),
        features: serviceFeatures,
      },
      {
        blockType: "cta",
        headline: inlineText("Geinteresseerd in een van onze diensten?"),
        description: blockText("Neem gerust contact met ons op en wij zoeken de beste optie voor u en uw project."),
        primary: { label: "Contact", href: "/contact" },
      },
      quoteContactBlock,
    ],
  },
  {
    id: "amblast-portfolio",
    slug: "portfolio",
    title: "Portfolio",
    status: "published",
    updatedAt: GENERATED_AT,
    seo: {
      title: "Portfolio | Amblast",
      description: "Bekijk wat Amblast doet - voor- en na-beelden van industriële reiniging in Limburg. Hoe we het al meer dan 8 jaar doen.",
    },
    blocks: [
      {
        blockType: "hero",
        headline: inlineText("Portfolio"),
        image: { id: "amblast-hero-portfolio", url: "/uploads/hero/IMG_20210507_091012s-scaled.jpg", filename: "IMG_20210507_091012s-scaled.jpg", alt: "Amblast portfolio" },
      },
      {
        blockType: "richText",
        anchor: "werk",
        body: blockRichText([
          {
            heading: "Hoe we het al meer dan 8 jaar doen",
            text: "Neem hier een kijkje naar het werk dat wij verrichten.",
          },
          {
            heading: "Voor en na",
            text: "Portfoliovergelijkingen: /uploads/portfolio/1-olie-scaled.jpg naar /uploads/portfolio/2-olie-scaled.jpg en /uploads/portfolio/IMG_20210402_144215-scaled.jpg naar /uploads/portfolio/IMG_20210402_151225-scaled.jpg.",
          },
        ]),
      },
      {
        blockType: "cta",
        headline: inlineText("Geinteresseerd in een van onze diensten?"),
        description: blockText("Neem gerust contact met ons op en wij zoeken de beste optie voor u en uw project."),
        primary: { label: "Contact", href: "/contact" },
      },
      quoteContactBlock,
    ],
  },
  {
    id: "amblast-contact",
    slug: "contact",
    title: "Contact",
    status: "published",
    updatedAt: GENERATED_AT,
    seo: {
      title: "Contact | Amblast",
      description: "Neem gerust contact op met Amblast voor industriële reiniging in Limburg. Bel +31 6 19 96 36 51 of stuur een bericht.",
    },
    blocks: [
      {
        blockType: "hero",
        headline: inlineText("Contact"),
        image: { id: "amblast-hero-contact", url: "/uploads/hero/IMG_20210507_091012s-scaled.jpg", filename: "IMG_20210507_091012s-scaled.jpg", alt: "Contact met Amblast" },
      },
      {
        blockType: "richText",
        body: blockRichText([
          {
            heading: "Neem gerust contact op",
            text: "AMBLAST, Heinsbergerweg 172, 6045 CK Roermond. info@amblast.nl. +31 6 19 96 36 51. KvK: 72128690. BTW ID: NL002407752B08. IBAN: NL45 INGB 0008 6149 44. BIC: INGBNL2A.",
          },
        ]),
      },
      directContactBlock,
    ],
  },
]

const amblastServiceCarouselItems = [
  {
    title: inlineText("Industriële schoonmaak"),
    description: paragraphs(["Machines, productielijnen, opslagtanks", "Hogedrukreiniging", "Preventief en correctief onderhoud"]),
    image: amblastMedia.serviceIndustrial,
    cta: { label: "Offerte aanvragen", href: "/contact" },
  },
  {
    title: inlineText("Papierindustrie"),
    description: paragraphs(["Reinigen van papiermachines, droogpartijen, perspartijen, filters en vloeren", "Verwijderen van pulp- en stofafzetting", "Verminderen van brand- en storingsrisico's"]),
    image: amblastMedia.servicePaper,
    cta: { label: "Offerte aanvragen", href: "/contact" },
  },
  {
    title: inlineText("Vloeren reiniging"),
    description: blockText("Een schone vloer is de basis van een veilige en efficiënte werkomgeving. Met onze professionele veeg- en schrobmachines reinigen wij moeiteloos grote oppervlakken, zoals magazijnen en fabriekshallen. Kies voor eenmalige schoonmaak of periodiek onderhoud."),
    image: amblastMedia.serviceFloors,
    cta: { label: "Offerte aanvragen", href: "/contact" },
  },
  {
    title: inlineText("Overige industrieën"),
    description: paragraphs(["Chemische fabrieken, logistieke hallen, warehouses", "Veiligheidsreiniging met aandacht voor milieu"]),
    image: amblastMedia.serviceOther,
  },
]

const amblastContactFactCards = {
  blockType: "infoCardList" as const,
  variant: "amblastImageBoxes",
  anchor: "contactgegevens",
  analytics: { sectionVariant: "amblast-image-boxes" },
  layout: "grid" as const,
  iconPosition: "top" as const,
  items: [
    { title: inlineText("Telefoon"), description: blockText("+31 6 19 96 36 51"), image: amblastMedia.iconContact, link: { label: "Bel Amblast", href: "tel:+31619963651" }, animation: "float" as const },
    { title: inlineText("Email"), description: blockText("info@amblast.nl"), image: amblastMedia.iconEmail, link: { label: "Mail Amblast", href: "mailto:info@amblast.nl" }, animation: "float" as const },
    { title: inlineText("Werktijden"), description: blockText("7:30 - 16:00"), image: amblastMedia.iconWorkHours, animation: "float" as const },
  ],
}

const amblastRendererPages: GeneratedPageSpec[] = [
  {
    ...amblastPages[0]!,
    blocks: [
      {
        blockType: "mediaHero",
        variant: "amblastShapedHero",
        anchor: "top",
        analytics: { sectionVariant: "amblast-shaped-overlay" },
        headline: inlineText("Specialist in industriële schoonmaak"),
        subheadline: blockText("Amblast is dé partner voor industriële reiniging in de papierindustrie en andere productieomgevingen. Wij zorgen dat uw machines, installaties en productieruimtes veilig, hygiënisch en optimaal blijven functioneren."),
        cta: { label: "Contact", href: "/contact" },
        backgroundImage: amblastMedia.heroHome,
        overlay: { color: "#d2edfd", opacity: 0.85 },
        minHeight: "viewport",
        contentAlign: "left",
        contentWidth: "wide",
        shapeDividers: { top: "mountains", bottom: "wave-brush" },
        priority: true,
      },
      {
        blockType: "infoCardList",
        variant: "amblastImageBoxes",
        anchor: "bereikbaarheid",
        analytics: { sectionVariant: "amblast-image-boxes" },
        layout: "row",
        iconPosition: "left",
        items: [
          { title: inlineText("Maandag t/m zondag"), description: blockText("24/7"), image: amblastMedia.iconHours, animation: "fadeInDown" },
          { title: inlineText("+31 6 19 96 36 51"), description: blockText("info@amblast.nl"), image: amblastMedia.iconContact, link: { label: "Bel Amblast", href: "tel:+31619963651" }, animation: "fadeInDown" },
          { title: inlineText("Actief in Limburg"), description: blockText("Gevestigd in Roermond"), image: amblastMedia.iconLocation, animation: "fadeInDown" },
        ],
      },
      {
        blockType: "serviceCarousel",
        variant: "amblastSwiperServices",
        anchor: "diensten",
        analytics: { sectionVariant: "amblast-swiper-services" },
        title: inlineText("Waarvoor kunt u bij ons terecht?"),
        intro: blockText("Onze diensten"),
        layout: "carousel",
        items: amblastServiceCarouselItems,
        carousel: {
          slidesPerView: 1,
          slidesPerViewTablet: 1,
          slidesPerViewMobile: 1,
          spaceBetween: 24,
          autoplay: true,
          autoplayDelayMs: 3000,
          loop: true,
          pagination: "bullets",
          pauseOnInteraction: false,
        },
      },
      {
        blockType: "richText",
        variant: "prose",
        anchor: "papierindustrie",
        body: blockRichText([{ heading: "Industriële reiniging in de papierindustrie", text: "Amblast helpt productiebedrijven hun machines, productielijnen en werkvloeren schoon, veilig en efficiënt te houden." }]),
      },
      withAmblastWeb3FormsProvider(quoteContactBlock),
    ],
  },
  {
    ...amblastPages[1]!,
    blocks: [
      {
        blockType: "mediaHero",
        variant: "amblastShapedHero",
        anchor: "top",
        analytics: { sectionVariant: "amblast-shaped-overlay" },
        headline: inlineText("Over ons"),
        backgroundImage: amblastMedia.heroAbout,
        foregroundImage: amblastMedia.aboutPortrait,
        overlay: { color: "#111111", opacity: 0.42 },
        minHeight: "tall",
        contentAlign: "left",
        shapeDividers: { bottom: "mountains" },
        priority: true,
      },
      {
        blockType: "richText",
        variant: "prose",
        anchor: "over",
        body: blockRichText([
          { heading: "Amblast manages your facility.", text: "Amblast is een familiebedrijf en gespecialiseerd in industriële reiniging. Wij zijn actief in sectoren zoals de papierindustrie en voedingsindustrie, waar schoonmaak onmisbaar is om veilig en efficiënt te kunnen produceren." },
          { text: "Ontstaan vanuit praktijkervaring. Jarenlang werk binnen industriële omgevingen waar we van dichtbij zagen hoe belangrijk grondige reiniging is voor het voorkomen van stilstand en het waarborgen van kwaliteit." },
          { heading: "Waar wij voor staan", text: "Betrouwbaarheid, jonge en gedreven teams, eerlijke beloning en resultaatgericht werken." },
          { heading: "Onze specialisatie", text: "Reiniging van machines, productielijnen en fabriekshallen, plus oplossingen voor andere industriële sectoren." },
        ]),
      },
      {
        blockType: "infoCardList",
        variant: "amblastImageBoxes",
        anchor: "waarden",
        analytics: { sectionVariant: "amblast-image-boxes" },
        layout: "grid",
        iconPosition: "top",
        items: [
          { title: inlineText("Concurrerende Prijzen"), image: amblastMedia.iconPrice, animation: "float" },
          { title: inlineText("Maandag t/m zondag"), image: amblastMedia.iconAvailability, animation: "float" },
          { title: inlineText("Persoonlijke service"), image: amblastMedia.iconService, animation: "float" },
        ],
      },
      {
        blockType: "cta",
        variant: "quote",
        anchor: "diensten",
        headline: inlineText("Bekijk onze diensten"),
        description: blockText("Van facility management tot specialistische industriële schoonmaak."),
        primary: { label: "Diensten", href: "/diensten" },
      },
      withAmblastWeb3FormsProvider(quoteContactBlock),
    ],
  },
  {
    ...amblastPages[2]!,
    blocks: [
      {
        blockType: "mediaHero",
        variant: "amblastShapedHero",
        anchor: "top",
        analytics: { sectionVariant: "amblast-shaped-overlay" },
        headline: inlineText("Onze diensten"),
        backgroundImage: amblastMedia.heroServices,
        overlay: { color: "#111111", opacity: 0.45 },
        minHeight: "tall",
        contentAlign: "left",
        shapeDividers: { bottom: "mountains" },
        priority: true,
      },
      {
        blockType: "serviceCarousel",
        variant: "amblastSwiperServices",
        anchor: "diensten",
        analytics: { sectionVariant: "amblast-swiper-services" },
        title: inlineText("Facility services voor productieomgevingen"),
        intro: blockText("Van periodiek onderhoud tot specialistische reiniging van machines, vloeren en fabriekshallen."),
        layout: "grid",
        items: [
          { title: inlineText("Facility management"), description: blockText("Een totaalservice voor onderhoud en reiniging van fabriekshallen of industriële complexen."), image: amblastMedia.serviceFacility },
          { title: inlineText("Vloeren reiniging"), description: blockText("Professionele veeg- en schrobmachines voor magazijnen en fabriekshallen."), image: amblastMedia.serviceFloorsGrid },
          { title: inlineText("Papier industrie"), description: paragraphs(["Reinigen van papiermachines, droogpartijen, perspartijen, filters en vloeren", "Verwijderen van pulp- en stofafzetting", "Verminderen van brand- en storingsrisico's"]), image: amblastMedia.servicePaperGrid },
          { title: inlineText("Industriële schoonmaak"), description: paragraphs(["Machines, productielijnen, opslagtanks", "Hogedrukreiniging", "Preventief en correctief onderhoud"]), image: amblastMedia.serviceIndustrialGrid },
        ],
      },
      withAmblastWeb3FormsProvider(quoteContactBlock),
    ],
  },
  {
    ...amblastPages[3]!,
    blocks: [
      {
        blockType: "mediaHero",
        variant: "amblastShapedHero",
        anchor: "top",
        analytics: { sectionVariant: "amblast-shaped-overlay" },
        headline: inlineText("Portfolio"),
        backgroundImage: amblastMedia.heroPortfolio,
        overlay: { color: "#111111", opacity: 0.45 },
        minHeight: "tall",
        contentAlign: "left",
        shapeDividers: { bottom: "mountains" },
        priority: true,
      },
      {
        blockType: "richText",
        variant: "prose",
        anchor: "werk",
        body: blockRichText([{ heading: "Hoe we het al meer dan 8 jaar doen", text: "Neem hier een kijkje naar het werk dat wij verrichten." }]),
      },
      {
        blockType: "beforeAfterGallery",
        variant: "amblastPortfolio",
        anchor: "voor-en-na",
        analytics: { sectionVariant: "amblast-portfolio-comparisons" },
        title: inlineText("Voor en na"),
        pairs: [
          { before: amblastMedia.beforeOil, after: amblastMedia.afterOil, beforeLabel: "Voor", afterLabel: "Na", initialRatio: 0.5, orientation: "horizontal" },
          { before: amblastMedia.beforeMachine, after: amblastMedia.afterMachine, beforeLabel: "Voor", afterLabel: "Na", initialRatio: 0.5, orientation: "horizontal" },
        ],
      },
      withAmblastWeb3FormsProvider(quoteContactBlock),
    ],
  },
  {
    ...amblastPages[4]!,
    blocks: [
      {
        blockType: "mediaHero",
        variant: "amblastShapedHero",
        anchor: "top",
        analytics: { sectionVariant: "amblast-shaped-overlay" },
        headline: inlineText("Contact"),
        backgroundImage: amblastMedia.heroPortfolio,
        overlay: { color: "#111111", opacity: 0.45 },
        minHeight: "tall",
        contentAlign: "left",
        shapeDividers: { bottom: "wave-brush" },
        priority: true,
      },
      {
        blockType: "contactDetails",
        variant: "amblastContactCards",
        anchor: "amblast",
        analytics: { sectionVariant: "amblast-contact-cards" },
        title: inlineText("Neem gerust contact op"),
        intro: blockText("Contact"),
        layout: "split",
        items: [
          { kind: "address", label: "Adres", value: blockText("Heinsbergerweg 172\n6045 CK Roermond"), icon: "map-pin" },
          { kind: "email", label: "Email", value: blockText("info@amblast.nl"), href: "mailto:info@amblast.nl", icon: "mail" },
          { kind: "phone", label: "Telefoon", value: blockText("+31 6 19 96 36 51"), href: "tel:+31619963651", icon: "phone" },
        ],
        legal: {
          kvkNumber: "72128690",
          btwId: "NL002407752B08",
          iban: "NL45 INGB 0008 6149 44",
          bic: "INGBNL2A",
        },
      },
      amblastContactFactCards,
      withAmblastWeb3FormsProvider(directContactBlock),
    ],
  },
]

export const amicareSiteGenerationSpec: SiteGenerationSpec = {
  schemaVersion: 1,
  intake: {
    businessName: "Amicare-Zorg",
    tenantSlug: "amicare",
    primaryDomain: "amicare.optidigi.nl",
    siteUrl: "https://amicare.optidigi.nl",
    language: "nl",
    industry: "Jeugdzorg",
    serviceArea: ["Nederland"],
    goals: ["CMS-backed legacy tenant parity", "Renderer-compatible data validation"],
    requestedPages: [{ slug: "index", title: "Home", purpose: "Homepage" }],
  },
  tenant: { name: "Amicare-Zorg", slug: "amicare", domain: "amicare.optidigi.nl", status: "active" },
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

export const amblastSiteGenerationSpec: SiteGenerationSpec = {
  schemaVersion: 1,
  intake: {
    businessName: "Amblast | Facility Services",
    tenantSlug: "amblast",
    primaryDomain: "amblast.optidigi.nl",
    siteUrl: "https://amblast.optidigi.nl",
    language: "nl-NL",
    industry: "Industriële reiniging",
    serviceArea: ["Limburg"],
    goals: ["Represent legacy Astro content as CMS-compatible data", "Validate future renderer parity"],
    requestedPages: [
      { slug: "index", title: "Home", purpose: "Homepage" },
      { slug: "over-ons", title: "Over ons", purpose: "Company profile" },
      { slug: "diensten", title: "Diensten", purpose: "Services" },
      { slug: "portfolio", title: "Portfolio", purpose: "Proof of work" },
      { slug: "contact", title: "Contact", purpose: "Lead capture" },
    ],
    brandSignals: {
      colors: ["#ffd500", "#333333", "#4ca5ed", "#ffffff"],
      fonts: ["Roboto Slab", "Roboto"],
      tone: ["industrieel", "praktisch", "betrouwbaar"],
      assets: [amblastMedia.logo],
    },
  },
  tenant: { name: "Amblast | Facility Services", slug: "amblast", domain: "amblast.optidigi.nl", status: "active" },
  theme: amblastTheme,
  settings: amblastSettings,
  pages: amblastRendererPages,
  blocks: rendererParityBlocks,
  assets: [
    ...Object.values(amblastMedia),
  ],
  generatedAt: GENERATED_AT,
  generator: { name: "legacy-tenant-migration", version: "phase-5" },
}

export const amicarePublishedSiteSnapshot = toSnapshot(amicareSiteGenerationSpec, "tenant-amicare")
export const amblastPublishedSiteSnapshot = toSnapshot(amblastSiteGenerationSpec, "tenant-amblast")

export const tenantSiteGenerationSpecs = [amicareSiteGenerationSpec, amblastSiteGenerationSpec] as const
export const tenantPublishedSiteSnapshots = [amicarePublishedSiteSnapshot, amblastPublishedSiteSnapshot] as const
