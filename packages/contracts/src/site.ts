import { SITEGEN_BLOCK_TYPES } from "./blocks"
import type { Block as CanonicalBlock } from "./blocks"
import type { CanonicalMediaRef } from "./blocks/common"
import type { AppointmentScheduleSettings } from "./appointments"

export { SITEGEN_BLOCK_TYPES }
export type { SitegenBlockType } from "./blocks"

export const SITE_BLOCK_SLUGS = [...SITEGEN_BLOCK_TYPES] as const
export type SiteBlockSlug = (typeof SITE_BLOCK_SLUGS)[number]

export type MediaRef =
  | CanonicalMediaRef
  | {
      id?: number | string
      url?: string | null
      filename?: string | null
      alt?: string | null
      width?: number | null
      height?: number | null
    }
  | null
export type RtField = import("./rich-text").RtRoot | null
export type LinkRef = {
  label?: string | null
  href?: string | null
  external?: boolean | null
}
export type FooterCompositionLink = LinkRef
export type FooterCompositionItem = {
  id?: string | null
  type?: "brand" | "text" | "links" | "contact" | "business" | "navigation" | null
  label?: string | null
  text?: string | null
  links?: FooterCompositionLink[] | null
}
export type FooterCompositionColumn = {
  id?: string | null
  items?: FooterCompositionItem[] | null
}

export type {
  AboutBlock,
  ContactBlock,
  CtaBlock,
  CtaVariant,
  FaqBlock,
  AnyHeroBlock,
  HeroBlock,
  HeroBlockType,
  HeroServiceHighlight,
  HeroVariant,
  ProcessBlock,
  PricingBlock,
  ReviewsBlock,
  ServiceIconName,
  ServicesBlock,
  ServicesVariant,
  WorkBlock,
} from "./blocks"

export type Block = CanonicalBlock

export type Page = {
  id?: string
  slug: string
  title: string
  status?: "draft" | "published"
  analytics?: Record<string, unknown> | null
  blocks: CanonicalBlock[]
  seo?: {
    title?: string | null
    description?: string | null
    ogImage?: MediaRef
  }
  updatedAt: string
}

export type NAP = {
  legalName?: string | null
  kvkNumber?: string | null
  establishmentNumber?: string | null
  streetAddress?: string | null
  city?: string | null
  region?: string | null
  postalCode?: string | null
  country?: string | null
}

export type OpeningHours = {
  day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday"
  open?: string | null
  close?: string | null
  closed?: boolean
}

export type SocialLink = { platform: string; url: string }
export type NavigationIcon = "backpack" | "cake-slice" | "coffee" | "grape" | "hotel" | "ice-cream" | "map-pin" | "package" | "pizza" | "plane" | "sandwich" | "smile"

export const NAVBAR_VARIANTS = ["navbar-01", "navbar-02", "navbar-03"] as const
export type NavbarVariant = (typeof NAVBAR_VARIANTS)[number]
export const DEFAULT_NAVBAR_VARIANT = "navbar-01" satisfies NavbarVariant

export const FOOTER_VARIANTS = ["footer-01"] as const
export type FooterVariant = (typeof FOOTER_VARIANTS)[number]
export const DEFAULT_FOOTER_VARIANT = "footer-01" satisfies FooterVariant

export const CONSENT_VARIANTS = ["consent-01"] as const
export type ConsentVariant = (typeof CONSENT_VARIANTS)[number]
export const DEFAULT_CONSENT_VARIANT = "consent-01" satisfies ConsentVariant

export const NAVBAR_PLACEMENTS = ["sticky", "hero-overlay"] as const
export type NavbarPlacement = (typeof NAVBAR_PLACEMENTS)[number]
export const DEFAULT_NAVBAR_PLACEMENT = "sticky" satisfies NavbarPlacement

export type NavLink = {
  label: string
  href?: string | null
  external?: boolean
  description?: string | null
  icon?: NavigationIcon | null
  children?: NavLink[] | null
}
export type SiteNavbar = {
  variant: NavbarVariant
  placement: NavbarPlacement
  logo?: MediaRef
  activeMode?: "path" | "anchor" | "none" | null
  mobileMenu?: "dropdown" | "drawer" | null
  showThemeToggle?: boolean | null
  cta?: LinkRef | null
}
export type SiteFooter = {
  variant: FooterVariant
  logo?: MediaRef
  tagline?: string | null
  copyright?: string | null
  legalLinks?: LinkRef[] | null
  columns?: FooterCompositionColumn[] | null
  newsletter?: {
    title?: string | null
    placeholder?: string | null
    submitLabel?: string | null
    action?: string | null
    method?: "GET" | "POST" | null
  } | null
}
export type Alias = { host: string }
export type ServiceAreaEntry = { name: string }

