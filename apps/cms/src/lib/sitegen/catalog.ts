import {
  DEFAULT_NAVBAR_PLACEMENT,
  DEFAULT_NAVBAR_VARIANT,
  DEFAULT_FOOTER_VARIANT,
  CTA_VARIANTS,
  APPOINTMENT_VARIANTS,
  DEFAULT_APPOINTMENT_VARIANT,
  FOOTER_VARIANTS,
  HERO_BLOCK_TYPES,
  HERO_VARIANTS,
  NAVBAR_PLACEMENTS,
  NAVBAR_VARIANTS,
  SERVICES_VARIANTS,
  type NavbarPlacement,
  type NavbarVariant,
  type CtaVariant,
  type AppointmentVariant,
  type FooterVariant,
  type HeroVariant,
  type ServicesVariant,
  type SitegenBlockType,
} from "@siteinabox/contracts"

export const SITEGEN_REQUIREMENT_TAGS = [
  "image",
  "severalImages",
  "portrait",
  "wideImage",
  "projects",
  "severalProjectImages",
  "projectSummaries",
  "reviews",
  "severalReviews",
  "pricing",
  "comparablePricing",
  "serviceArea",
  "booking",
  "appointmentSchedule",
  "form",
  "contactMethods",
  "services",
] as const

export type SitegenRequirement = (typeof SITEGEN_REQUIREMENT_TAGS)[number]
export type SitegenVariantId = HeroVariant | ServicesVariant | CtaVariant | AppointmentVariant

export type SitegenFooterCatalogVariant = {
  id: FooterVariant
  useWhen: string
}

export type SitegenNavbarCatalogVariant = {
  id: NavbarVariant
  useWhen: string
  placements: readonly NavbarPlacement[]
}

export type SitegenCatalogVariant = {
  id: SitegenVariantId
  useWhen: string
  requires: readonly SitegenRequirement[]
}

export type SitegenSection = {
  blockType: SitegenBlockType
  purpose: string
  pageRules: {
    homepage: "required-first" | "optional"
    maxPerPage: 1
  }
  variants: readonly SitegenCatalogVariant[]
}

/**
 * The catalog is intentionally small and data-only. A semantic family is
 * added only after its first-party renderer and deterministic eligibility
 * path are ready.
 */
export const SITEGEN_SECTIONS = [
  {
    blockType: "hero",
    purpose: "Lead with the business, customer need and primary next step; use when the message is stronger than the available imagery.",
    pageRules: { homepage: "required-first", maxPerPage: 1 },
    variants: [
      {
        id: "hero-01",
        useWhen: "The message is stronger than the available imagery; optional truthful value points may support the offer.",
        requires: [],
      },
      {
        id: "hero-02",
        useWhen: "Two to four concrete service paths deserve a lower panel over one wide supplied cover photo.",
        requires: ["wideImage", "severalImages"],
      },
      {
        id: "hero-03",
        useWhen: "A restrained angled photo edge suits a creative, interior or design-led service.",
        requires: ["image"],
      },
      {
        id: "hero-04",
        useWhen: "One supplied photo should sit below the offer in a deliberate framed composition.",
        requires: ["image"],
      },
      {
        id: "hero-05",
        useWhen: "A clear offer pairs well with one supplied service, project, workspace or location photo in a restrained split composition.",
        requires: ["image"],
      },
    ],
  },
  {
    blockType: "services",
    purpose: "Explain the main services in a centered icon-led feature grid with concise service cells that are easy to scan before a visitor chooses the next step.",
    pageRules: { homepage: "optional", maxPerPage: 1 },
    variants: [
      {
        id: "services-01",
        useWhen: "Two to six supplied services deserve equal-weight icon, description, and optional action treatments in a compact responsive feature grid without images or a pricing comparison.",
        requires: ["services"],
      },
      {
        id: "services-02",
        useWhen: "Two to six supplied services are best presented as a clean centered icon grid with concise descriptions and optional text links, without individual service cards.",
        requires: ["services"],
      },
    ],
  },
  {
    blockType: "cta",
    purpose: "Give visitors one clear next step after they understand the offer; use only when a focused conversion moment adds value.",
    pageRules: { homepage: "optional", maxPerPage: 1 },
    variants: [
      {
        id: "cta-01",
        useWhen: "A centered, high-focus CTA should close a page or follow enough context; optional supplied imagery can add atmosphere without carrying factual proof.",
        requires: [],
      },
      {
        id: "cta-02",
        useWhen: "A simple centered CTA should keep the next step direct and lightweight after enough context, with a primary action and an optional text link.",
        requires: [],
      },
    ],
  },
  {
    blockType: "appointments",
    purpose: "Let a visitor choose an available appointment time and submit a small booking request without leaving the site.",
    pageRules: { homepage: "optional", maxPerPage: 1 },
    variants: [
      {
        id: DEFAULT_APPOINTMENT_VARIANT,
        useWhen: "The intake requests native appointment booking and the client will configure at least one real schedule window in CMS before publishing.",
        requires: ["appointmentSchedule"],
      },
    ],
  },
] as const satisfies readonly SitegenSection[]

