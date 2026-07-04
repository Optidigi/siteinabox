import type { RtRoot } from "./rich-text"

export const SITE_BLOCK_SLUGS = [
  "hero",
  "featureList",
  "testimonials",
  "faq",
  "cta",
  "richText",
  "contactSection",
  "pricing",
  "stats",
  "logoCloud",
  "gallery",
  "team",
  "blogCards",
] as const

export type SiteBlockSlug = (typeof SITE_BLOCK_SLUGS)[number]

export const SITE_DEFERRED_MARKETING_BLOCK_SLUGS = [
] as const

export type SiteDeferredMarketingBlockSlug = (typeof SITE_DEFERRED_MARKETING_BLOCK_SLUGS)[number]
export const SITE_GENERATION_BLOCK_SLUGS = [
  ...SITE_BLOCK_SLUGS,
  ...SITE_DEFERRED_MARKETING_BLOCK_SLUGS,
] as const

export type SiteGenerationBlockSlug = (typeof SITE_GENERATION_BLOCK_SLUGS)[number]

export type MediaRef =
  | number
  | string
  | {
      id?: number | string
      url?: string | null
      filename?: string | null
      alt?: string | null
      width?: number | null
      height?: number | null
    }
  | null

export type RtField = RtRoot | null

export type AnalyticsBlockMetadata = {
  sectionId?: string | null
  sectionType?: string | null
  sectionPosition?: number | null
  sectionAnchor?: string | null
  blockPresetId?: string | null
  contentSignature?: string | null
}

export type BlockInstanceMetadata = Record<string, unknown>

export type BlockInstanceBase = {
  designVariant?: string | null
  metadata?: BlockInstanceMetadata | null
  analytics?: AnalyticsBlockMetadata | null
  anchor?: string | null
}

export type LinkRef = { label?: string | null; href?: string | null }

