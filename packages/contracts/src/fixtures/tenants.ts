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

const blockText = (text: string): RtBlockRoot => ({
  t: "root",
  variant: "block",
  children: [{ t: "paragraph", children: [{ t: "text", v: text }] }],
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
): PublishedSiteSnapshot => {
  const baseManifest = manifestEntries(tenantId, spec.settings, spec.pages)

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
        ...(spec.assets ?? []).flatMap((asset) => {
          const key = mediaManifestKey(asset)
          return key ? [{ type: "media" as const, key, updatedAt: GENERATED_AT }] : []
        }),
      ],
    },
    settings: spec.settings,
    pages: spec.pages.map((page) => ({
      ...page,
      status: page.status ?? "published",
      updatedAt: page.updatedAt ?? GENERATED_AT,
    })),
    theme: spec.theme,
    blocks: spec.blocks,
    media: spec.assets,
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
    title: "Roboto Slab, Georgia, serif",
    heading: "Roboto Slab, Georgia, serif",
    text: "Roboto, Arial, sans-serif",
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

const amicareSettings: GeneratedSiteSettings = {
  siteName: "Amicare-Zorg",
  siteUrl: "https://ami-care.nl",
  description: "Amicare-Zorg - werken in de jeugdzorg met hart en toewijding.",
  language: "nl",
  contactEmail: "info@ami-care.nl",
  branding: { primaryColor: "#a04e32" },
  chrome: {
    footer: {
      tagline: "Jeugdzorg met hart en toewijding.",
      copyright: "© Amicare-Zorg",
      columns: [
        { id: "brand", items: [{ type: "brand", label: "Amicare-Zorg" }] },
        { id: "contact", items: [{ type: "contact", label: "Contact" }] },
        { id: "nav", items: [{ type: "navigation", label: "Navigatie" }] },
      ],
    },
  },
  contact: { phone: null, address: null, social: [] },
  nap: {
    legalName: "Amicare-Zorg",
    country: "NL",
  },
  navHeader: [{ label: "Home", href: "/" }],
  navFooter: [{ label: "Home", href: "/" }],
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
        anchor: "top",
        eyebrow: inlineText("Amicare-Zorg"),
        headline: inlineText("Jeugdzorg met hart en toewijding"),
        subheadline: blockText("Persoonlijke begeleiding, rust en structuur voor jongeren en gezinnen die tijdelijk extra steun nodig hebben."),
        pills: [{ label: "Jeugdzorg" }, { label: "Begeleiding" }, { label: "Vertrouwen" }],
        cta: { label: "Neem contact op", href: "#contact" },
        image: { id: "amicare-bedroom", url: "/assets/bedroom.jpg", filename: "bedroom.jpg", alt: "Rustige kinderkamer" },
      },
      {
        blockType: "featureList",
        anchor: "werkwijze",
        title: inlineText("Werkwijze"),
        intro: blockText("Amicare werkt met duidelijke afspraken, korte lijnen en aandacht voor wat een jongere nodig heeft."),
        features: [
          { title: inlineText("Veiligheid"), description: blockText("Een rustige basis met voorspelbare begeleiding."), icon: "heart" },
          { title: inlineText("Samenwerking"), description: blockText("Afstemming met gezin, verwijzers en betrokken professionals."), icon: "users" },
          { title: inlineText("Ontwikkeling"), description: blockText("Praktische stappen richting zelfstandigheid en vertrouwen."), icon: "sparkles" },
        ],
      },
      {
        blockType: "richText",
        anchor: "over",
        body: blockRichText([
          {
            heading: "Over Amicare",
            text: "Amicare-Zorg biedt begeleiding vanuit betrokkenheid, duidelijkheid en respect voor de persoonlijke situatie van ieder kind en gezin.",
          },
          {
            heading: "Wat telt",
            text: "Een veilige omgeving, eerlijk contact en begeleiding die past bij het tempo van de jongere.",
          },
        ]),
      },
      {
        blockType: "cta",
        anchor: "contact",
        eyebrow: inlineText("Kennismaken"),
        headline: inlineText("Bespreek wat er nodig is"),
        description: blockText("Neem contact op om rustig te bekijken welke ondersteuning passend is."),
        primary: { label: "Mail Amicare", href: "mailto:info@ami-care.nl" },
      },
    ],
  },
]

const contactFields = [
  { name: "name", label: "Naam", type: "text" as const, required: true },
  { name: "email", label: "Email", type: "email" as const, required: true },
  { name: "phone", label: "Tel. nummer", type: "tel" as const, required: true },
  { name: "message", label: "Omschrijving project", type: "textarea" as const },
]

const quoteContactBlock = {
  blockType: "contactSection" as const,
  anchor: "contact-form",
  title: inlineText("Vraag hier uw vrijblijvende offerte aan"),
  description: blockText("Neem gerust contact met ons op en wij zoeken de beste optie voor u en uw project."),
  formName: "amblast-offerte",
  submitLabel: "Verzenden",
  fields: contactFields,
}

