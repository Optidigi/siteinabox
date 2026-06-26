import type { RtRoot } from "./rich-text"

export const SITE_BLOCK_SLUGS = [
  "hero",
  "featureList",
  "testimonials",
  "faq",
  "cta",
  "richText",
  "contactSection",
] as const

export type SiteBlockSlug = (typeof SITE_BLOCK_SLUGS)[number]

export const SITE_PARITY_BLOCK_SLUGS = [
  "mediaHero",
  "infoCardList",
  "serviceCarousel",
  "beforeAfterGallery",
  "contactDetails",
] as const

export const SITE_GENERATION_BLOCK_SLUGS = [
  ...SITE_BLOCK_SLUGS,
  ...SITE_PARITY_BLOCK_SLUGS,
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
  sectionVariant?: string | null
  blockPresetId?: string | null
  contentSignature?: string | null
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

export type HeroBlock = {
  blockType: "hero"
  analytics?: AnalyticsBlockMetadata | null
  anchor?: string | null
  eyebrow?: RtRoot | null
  headline: RtRoot
  subheadline?: RtRoot | null
  pills?: Array<{ label: string; id?: string | null }>
  cta?: LinkRef | null
  image?: MediaRef
}

export type MediaHeroBlock = {
  blockType: "mediaHero"
  analytics?: AnalyticsBlockMetadata | null
  anchor?: string | null
  eyebrow?: RtRoot | null
  headline: RtRoot
  subheadline?: RtRoot | null
  cta?: LinkRef | null
  secondary?: LinkRef | null
  backgroundImage: MediaRef
  foregroundImage?: MediaRef
  overlay?: {
    color?: string | null
    opacity?: number | null
  } | null
  minHeight?: "compact" | "standard" | "tall" | "viewport" | null
  contentAlign?: "left" | "center" | "right" | null
  contentWidth?: "narrow" | "wide" | null
  shapeDividers?: {
    top?: "mountains" | "wave-brush" | "none" | null
    bottom?: "mountains" | "wave-brush" | "none" | null
  } | null
  priority?: boolean | null
}

export type FeatureListBlock = {
  blockType: "featureList"
  analytics?: AnalyticsBlockMetadata | null
  anchor?: string | null
  title?: RtRoot | null
  intro?: RtRoot | null
  features: Array<{
    title: RtRoot
    description?: RtRoot | null
    icon?: string | null
  }>
}

export type InfoCardListBlock = {
  blockType: "infoCardList"
  analytics?: AnalyticsBlockMetadata | null
  anchor?: string | null
  title?: RtRoot | null
  intro?: RtRoot | null
  layout?: "row" | "grid" | "stack" | null
  iconPosition?: "top" | "left" | null
  items: Array<{
    title: RtRoot
    description?: RtRoot | null
    icon?: string | null
    image?: MediaRef
    link?: LinkRef | null
    animation?: "fadeInUp" | "fadeInDown" | "float" | "grow" | "none" | null
  }>
}

export type ServiceCarouselBlock = {
  blockType: "serviceCarousel"
  analytics?: AnalyticsBlockMetadata | null
  anchor?: string | null
  title?: RtRoot | null
  intro?: RtRoot | null
  layout?: "carousel" | "grid" | null
  items: Array<{
    title: RtRoot
    description?: RtRoot | null
    image?: MediaRef
    cta?: LinkRef | null
  }>
  carousel?: {
    slidesPerView?: number | null
    slidesPerViewTablet?: number | null
    slidesPerViewMobile?: number | null
    spaceBetween?: number | null
    autoplay?: boolean | null
    autoplayDelayMs?: number | null
    loop?: boolean | null
    pagination?: "bullets" | "fraction" | "none" | null
    pauseOnInteraction?: boolean | null
  } | null
}

export type BeforeAfterGalleryBlock = {
  blockType: "beforeAfterGallery"
  analytics?: AnalyticsBlockMetadata | null
  anchor?: string | null
  title?: RtRoot | null
  intro?: RtRoot | null
  pairs: Array<{
    before: MediaRef
    after: MediaRef
    beforeLabel?: string | null
    afterLabel?: string | null
    caption?: RtRoot | null
    initialRatio?: number | null
    orientation?: "horizontal" | "vertical" | null
  }>
}

export type ContactDetailsBlock = {
  blockType: "contactDetails"
  analytics?: AnalyticsBlockMetadata | null
  anchor?: string | null
  title?: RtRoot | null
  intro?: RtRoot | null
  layout?: "cards" | "split" | "list" | null
  items: Array<{
    kind?: "phone" | "email" | "address" | "hours" | "legal" | "custom" | null
    label: string
    value: RtRoot
    href?: string | null
    icon?: string | null
    image?: MediaRef
  }>
  legal?: {
    kvkNumber?: string | null
    btwId?: string | null
    iban?: string | null
    bic?: string | null
  } | null
}

export type TestimonialsBlock = {
  blockType: "testimonials"
  analytics?: AnalyticsBlockMetadata | null
  anchor?: string | null
  title?: string | null
  items: Array<{
    quote: string
    author: string
    role?: string | null
    avatar?: MediaRef
  }>
}

export type FAQBlock = {
  blockType: "faq"
  analytics?: AnalyticsBlockMetadata | null
  anchor?: string | null
  title?: RtRoot | null
  items: Array<{ question: RtRoot; answer: RtRoot }>
}

export type CTABlock = {
  blockType: "cta"
  analytics?: AnalyticsBlockMetadata | null
  anchor?: string | null
  eyebrow?: RtRoot | null
  headline: RtRoot
  description?: RtRoot | null
  primary?: LinkRef | null
  secondary?: LinkRef | null
  backgroundImage?: MediaRef
}

export type RichTextBlock = {
  blockType: "richText"
  analytics?: AnalyticsBlockMetadata | null
  anchor?: string | null
  body: RtRoot
}

export type ContactSectionBlock = {
  blockType: "contactSection"
  analytics?: AnalyticsBlockMetadata | null
  anchor?: string | null
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

export type Block =
  | HeroBlock
  | MediaHeroBlock
  | FeatureListBlock
  | InfoCardListBlock
  | ServiceCarouselBlock
  | BeforeAfterGalleryBlock
  | ContactDetailsBlock
  | TestimonialsBlock
  | FAQBlock
  | CTABlock
  | RichTextBlock
  | ContactSectionBlock

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
      logo?: MediaRef
      behavior?: "static" | "sticky" | null
      activeMode?: "path" | "anchor" | "none" | null
      mobileMenu?: "dropdown" | "drawer" | null
      cta?: LinkRef | null
    } | null
    footer?: {
      logo?: MediaRef
      tagline?: string | null
      copyright?: string | null
      legalLinks?: LinkRef[] | null
      columns?: FooterCompositionColumn[] | null
    } | null
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
