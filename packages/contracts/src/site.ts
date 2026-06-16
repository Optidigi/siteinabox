import type { RtRoot } from "./rich-text"

export type MediaRef =
  | number
  | string
  | { id: number | string; url?: string | null; filename?: string | null; alt?: string | null }
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
    header?: { logo?: MediaRef } | null
    footer?: {
      logo?: MediaRef
      tagline?: string | null
      copyright?: string | null
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
  updatedAt?: string
}
