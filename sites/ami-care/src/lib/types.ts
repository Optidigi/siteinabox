// src/lib/types.ts — auto-scaffolded shape; mirrors siab-payload/src/blocks/*.ts.
//
// Rich text fields are RtRoot (jsonb) trees per siab-payload's rich text v2
// contract. See ./richText.ts for the shape and
// ../components/cms/RtNodeRenderer.tsx for the renderer.

import type { RtRoot } from "./richText"

// Upload fields are projected to disk by Payload's `projectPageToDisk` hook
// with depth>=1, so they arrive as full Media-like objects (not bare ids).
// MediaRef accepts either shape so the renderer can degrade gracefully if
// a tenant's data was projected without depth, but production sites should
// always carry the populated object (with `.url`).
export type MediaRef =
  | number
  | string
  | { id: number | string; url?: string | null; filename?: string | null; alt?: string | null }
  | null

// Rich text fields — strict RtRoot. siab-payload's validateRichTextOnSave
// beforeValidate hook rejects any non-RtRoot write at save time, so the
// `| string` legacy arm is dead code on the producer side.
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

export type HeroBlock = {
  blockType: "hero"
  analytics?: AnalyticsBlockMetadata | null
  eyebrow?: RtField
  headline: RtField
  subheadline?: RtField
  cta?: { label?: string | null; href?: string | null } | null
  image?: MediaRef  // populated Media object (preferred) or bare id; resolved by Blocks.astro
  pills?: Array<{ label: string }> | null
  anchor?: string | null
}

export type FeatureListBlock = {
  blockType: "featureList"
  analytics?: AnalyticsBlockMetadata | null
  title?: RtField
  intro?: RtField
  features: Array<{
    title: RtField
    description?: RtField
    icon?: string | null  // lucide-react icon name
  }>
  anchor?: string | null
}

export type TestimonialsBlock = {
  blockType: "testimonials"
  analytics?: AnalyticsBlockMetadata | null
  title?: string | null
  items: Array<{
    quote: string
    author: string
    role?: string | null
    avatar?: MediaRef  // populated Media object (preferred) or bare id
  }>
  anchor?: string | null
}

export type FAQBlock = {
  blockType: "faq"
  analytics?: AnalyticsBlockMetadata | null
  title?: RtField
  items: Array<{ question: RtField; answer: RtField }>
  anchor?: string | null
}

export type CTABlock = {
  blockType: "cta"
  analytics?: AnalyticsBlockMetadata | null
  eyebrow?: RtField
  headline: RtField
  description?: RtField
  primary?: { label?: string | null; href?: string | null } | null
  secondary?: { label?: string | null; href?: string | null } | null
  backgroundImage?: MediaRef
  anchor?: string | null
}

export type RichTextBlock = {
  blockType: "richText"
  analytics?: AnalyticsBlockMetadata | null
  body: RtField
  anchor?: string | null
}

export type ContactSectionBlock = {
  blockType: "contactSection"
  analytics?: AnalyticsBlockMetadata | null
  title?: RtField
  description?: RtField
  formName: string
  submitLabel?: string | null
  fields: Array<{
    name: string
    label: string
    type: "text" | "email" | "tel" | "textarea"
    required?: boolean
  }>
  anchor?: string | null
}

export type Block =
  | HeroBlock
  | FeatureListBlock
  | TestimonialsBlock
  | FAQBlock
  | CTABlock
  | RichTextBlock
  | ContactSectionBlock

// Page matches siab-payload's pageToJson projection shape:
//   { title, slug, status, blocks, seo?: { title?, description?, ogImage? }, updatedAt }
export type Page = {
  id?: string;
  slug: string;
  title: string;
  status?: "draft" | "published";
  analytics?: Record<string, unknown> | null;
  blocks: Block[];
  seo?: {
    title?: string | null;
    description?: string | null;
    ogImage?: MediaRef;
  };
  updatedAt: string;
};

// SiteSettings type — mirrors siab-payload's settingsToJson projection
// (see /home/shimmy/Desktop/env/siab/siab-payload/src/lib/projection/settingsToJson.ts).
//
// The orchestrator's scaffolded SiteSettings type mirrors the OLDER template's
// src/content/site.ts SiteConfig (brand/primaryDomain/socials/nav) which DOES NOT
// match what the CMS reader actually loads from disk. The Payload-projected JSON
// is the authoritative runtime shape — all field accesses in BaseLayout +
// src/components/seo/*.astro use these names.

export type NAP = {
  legalName?: string | null;
  kvkNumber?: string | null;
  establishmentNumber?: string | null;
  streetAddress?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

export type OpeningHours = {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  open?: string | null;     // 'HH:MM'
  close?: string | null;
  closed?: boolean;
};

export type SocialLink = { platform: string; url: string };
export type NavLink = { label: string; href: string; external?: boolean };
export type Alias = { host: string };
export type ServiceAreaEntry = { name: string };
export type FooterCompositionLink = { label?: string | null; href?: string | null };
export type FooterCompositionItem = {
  id?: string | null;
  type?: 'brand' | 'text' | 'links' | 'contact' | 'business' | 'navigation' | null;
  label?: string | null;
  text?: string | null;
  links?: FooterCompositionLink[] | null;
};
export type FooterCompositionColumn = {
  id?: string | null;
  items?: FooterCompositionItem[] | null;
};

export type SiteSettings = {
  siteName: string;
  siteUrl: string;                 // includes protocol — e.g. https://ami-care.nl
  description?: string | null;
  language: string;
  aliases?: Alias[];
  contactEmail?: string | null;
  branding?: {
    logo?: MediaRef;
    favicon?: MediaRef;
    primaryColor?: string | null;
  } | null;
  chrome?: {
    header?: {
      logo?: MediaRef;
    } | null;
    footer?: {
      logo?: MediaRef;
      tagline?: string | null;
      copyright?: string | null;
      columns?: FooterCompositionColumn[] | null;
    } | null;
  } | null;
  maintenance?: {
    enabled?: boolean | null;
    message?: string | null;
  } | null;
  contact?: {
    phone?: string | null;
    address?: string | null;
    social?: SocialLink[];
  } | null;
  nap?: NAP | null;
  hours?: OpeningHours[];
  serviceArea?: ServiceAreaEntry[];
  // OBS-20 — the CMS replaced the flat `navigation` array with resolved
  // header / footer link lists. Each entry is a plain { label, href, external }.
  navHeader?: NavLink[];
  navFooter?: NavLink[];
  analytics?: Record<string, unknown> | null;
  updatedAt?: string;
};