export type SiteAnnouncement = {
  visible?: boolean | null
  title?: string | null
  message?: string | null
  link?: LinkRef | null
  dismissible?: boolean | null
}

export type SiteConsent = {
  variant: ConsentVariant
  visible?: boolean | null
  title?: string | null
  message?: string | null
  acceptLabel?: string | null
  allowSelectionLabel?: string | null
  rejectLabel?: string | null
  necessaryLabel?: string | null
  preferencesLabel?: string | null
  statisticsLabel?: string | null
  marketingLabel?: string | null
  /** Retained so older published snapshots remain readable; the current UI uses direct category switches. */
  manageLabel?: string | null
  privacyLink?: LinkRef | null
}

export type JsonLdSettings = {
  organization?: {
    enabled?: boolean | null
    type?: "Organization" | "LocalBusiness" | "ProfessionalService" | "HomeAndConstructionBusiness" | null
    name?: string | null
    url?: string | null
    logo?: MediaRef
    sameAs?: string[] | null
  } | null
  localBusiness?: {
    enabled?: boolean | null
    type?: "LocalBusiness" | "ProfessionalService" | "HomeAndConstructionBusiness" | null
    name?: string | null
    description?: string | null
    telephone?: string | null
    email?: string | null
    priceRange?: string | null
    serviceArea?: string[] | null
  } | null
}

export type AnalyticsConsentSettings = {
  enabled?: boolean | null
  provider?: "posthog" | "custom" | null
  consentStorageKey?: string | null
  consentVersion?: string | null
  captureSections?: boolean | null
  captureActions?: boolean | null
  captureForms?: boolean | null
}

export type TenantPrivacyDisclosure = {
  enabled?: boolean | null
  mode?: "template" | "custom" | null
  title?: string | null
  body?: RtField
  version: string
  effectiveAt: string
  controller: {
    legalName: string
    tradeName?: string | null
    email: string
    privacyEmail?: string | null
    kvkNumber?: string | null
    address?: string | null
  }
  contactMethods?: {
    email?: boolean | null
    phone?: boolean | null
    whatsapp?: boolean | null
    forms?: {
      enabled: boolean
      mode: "direct" | "forwarded" | "cms"
      retention?:
        | { kind: "days"; days: number }
        | { kind: "active_agreement" }
        | null
    } | null
  } | null
  marketingTechnologies?: Array<{
    name: string
    purpose: string
  }> | null
  additionalProcessors?: Array<{
    name: string
    purpose: string
    location?: string | null
  }> | null
}

export type SiteSettings = {
  siteName: string
  siteUrl: string
  description?: string | null
  language: string
  aliases?: Alias[]
  contactEmail?: string | null
  branding?: {
    logo?: MediaRef
    favicon?: MediaRef
    primaryColor?: string | null
  } | null
  chrome?: {
    navbar?: SiteNavbar | null
    footer?: SiteFooter | null
    announcement?: SiteAnnouncement | null
  } | null
  systemTemplates?: {
    notFound?: {
      heading?: string | null
      body?: string | null
      primaryAction?: LinkRef | null
    } | null
  } | null
  maintenance?: {
    enabled?: boolean | null
    message?: string | null
  } | null
  consent?: SiteConsent | null
  contact?: {
    phone?: string | null
    address?: string | null
    social?: SocialLink[]
  } | null
  nap?: NAP | null
  hours?: OpeningHours[]
  serviceArea?: ServiceAreaEntry[]
  navigation?: {
    primary?: NavLink[]
    footer?: NavLink[]
  } | null
  analytics?: Record<string, unknown> | null
  analyticsConsent?: AnalyticsConsentSettings | null
  privacyDisclosure?: TenantPrivacyDisclosure | null
  appointments?: AppointmentScheduleSettings | null
  seoJsonLd?: JsonLdSettings | null
  updatedAt?: string
}
