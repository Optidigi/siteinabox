// src/lib/types.ts — mirror of orchestrator's site-converter scaffold.
// Each tenant's converted site gets its own copy at conversion time;
// this template carries the types so its own type-check (pnpm astro check)
// can resolve imports. Keep in sync with site-converter.md's types codeblock.

export type MediaRef =
  | number
  | string
  | { id: number | string; url?: string | null; filename?: string | null; alt?: string | null }
  | null

export type AnalyticsBlockMetadata = {
  sectionId?: string | null
  sectionType?: string | null
  sectionPosition?: number | null
  sectionAnchor?: string | null
  sectionVariant?: string | null
  blockPresetId?: string | null
  contentSignature?: string | null
}

export type FooterCompositionLink = { label?: string | null; href?: string | null }
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
  cta?: { label?: string | null; href?: string | null } | null
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
  primary?: { label?: string | null; href?: string | null } | null
  secondary?: { label?: string | null; href?: string | null } | null
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

// ---------------------------------------------------------------------------
// Rich Text node types
// ---------------------------------------------------------------------------
// MIRRORED FROM siab-payload/src/lib/richText/RtNode.ts
// Keep in sync with that file. If siab-payload's RtNode shape changes,
// update this file in lockstep.

export type RtMark = "bold" | "italic" | "underline" | "code" | "strikethrough"

export interface RtText {
  t: "text"
  v: string
  marks?: RtMark[]
  style?: string
  color?: string
  font?: string
}

export interface RtLink {
  t: "link"
  href: string
  rel?: "external" | "internal"
  children: RtInline[]
}

/** Soft line break — renders as `<br>`; inserted via Shift+Enter. */
export interface RtLineBreak {
  t: "linebreak"
}

export type RtInline = RtText | RtLink | RtLineBreak

export type RtAlign = "left" | "center" | "right" | "justify"

export interface RtParagraph  { t: "paragraph"; align?: RtAlign; children: RtInline[] }
export interface RtHeading    { t: "heading"; level: 2 | 3 | 4; align?: RtAlign; style?: string; children: RtInline[] }
export interface RtList       { t: "list"; ordered: boolean; items: RtListItem[] }
export interface RtListItem   { t: "listItem"; children: RtBlock[] }
export interface RtBlockquote { t: "blockquote"; children: RtBlock[] }
export interface RtDivider    { t: "divider" }

export interface RtThemed {
  t: "themed"
  id: string
  props: Record<string, unknown>
  children?: RtBlock[]
}

export type RtBlock =
  | RtParagraph
  | RtHeading
  | RtList
  | RtBlockquote
  | RtDivider
  | RtThemed

export interface RtBlockRoot  { t: "root"; variant: "block";  children: RtBlock[] }
export interface RtInlineRoot { t: "root"; variant: "inline"; children: RtInline[] }
export type RtRoot = RtBlockRoot | RtInlineRoot

export type RtNode = RtRoot | RtBlock | RtInline | RtListItem

export type Page = {
  id?: string
  slug: string
  title: string
  status?: "draft" | "published"
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
  updatedAt?: string
}