/**
 * Chrome has its own compact catalog because it is settings-owned rather than
 * a page section. It intentionally contains presentation guidance only; the
 * renderer and CMS own the actual component and field definitions.
 */
export const SITEGEN_NAVBARS = [
  {
    id: "navbar-01",
    useWhen: "Use the balanced default navigation when the site needs straightforward links, an optional theme toggle and one clear contact action.",
    placements: NAVBAR_PLACEMENTS,
  },
  {
    id: "navbar-02",
    useWhen: "Use the responsive navigation when a compact pill menu should keep the primary links clear on desktop and collapse into a focused mobile menu on smaller screens.",
    placements: NAVBAR_PLACEMENTS,
  },
  {
    id: "navbar-03",
    useWhen: "Use the contained floating navigation when the design benefits from a lighter, modern frame around the primary links and actions.",
    placements: NAVBAR_PLACEMENTS,
  },
] as const satisfies readonly SitegenNavbarCatalogVariant[]

/** Footer is settings-owned chrome, not a selectable page section. */
export const SITEGEN_FOOTERS = [
  {
    id: "footer-01",
    useWhen: "Use the compact footer when a site needs a quiet branded close with footer navigation, legal links and an optional copyright line.",
  },
] as const satisfies readonly SitegenFooterCatalogVariant[]

export const SITEGEN_NAVBAR_VARIANTS = NAVBAR_VARIANTS
export const DEFAULT_SITEGEN_NAVBAR_VARIANT = DEFAULT_NAVBAR_VARIANT
export const DEFAULT_SITEGEN_NAVBAR_PLACEMENT = DEFAULT_NAVBAR_PLACEMENT
export const SITEGEN_FOOTER_VARIANTS = FOOTER_VARIANTS
export const DEFAULT_SITEGEN_FOOTER_VARIANT = DEFAULT_FOOTER_VARIANT

export const sitegenNavbarFor = (variant: string) =>
  SITEGEN_NAVBARS.find((entry) => entry.id === variant)

export const sitegenFooterFor = (variant: string) =>
  SITEGEN_FOOTERS.find((entry) => entry.id === variant)

export type SitegenEligibleSection = Omit<SitegenSection, "variants"> & {
  variant: SitegenVariantId
  useWhen: string
  requires: readonly SitegenRequirement[]
}

export const sitegenVariantFor = (blockType: SitegenBlockType, variant: string) =>
  SITEGEN_SECTIONS.find((section) => section.blockType === blockType)?.variants.find((entry) => entry.id === variant)

export const SITEGEN_HERO_BLOCK_TYPES = HERO_BLOCK_TYPES

export const SITEGEN_HERO_VARIANTS = HERO_VARIANTS

export const SITEGEN_SERVICES_VARIANTS = SERVICES_VARIANTS

export const SITEGEN_CTA_VARIANTS = CTA_VARIANTS

export const SITEGEN_APPOINTMENT_VARIANTS = APPOINTMENT_VARIANTS