const directContactBlock = {
  blockType: "contactSection" as const,
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

const amblastSettings: GeneratedSiteSettings = {
  siteName: "Amblast | Facility Services",
  siteUrl: "https://amblast.nl",
  description: "Specialist in industriële schoonmaak in Limburg.",
  language: "nl-NL",
  contactEmail: "info@amblast.nl",
  branding: {
    primaryColor: "#ffd500",
    logo: { id: "amblast-logo", url: "/logo.png", filename: "logo.png", alt: "Amblast logo" },
    favicon: { id: "amblast-favicon", url: "/favicon.ico", filename: "favicon.ico", alt: "Amblast favicon" },
  },
  chrome: {
    header: { logo: { id: "amblast-logo", url: "/logo.png", filename: "logo.png", alt: "Amblast logo" } },
    footer: {
      tagline: "Specialist in industriële schoonmaak.",
      copyright: "© Amblast",
      columns: [
        { id: "contact", items: [{ type: "contact", label: "Contact" }] },
        { id: "info", items: [{ type: "business", label: "Info" }] },
        { id: "nav", items: [{ type: "navigation", label: "Navigatie" }] },
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
    { label: "Contact", href: "/contact" },
  ],
  navFooter: [
    { label: "Home", href: "/" },
    { label: "Over ons", href: "/over-ons" },
    { label: "Onze diensten", href: "/diensten" },
    { label: "Portfolio", href: "/portfolio" },
    { label: "Contact", href: "/contact" },
  ],
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
            text: "AMBLAST, Stationspark 189, 6042 AX Roermond. info@amblast.nl. +31 6 19 96 36 51. KvK: 72128690. BTW ID: NL002407752B08. IBAN: NL45 INGB 0008 6149 44. BIC: INGBNL2A.",
          },
        ]),
      },
      directContactBlock,
    ],
  },
]

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
    goals: ["CMS-backed legacy tenant parity", "Renderer-compatible data validation"],
    requestedPages: [{ slug: "index", title: "Home", purpose: "Homepage" }],
  },
  tenant: { name: "Amicare-Zorg", slug: "amicare", domain: "ami-care.nl", status: "active" },
  theme: amicareTheme,
  settings: amicareSettings,
  pages: amicarePages,
  blocks: canonicalBlocks.filter((block) => ["hero", "featureList", "richText", "cta", "contactSection"].includes(block.slug)),
  assets: [
    { id: "amicare-bedroom", url: "/assets/bedroom.jpg", filename: "bedroom.jpg", alt: "Rustige kinderkamer" },
    { id: "amicare-toys", url: "/assets/toys.jpg", filename: "toys.jpg", alt: "Speelgoed" },
  ],
  generatedAt: GENERATED_AT,
  generator: { name: "legacy-tenant-migration", version: "phase-4" },
}

export const amblastSiteGenerationSpec: SiteGenerationSpec = {
  schemaVersion: 1,
  intake: {
    businessName: "Amblast | Facility Services",
    tenantSlug: "amblast",
    primaryDomain: "amblast.nl",
    siteUrl: "https://amblast.nl",
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
      assets: [{ id: "amblast-logo", url: "/logo.png", filename: "logo.png", alt: "Amblast logo" }],
    },
  },
  tenant: { name: "Amblast | Facility Services", slug: "amblast", domain: "amblast.nl", status: "active" },
  theme: amblastTheme,
  settings: amblastSettings,
  pages: amblastPages,
  blocks: canonicalBlocks,
  assets: [
    { id: "amblast-logo", url: "/logo.png", filename: "logo.png", alt: "Amblast logo" },
    { id: "amblast-og", url: "/og-default.png", filename: "og-default.png", alt: "Amblast social image" },
    { id: "amblast-hero-home", url: "/uploads/hero/IMG_20210723_135545-scaled-e1631503963184.jpg", filename: "IMG_20210723_135545-scaled-e1631503963184.jpg", alt: "Industriële reiniging" },
    { id: "amblast-hero-services", url: "/uploads/hero/IMG_20210827_152238-scaled.jpg", filename: "IMG_20210827_152238-scaled.jpg", alt: "Amblast diensten" },
    { id: "amblast-hero-contact", url: "/uploads/hero/IMG_20210507_091012s-scaled.jpg", filename: "IMG_20210507_091012s-scaled.jpg", alt: "Contact met Amblast" },
  ],
  generatedAt: GENERATED_AT,
  generator: { name: "legacy-tenant-migration", version: "phase-4" },
}

export const amicarePublishedSiteSnapshot = toSnapshot(amicareSiteGenerationSpec, "tenant-amicare")
export const amblastPublishedSiteSnapshot = toSnapshot(amblastSiteGenerationSpec, "tenant-amblast")

export const tenantSiteGenerationSpecs = [amicareSiteGenerationSpec, amblastSiteGenerationSpec] as const
export const tenantPublishedSiteSnapshots = [amicarePublishedSiteSnapshot, amblastPublishedSiteSnapshot] as const
