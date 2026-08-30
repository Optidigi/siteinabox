import type { MediaRef } from "../site"
import type { GeneratedPageSpec, GeneratedSiteSettings, PublishedSiteSnapshot, SiteGenerationSpec, ThemeTokenSpec } from "../generation"

const GENERATED_AT = "2026-08-13T00:00:00.000Z"

export const amicareTheme: ThemeTokenSpec = {
  version: 3,
  appearance: { mode: "light", backgroundMode: "image" },
  colors: { schemeId: "terracotta-warm" },
  fonts: { schemeId: "classic-editorial" },
  shape: { schemeId: "soft" },
}

const amicareToys = {
  id: "amicare-toys",
  url: "/media/toys.jpg",
  filename: "toys.jpg",
  alt: "Speelgoed in een rustige ruimte",
  width: 1600,
  height: 1067,
} as const

const amicareBedroom = {
  id: "amicare-bedroom",
  url: "/media/bedroom.jpg",
  filename: "bedroom.jpg",
  alt: "Rustige kinderkamer",
  width: 1600,
  height: 1067,
} as const

const amicareLogo = {
  id: "amicare-logo-svg",
  url: "/amicare-logo.svg",
  filename: "amicare-logo.svg",
  alt: "Amicare-Zorg logo",
  width: 470,
  height: 144,
} as const

const amicareFavicon = {
  id: "amicare-favicon-svg",
  url: "/favicon.svg",
  filename: "favicon.svg",
  alt: "Amicare-Zorg favicon",
  width: 168,
  height: 168,
} as const

const amicareSettings: GeneratedSiteSettings = {
  siteName: "Amicare-Zorg",
  siteUrl: "https://ami-care.nl",
  aliases: [{ host: "www.ami-care.nl" }],
  description: "Jeugdzorg met hart en toewijding.",
  language: "nl",
  contactEmail: "info@ami-care.nl",
  branding: {
    primaryColor: "#a04e32",
    logo: amicareLogo,
    favicon: amicareFavicon,
  },
  chrome: {
    navbar: {
      variant: "navbar-01",
      placement: "sticky",
      activeMode: "anchor",
      mobileMenu: "dropdown",
      showThemeToggle: true,
      cta: { label: "Contact", href: "#contact" },
    },
    footer: {
      variant: "footer-01",
      tagline: "Jeugdzorg met hart en toewijding.",
      copyright: "© 2026 Amicare-Zorg",
    },
  },
  analytics: {
    enabled: true,
    provider: "posthog",
    dashboardVisible: true,
    consentMode: "required",
    conversionGoals: { acceptedForms: true, contactClicks: [] },
  },
  analyticsConsent: {
    enabled: true,
    provider: "posthog",
    consentStorageKey: "siab_cookie_consent_v1",
    consentVersion: "2026-07-07.1",
    captureSections: true,
    captureActions: true,
    captureForms: true,
  },
  contact: { phone: null, address: null, social: [] },
  nap: {
    legalName: "AMICARE ZORG",
    kvkNumber: "99968347",
    establishmentNumber: "000065004922",
    country: "NL",
  },
  serviceArea: [{ name: "Nederland" }],
  navigation: {
    primary: [
      { label: "Werkwijze", href: "#werkwijze" },
      { label: "Over Amicare", href: "#over" },
      { label: "Wat telt", href: "#wat-telt" },
      { label: "Contact", href: "#contact" },
    ],
    footer: [
      { label: "Werkwijze", href: "#werkwijze" },
      { label: "Over Amicare", href: "#over" },
      { label: "Wat telt", href: "#wat-telt" },
      { label: "Contact", href: "#contact" },
    ],
  },
  updatedAt: GENERATED_AT,
}