export type FormProviderConfig = {
  provider?: "siab" | "web3forms" | "custom" | "mailto" | null
  action?: string | null
  method?: "GET" | "POST" | null
  hiddenFields?: Array<{ name: string; value?: string | null }> | null
  honeypotField?: string | null
  fallbackHref?: string | null
  successMessage?: string | null
  errorMessage?: string | null
  requiresConsent?: boolean | null
  analyticsEnabled?: boolean | null
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

export type HeroBlock = BlockInstanceBase & {
  blockType: "hero"
  eyebrow?: RtRoot | null
  headline: RtRoot
  subheadline?: RtRoot | null
  pills?: Array<{ label: string; id?: string | null }>
  cta?: LinkRef | null
  image?: MediaRef
}

export type FeatureListBlock = BlockInstanceBase & {
  blockType: "featureList"
  title?: RtRoot | null
  intro?: RtRoot | null
  features: Array<{
    title: RtRoot
    description?: RtRoot | null
    icon?: string | null
  }>
}

export type TestimonialsBlock = BlockInstanceBase & {
  blockType: "testimonials"
  title?: string | null
  items: Array<{
    quote: string
    author: string
    role?: string | null
    avatar?: MediaRef
  }>
}

export type FAQBlock = BlockInstanceBase & {
  blockType: "faq"
  title?: RtRoot | null
  items: Array<{ question: RtRoot; answer: RtRoot }>
}

export type CTABlock = BlockInstanceBase & {
  blockType: "cta"
  eyebrow?: RtRoot | null
  headline: RtRoot
  description?: RtRoot | null
  primary?: LinkRef | null
  secondary?: LinkRef | null
  backgroundImage?: MediaRef
}

export type RichTextBlock = BlockInstanceBase & {
  blockType: "richText"
  body: RtRoot
}

export type ContactSectionBlock = BlockInstanceBase & {
  blockType: "contactSection"
  title?: RtRoot | null
  description?: RtRoot | null
  formName: string
  submitLabel?: string | null
  fields: Array<{
    name: string
    label: string
    type: "text" | "email" | "tel" | "textarea"
    required?: boolean
    placeholder?: string | null
    maxLength?: number | null
  }>
  provider?: FormProviderConfig | null
}

export type PricingBlock = BlockInstanceBase & {
  blockType: "pricing"
  title?: RtRoot | null
  intro?: RtRoot | null
  plans: Array<{
    title: RtRoot
    description?: RtRoot | null
    price?: string | null
    period?: string | null
    features?: Array<{ label: RtRoot; included?: boolean | null }> | null
    cta?: LinkRef | null
    badge?: string | null
    highlighted?: boolean | null
  }>
}

export type StatsBlock = BlockInstanceBase & {
  blockType: "stats"
  title?: RtRoot | null
  intro?: RtRoot | null
  items: Array<{
    value: string
    label: string
    description?: RtRoot | null
  }>
}

export type LogoCloudBlock = BlockInstanceBase & {
  blockType: "logoCloud"
  title?: RtRoot | null
  intro?: RtRoot | null
  logos: Array<{
    name: string
    image: MediaRef
    href?: string | null
  }>
}

export type GalleryBlock = BlockInstanceBase & {
  blockType: "gallery"
  title?: RtRoot | null
  intro?: RtRoot | null
  images: Array<{
    image: MediaRef
    caption?: RtRoot | null
    link?: LinkRef | null
  }>
  cta?: LinkRef | null
}

export type TeamBlock = BlockInstanceBase & {
  blockType: "team"
  title?: RtRoot | null
  intro?: RtRoot | null
  members: Array<{
    name: string
    role?: string | null
    bio?: RtRoot | null
    image?: MediaRef
    links?: LinkRef[] | null
  }>
}

export type BlogCardsBlock = BlockInstanceBase & {
  blockType: "blogCards"
  title?: RtRoot | null
  intro?: RtRoot | null
  posts: Array<{
    title: RtRoot
    excerpt?: RtRoot | null
    image?: MediaRef
    href?: string | null
    date?: string | null
    author?: string | null
    cta?: LinkRef | null
  }>
}

export type Block =
  | HeroBlock
  | FeatureListBlock
  | TestimonialsBlock
  | FAQBlock
  | CTABlock
  | RichTextBlock
  | ContactSectionBlock
  | PricingBlock
  | StatsBlock
  | LogoCloudBlock
  | GalleryBlock
  | TeamBlock
  | BlogCardsBlock

export type Page = {
  id?: string
  slug: string
  title: string
  status?: "draft" | "published"
  analytics?: Record<string, unknown> | null
  blocks: Block[]
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
export type NavLink = { label: string; href: string; external?: boolean }
export type Alias = { host: string }
export type ServiceAreaEntry = { name: string }

export type SiteChromeVariant = "default" | "amicareZen"

export type SiteChromeBanner = {
  variant?: SiteChromeVariant | null
  visible?: boolean | null
  title?: string | null
  message: string
  link?: LinkRef | null
  dismissible?: boolean | null
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
    header?: {
      variant?: SiteChromeVariant | null
      logo?: MediaRef
      behavior?: "static" | "sticky" | null
      activeMode?: "path" | "anchor" | "none" | null
      mobileMenu?: "dropdown" | "drawer" | null
      cta?: LinkRef | null
    } | null
    footer?: {
      variant?: SiteChromeVariant | null
      logo?: MediaRef
      tagline?: string | null
      copyright?: string | null
      legalLinks?: LinkRef[] | null
      columns?: FooterCompositionColumn[] | null
    } | null
    banner?: SiteChromeBanner | null
  } | null
  maintenance?: {
    enabled?: boolean | null
    message?: string | null
  } | null
  contact?: {
    phone?: string | null
    address?: string | null
    social?: SocialLink[]
  } | null
  nap?: NAP | null
  hours?: OpeningHours[]
  serviceArea?: ServiceAreaEntry[]
  navHeader?: NavLink[]
  navFooter?: NavLink[]
  analytics?: Record<string, unknown> | null
  analyticsConsent?: AnalyticsConsentSettings | null
  seoJsonLd?: JsonLdSettings | null
  updatedAt?: string
}