const amicareHome: GeneratedPageSpec = {
  id: "amicare-home",
  slug: "index",
  title: "Amicare-Zorg",
  status: "published",
  updatedAt: GENERATED_AT,
  blocks: [
    {
      blockType: "hero",
      variant: "hero-05",
      heading: "Jeugdzorg met hart en toewijding",
      body: "Al jarenlang werk ik met toewijding in de jeugdzorg. Dit is het vak dat ik ken — waar mijn hart ligt, en waar ik mij dagelijks voor inzet.",
      primaryAction: { label: "Neem contact op", href: "mailto:info@ami-care.nl" },
      secondaryAction: { label: "Bekijk mijn werkwijze", href: "#werkwijze" },
      image: amicareToys,
    },
    {
      blockType: "services",
      variant: "services-01",
      anchor: "werkwijze",
      heading: "Wat voor mij centraal staat.",
      intro: "Drie dingen",
      items: [
        {
          title: "Aandacht",
          body: "Echt luisteren naar wat een jongere of een gezin op dat moment nodig heeft. Zonder aannames vooraf.",
          icon: "message",
        },
        {
          title: "Betrokkenheid",
          body: "Naast mensen staan, niet erboven. Werken vanuit gelijkwaardigheid en vertrouwen.",
          icon: "heart",
        },
        {
          title: "Continuïteit",
          body: "Aanwezig blijven, ook als trajecten lang of ingewikkeld worden. De relatie als basis.",
          icon: "clock",
        },
      ],
    },
    {
      blockType: "cta",
      variant: "cta-02",
      anchor: "over",
      heading: "Het vak waar mijn hart ligt.",
      body: "Tegelijk blijf ik mijzelf graag ontwikkelen, en sta ik open voor nieuwe uitdagingen en opdrachten binnen het werkveld. Naast mijn werk ben ik moeder, en geniet ik van het drukke, gezellige gezinsleven. De combinatie van werk en gezin maakt mijn dagen dynamisch — en waardevol.",
      primaryAction: { label: "Neem contact op", href: "mailto:info@ami-care.nl" },
    },
    {
      blockType: "cta",
      variant: "cta-01",
      anchor: "wat-telt",
      heading: "Vertrouwen ontstaat in de tijd, niet in één gesprek.",
      body: "Daarom werk ik graag in trajecten waar continuïteit en kleine stappen het echte werk doen — voor jongeren, voor gezinnen, en voor de mensen om hen heen.",
      primaryAction: { label: "Neem contact op", href: "mailto:info@ami-care.nl" },
      image: amicareBedroom,
    },
    {
      blockType: "services",
      variant: "services-02",
      anchor: "contact",
      heading: "Wilt u meer informatie of in contact komen?",
      items: [
        {
          title: "E-mail",
          body: "Neem rechtstreeks contact op.",
          icon: "message",
          action: { label: "info@ami-care.nl", href: "mailto:info@ami-care.nl" },
        },
        {
          title: "Werkgebied",
          body: "Jeugdzorg voor jongeren en gezinnen.\nNederland",
          icon: "globe",
        },
        {
          title: "Bedrijfsgegevens",
          body: "KVK 99968347\nVestigingsnummer 000065004922",
          icon: "building",
        },
      ],
    },
  ],
  seo: {
    title: "Amicare-Zorg | Jeugdzorg met hart en toewijding",
    description: "Persoonlijke jeugdzorg voor jongeren en gezinnen, met aandacht, betrokkenheid en continuïteit.",
    ogImage: amicareToys,
  },
}

export const amicareSiteGenerationSpec: SiteGenerationSpec = {
  schemaVersion: 1,
  intake: {
    businessName: "Amicare-Zorg",
    tenantSlug: "ami-care",
    primaryDomain: "ami-care.nl",
    siteUrl: "https://ami-care.nl",
    language: "nl",
    industry: "Jeugdzorg",
    serviceArea: ["Nederland"],
    goals: ["contact"],
    requestedPages: [{ slug: "index", title: "Home", purpose: "Introduce the service" }],
  },
  tenant: { name: "Amicare-Zorg", slug: "ami-care", domain: "ami-care.nl", status: "active" },
  theme: amicareTheme,
  settings: amicareSettings,
  pages: [amicareHome],
  assets: [amicareToys, amicareBedroom, amicareLogo, amicareFavicon],
  generatedAt: GENERATED_AT,
  generator: { name: "sitegen-owned-blocks", version: "1" },
}

function mediaManifestKey(media: MediaRef): string | null {
  if (!media) return null
  if (typeof media === "string" || typeof media === "number") return String(media)
  return media.filename ?? media.url ?? (media.id === undefined ? null : String(media.id))
}

function toSnapshot(spec: SiteGenerationSpec, tenantId: string): PublishedSiteSnapshot {
  const media = (spec.assets ?? []).filter((asset): asset is Exclude<MediaRef, null> => Boolean(asset))
  return {
    schemaVersion: 1,
    tenantId,
    tenantSlug: spec.tenant.slug,
    domain: spec.tenant.domain,
    siteUrl: spec.settings.siteUrl,
    manifest: {
      tenantId,
      version: 1,
      updatedAt: GENERATED_AT,
      entries: [
        { type: "settings", key: "site-settings", updatedAt: GENERATED_AT },
        ...spec.pages.map((page) => ({ type: "page" as const, key: page.slug, updatedAt: page.updatedAt ?? GENERATED_AT })),
        ...media.flatMap((asset) => {
          const key = mediaManifestKey(asset)
          return key ? [{ type: "media" as const, key, updatedAt: GENERATED_AT }] : []
        }),
      ],
    },
    settings: spec.settings,
    pages: spec.pages.map((page) => ({ ...page, status: "published" as const, updatedAt: page.updatedAt ?? GENERATED_AT })),
    theme: spec.theme,
    media,
    publishedAt: GENERATED_AT,
  }
}

export const amicarePublishedSiteSnapshot = toSnapshot(amicareSiteGenerationSpec, "tenant-amicare")
export const tenantSiteGenerationSpecs = [amicareSiteGenerationSpec] as const
export const tenantPublishedSiteSnapshots = [amicarePublishedSiteSnapshot] as const
