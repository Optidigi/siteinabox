import type { SiteBlockEditorField } from "./generation"
import type { SiteBlockSlug } from "./site"

export type BlockReferenceAvailability = "free" | "paid" | "unavailable" | "mixed"

export type BlockReferenceSource = {
  name: string
  url: string
  licenseStatus: string
  availability: BlockReferenceAvailability
  notes: string
}

export type SiteBlockCatalogVariant = {
  id: string
  label: string
  intent: string
  dataSignal: "field-presence" | "renderer-inferred" | "analytics.sectionVariant"
  rendererSupportStatus: "supported" | "deferred" | "unsupported"
  sectionVariant?: string
  rendererClassName?: string
  provenance: BlockVariantProvenance
}

export type BlockSourceImplementation = "exact-source" | "adapted-exact-style" | "siab-owned" | "deferred"
export type BlockSourceAccessType =
  | "local-source"
  | "public-page-payload"
  | "public-page-copy"
  | "public-github-source"
  | "operator-provided-archive"
  | "deferred"
export type BlockVariantSourceAvailability =
  | "free-public"
  | "operator-archive-required"
  | "paid"
  | "locked"
  | "license-incompatible"
  | "unavailable"
export type BlockVariantApprovalStatus = "approved" | "deferred" | "blocked"
export type BlockVariantLicenseCompatibility = "compatible" | "incompatible" | "operator-review-required"
export type BlockVariantVisualExactnessStatus =
  | "reviewed-adapted-exact-style"
  | "reviewed-exact-source"
  | "needs-browser-comparison"
  | "blocked"

export type BlockVariantProvenance = {
  sourceName: string
  url: string
  licenseStatus: string
  licenseCompatibility: BlockVariantLicenseCompatibility
  approvalStatus: BlockVariantApprovalStatus
  sourceAvailability: BlockVariantSourceAvailability
  upstreamBlockName: string
  upstreamId?: string
  sourceAccessType: BlockSourceAccessType
  sourceAccess: string
  implementation: BlockSourceImplementation
  sourcePath?: string
  retrieval: string
  verifiedAt: string
  visualExactnessStatus: BlockVariantVisualExactnessStatus
  visualSourceNotes: string
  notes: string
}

export type SiteBlockCatalogEntry = {
  slug: SiteBlockSlug
  label: string
  status: "approved"
  contractType: string
  runtimeValidationTarget: string
  cmsEditableFields: SiteBlockEditorField[]
  renderer: {
    package: "@siteinabox/site-renderer"
    component: string
    output: string
  }
  themeBehavior: string[]
  fixtureCoverage: string[]
  variants: SiteBlockCatalogVariant[]
  referenceSources: BlockReferenceSource[]
}

const richtext = (
  name: string,
  label: string,
  variant: "block" | "inline" = "block",
  role?: SiteBlockEditorField["role"],
): SiteBlockEditorField => ({
  name,
  label,
  kind: "richtext",
  variant,
  ...(role ? { role } : {}),
})

const text = (name: string, label: string): SiteBlockEditorField => ({
  name,
  label,
  kind: "text",
})

const cta = (name: string, label: string): SiteBlockEditorField => ({
  name,
  label,
  kind: "cta",
})

const image = (name: string, label: string): SiteBlockEditorField => ({
  name,
  label,
  kind: "image",
})

const blockReferenceSources = {
  tailwindPlusMarketing: {
    name: "Tailwind Plus marketing UI blocks",
    url: "https://tailwindcss.com/plus/ui-blocks/marketing",
    licenseStatus:
      "Operator approval exists for publicly exposed free/downloadable Tailwind Plus blocks; paid/locked blocks remain unavailable.",
    availability: "mixed",
    notes:
      "Use only components with public source access and operator approval. Do not use locked Get-the-code entries.",
  },
  tailblocks: {
    name: "Tailblocks",
    url: "https://github.com/mertJF/tailblocks",
    licenseStatus: "MIT licensed public repository.",
    availability: "free",
    notes: "Suitable as reference for common section patterns; do not copy into tenant source.",
  },
  mambaUi: {
    name: "Mamba UI",
    url: "https://mambaui.com/",
    licenseStatus: "MIT licensed public project.",
    availability: "free",
    notes: "Suitable as reference for common section patterns; do not copy into tenant source.",
  },
  hyperUi: {
    name: "HyperUI",
    url: "https://hyperui.dev/",
    licenseStatus: "MIT licensed public project.",
    availability: "free",
    notes: "Public copy-paste components with preview HTML access on hyperui.dev.",
  },
  preline: {
    name: "Preline UI blocks",
    url: "https://preline.co/blocks/",
    licenseStatus:
      "Mixed free/pro catalog under Preline UI's dual MIT and Fair Use terms; derivative templates, themes, and page builders are permitted with attribution, distinction, and non-competing use.",
    availability: "mixed",
    notes: "Use only blocks explicitly marked Free with public copy source. Do not copy Pro blocks.",
  },
  tailgrids: {
    name: "TailGrids blocks",
    url: "https://tailgrids.com/license",
    licenseStatus: "License allows project use but disallows website builder or UI generator use.",
    availability: "unavailable",
    notes: "Not approved for SIAB self-serve generated-site catalogs.",
  },
} as const satisfies Record<string, BlockReferenceSource>

export const SITE_BLOCK_REFERENCE_SOURCES = blockReferenceSources

const siabOwnedProvenance = (upstreamBlockName: string): BlockVariantProvenance => ({
  sourceName: "SIAB",
  url: "https://github.com/optidigi/siteinabox",
  licenseStatus: "Internal SIAB-owned renderer implementation.",
  licenseCompatibility: "compatible",
  approvalStatus: "approved",
  sourceAvailability: "free-public",
  upstreamBlockName,
  sourceAccessType: "local-source",
  sourceAccess: "Local package source.",
  implementation: "siab-owned",
  retrieval: "Use packages/site-renderer source directly.",
  verifiedAt: "2026-06-26",
  visualExactnessStatus: "reviewed-exact-source",
  visualSourceNotes: "SIAB-owned canonical renderer style; no external visual source comparison required.",
  notes: "Generic canonical renderer style, not copied from an external block.",
})

const tailwindPlusFreeProvenance = (
  upstreamBlockName: string,
  upstreamId: string,
  url: string,
): BlockVariantProvenance => ({
  sourceName: "Tailwind Plus",
  url,
  licenseStatus: "Public/free downloadable Tailwind Plus block with operator approval for SIAB use.",
  licenseCompatibility: "compatible",
  approvalStatus: "approved",
  sourceAvailability: "free-public",
  upstreamBlockName,
  upstreamId,
  sourceAccessType: "public-page-payload",
  sourceAccess: "Public Tailwind Plus page data exposes downloadable component preview/source payload.",
  implementation: "adapted-exact-style",
  retrieval:
    "Fetch the Tailwind Plus category page, inspect the public data-page component by upstreamId, and use only downloadable/free snippet data. See docs/architecture/block-source-catalog.md.",
  verifiedAt: "2026-06-26",
  visualExactnessStatus: "reviewed-adapted-exact-style",
  visualSourceNotes:
    "Reviewed against public Tailwind Plus preview/source payload at desktop and mobile widths; SIAB keeps contract data while matching the source spacing, typography, layout, and action treatment.",
  notes: "Renderer keeps SIAB structured-data props and adapts the public block's spacing, layout, and visual treatment.",
})

const tailblocksProvenance = (upstreamBlockName: string, sourcePath: string): BlockVariantProvenance => ({
  sourceName: "Tailblocks",
  url: `https://github.com/mertJF/tailblocks/blob/master/${sourcePath}`,
  licenseStatus: "MIT licensed public repository.",
  licenseCompatibility: "compatible",
  approvalStatus: "approved",
  sourceAvailability: "free-public",
  upstreamBlockName,
  sourcePath,
  sourceAccessType: "public-github-source",
  sourceAccess: "Public GitHub source file.",
  implementation: "adapted-exact-style",
  retrieval: `Fetch https://raw.githubusercontent.com/mertJF/tailblocks/master/${sourcePath}.`,
  verifiedAt: "2026-06-26",
  visualExactnessStatus: "reviewed-adapted-exact-style",
  visualSourceNotes:
    "Compared raw source layout to renderer CSS at desktop and mobile widths; SIAB maps rich text/CTA contract fields onto the upstream centered container, spacing, typography, and action treatment.",
  notes: "Renderer keeps SIAB structured-data props and adapts the upstream Tailwind layout/style.",
})

const mambaUiProvenance = (upstreamBlockName: string, sourcePath: string): BlockVariantProvenance => ({
  sourceName: "Mamba UI",
  url: `https://github.com/Microwawe/mamba-ui/blob/master/${sourcePath}`,
  licenseStatus: "MIT licensed public repository.",
  licenseCompatibility: "compatible",
  approvalStatus: "approved",
  sourceAvailability: "free-public",
  upstreamBlockName,
  sourcePath,
  sourceAccessType: "public-github-source",
  sourceAccess: "Public GitHub source file.",
  implementation: "adapted-exact-style",
  retrieval: `Fetch https://raw.githubusercontent.com/Microwawe/mamba-ui/master/${sourcePath}.`,
  verifiedAt: "2026-06-26",
  visualExactnessStatus: "reviewed-adapted-exact-style",
  visualSourceNotes:
    "Compared raw Angular template structure to renderer CSS at desktop and mobile widths; SIAB maps contract FAQ/testimonial data onto the upstream centered heading, divided FAQ, two-column testimonial, quote, and accent-rule treatments.",
  notes: "Renderer keeps SIAB structured-data props and adapts the upstream Tailwind layout/style.",
})

const hyperUiProvenance = (
  upstreamBlockName: string,
  upstreamId: string,
  url: string,
  sourcePath: string,
): BlockVariantProvenance => ({
  sourceName: "HyperUI",
  url,
  licenseStatus: "MIT licensed public project with copy-paste component pages.",
  licenseCompatibility: "compatible",
  approvalStatus: "approved",
  sourceAvailability: "free-public",
  upstreamBlockName,
  upstreamId,
  sourcePath,
  sourceAccessType: "public-page-copy",
  sourceAccess: "Public HyperUI component page exposes Copy and preview HTML for this component.",
  implementation: "adapted-exact-style",
  retrieval: `Open ${url} and inspect ${sourcePath} / component ${upstreamId}.`,
  verifiedAt: "2026-06-26",
  visualExactnessStatus: "reviewed-adapted-exact-style",
  visualSourceNotes:
    "Compared public component page/source pattern to renderer CSS at desktop and mobile widths; SIAB maps contact-section data onto the centered newsletter heading, single input, full-width mobile action, and compact desktop row.",
  notes: "Renderer keeps SIAB contact form data and adapts the upstream spacing, colors, centered form layout, and button treatment.",
})

const prelineFreeProvenance = (
  upstreamBlockName: string,
  upstreamId: string,
  url: string,
  sourcePath: string,
): BlockVariantProvenance => ({
  sourceName: "Preline UI",
  url,
  licenseStatus:
    "Free-badged Preline block under Preline UI's dual MIT and Fair Use terms; page-builder derivatives are permitted with attribution, distinction, and non-competing use.",
  licenseCompatibility: "compatible",
  approvalStatus: "approved",
  sourceAvailability: "free-public",
  upstreamBlockName,
  upstreamId,
  sourcePath,
  sourceAccessType: "public-page-copy",
  sourceAccess: "Public Preline block page exposes a Free badge and embedded textarea source markup for this block.",
  implementation: "adapted-exact-style",
  retrieval: `Open ${url} and inspect ${sourcePath}.`,
  verifiedAt: "2026-06-26",
  visualExactnessStatus: "reviewed-adapted-exact-style",
  visualSourceNotes:
    "Compared public Free block markup/page preview to renderer CSS at desktop and mobile widths; SIAB maps contact-section data onto the upstream centered title, description, rounded input, and responsive button row.",
  notes: "Renderer keeps SIAB contact form data and adapts the upstream max-width, centered title, form spacing, rounded input, and themed primary action.",
})

export const REQUIRED_V1_MARKETING_BLOCKS = [
  "hero",
  "featureList",
  "richText",
  "cta",
  "contactSection",
  "faq",
  "testimonials",
  "pricing",
  "stats",
  "logoCloud",
  "gallery",
  "team",
  "newsletter",
  "blogCards",
  "processSteps",
  "comparison",
] as const

export type RequiredV1MarketingBlock = (typeof REQUIRED_V1_MARKETING_BLOCKS)[number]

export const DEFERRED_V1_MARKETING_BLOCKS = [
  "pricing",
  "stats",
  "logoCloud",
  "gallery",
  "team",
  "blogCards",
  "processSteps",
  "comparison",
] as const satisfies readonly Exclude<RequiredV1MarketingBlock, SiteBlockSlug>[]

export const APPROVED_V1_MARKETING_CAPABILITY_COVERAGE = [
  {
    capability: "newsletter",
    blockSlug: "contactSection",
    variantId: "contactSection:tailwindPlusNewsletterDetails",
    sectionVariant: "tailwind-plus-newsletter-details",
    rendererClassName: "cms-block--source-tailwind-plus-newsletter-details",
    notes: "Newsletter is represented by the approved contactSection contract rather than a separate newsletter block slug.",
  },
] as const satisfies readonly {
  capability: Exclude<RequiredV1MarketingBlock, SiteBlockSlug>
  blockSlug: SiteBlockSlug
  variantId: string
  sectionVariant: string
  rendererClassName: string
  notes: string
}[]

export const SITE_BLOCK_CATALOG = [
  {
    slug: "hero",
    label: "Hero",
    status: "approved",
    contractType: "HeroBlock",
    runtimeValidationTarget: "SITE_BLOCK_SLUGS + validateSiteGenerationSpecForCms; Phase 3 should add HeroBlock runtime schema.",
    cmsEditableFields: [
      richtext("eyebrow", "Eyebrow", "inline", "script"),
      richtext("headline", "Headline", "inline", "title"),
      richtext("subheadline", "Subheadline", "block", "text"),
      {
        name: "pills",
        label: "Pills",
        kind: "array",
        itemLabel: "Pill",
        itemFields: [text("label", "Label")],
      },
      cta("cta", "Primary action"),
      image("image", "Image"),
    ],
    renderer: {
      package: "@siteinabox/site-renderer",
      component: "HeroBlockRenderer",
      output: "Responsive hero section with optional eyebrow, headline, subheadline, pills, CTA, and media.",
    },
    themeBehavior: ["font-title", "font-text", "radius-sm", "radius-md", "radius-lg", "accent", "ink", "bg"],
    fixtureCoverage: ["packages/site-renderer/src/fixtures/v1.ts", "amicareSiteGenerationSpec", "amblastSiteGenerationSpec"],
    variants: [
      {
        id: "hero:minimal",
        label: "Minimal",
        intent: "Text-first hero without image.",
        dataSignal: "field-presence",
        rendererSupportStatus: "supported",
        provenance: siabOwnedProvenance("SIAB minimal hero"),
      },
      {
        id: "hero:tailwindPlusSimpleCentered",
        label: "Tailwind Plus simple centered",
        intent: "Centered marketing hero adapted from the public free Tailwind Plus Simple centered block.",
        dataSignal: "analytics.sectionVariant",
        rendererSupportStatus: "supported",
        sectionVariant: "tailwind-plus-simple-centered",
        rendererClassName: "cms-block--source-tailwind-plus-simple-centered",
        provenance: tailwindPlusFreeProvenance(
          "Simple centered",
          "b9bcab4538776a17fff93d18f82a8272",
          "https://tailwindcss.com/plus/ui-blocks/marketing/sections/heroes#component-b9bcab4538776a17fff93d18f82a8272",
        ),
      },
    ],
    referenceSources: [blockReferenceSources.tailwindPlusMarketing, blockReferenceSources.tailblocks, blockReferenceSources.mambaUi],
  },
  {
    slug: "featureList",
    label: "Feature list",
    status: "approved",
    contractType: "FeatureListBlock",
    runtimeValidationTarget: "SITE_BLOCK_SLUGS + validateSiteGenerationSpecForCms; Phase 3 should add FeatureListBlock runtime schema.",
    cmsEditableFields: [
      richtext("title", "Title", "inline", "heading"),
      richtext("intro", "Intro", "block", "text"),
      {
        name: "features",
        label: "Features",
        kind: "array",
        itemLabel: "Feature",
        itemFields: [
          richtext("title", "Title", "inline", "heading"),
          richtext("description", "Description", "block", "text"),
          { name: "icon", label: "Icon", kind: "icon" },
        ],
      },
    ],
    renderer: {
      package: "@siteinabox/site-renderer",
      component: "FeatureListBlockRenderer",
      output: "Responsive feature/service card grid with optional icons.",
    },
    themeBehavior: ["font-heading", "font-text", "radius-lg", "accent", "card", "rule"],
    fixtureCoverage: ["packages/site-renderer/src/fixtures/v1.ts", "amicareSiteGenerationSpec", "amblastSiteGenerationSpec"],
    variants: [
      {
        id: "featureList:services",
        label: "Services",
        intent: "Service or value proposition grid.",
        dataSignal: "analytics.sectionVariant",
        rendererSupportStatus: "supported",
        provenance: siabOwnedProvenance("SIAB services grid"),
      },
      {
        id: "featureList:tailwindPlusCentered2x2",
        label: "Tailwind Plus centered 2x2",
        intent: "Centered feature grid adapted from the public free Tailwind Plus Centered 2x2 grid block.",
        dataSignal: "analytics.sectionVariant",
        rendererSupportStatus: "supported",
        sectionVariant: "tailwind-plus-centered-2x2",
        rendererClassName: "cms-block--source-tailwind-plus-centered-2x2",
        provenance: tailwindPlusFreeProvenance(
          "Centered 2x2 grid",
          "64ac58e032276db96bf343a8d4f332a8",
          "https://tailwindcss.com/plus/ui-blocks/marketing/sections/feature-sections#component-64ac58e032276db96bf343a8d4f332a8",
        ),
      },
    ],
    referenceSources: [blockReferenceSources.tailwindPlusMarketing, blockReferenceSources.tailblocks, blockReferenceSources.hyperUi],
  },
  {
    slug: "richText",
    label: "Rich text",
    status: "approved",
    contractType: "RichTextBlock",
    runtimeValidationTarget: "SITE_BLOCK_SLUGS + validateSiteGenerationSpecForCms + CMS rich text validators.",
    cmsEditableFields: [richtext("body", "Body", "block", "text")],
    renderer: {
      package: "@siteinabox/site-renderer",
      component: "RichTextBlockRenderer",
      output: "Structured rich text section rendered from the SIAB RtRoot contract.",
    },
    themeBehavior: ["font-heading", "font-text", "font-script", "accent", "ink", "muted"],
    fixtureCoverage: ["packages/site-renderer/src/fixtures/v1.ts", "amicareSiteGenerationSpec", "amblastSiteGenerationSpec"],
    variants: [
      {
        id: "richText:prose",
        label: "Prose",
        intent: "General editorial content and imported legacy copy.",
        dataSignal: "field-presence",
        rendererSupportStatus: "supported",
        provenance: siabOwnedProvenance("SIAB prose"),
      },
      {
        id: "richText:tailblocksContentA",
        label: "Tailblocks content A",
        intent: "Centered content section adapted from Tailblocks Content A.",
        dataSignal: "analytics.sectionVariant",
        rendererSupportStatus: "supported",
        sectionVariant: "tailblocks-content-a",
        rendererClassName: "cms-block--source-tailblocks-content-a",
        provenance: tailblocksProvenance("LightContentA", "src/blocks/content/light/a.js"),
      },
    ],
    referenceSources: [blockReferenceSources.tailwindPlusMarketing, blockReferenceSources.mambaUi],
  },
  {
    slug: "cta",
    label: "Call to action",
    status: "approved",
    contractType: "CTABlock",
    runtimeValidationTarget: "SITE_BLOCK_SLUGS + validateSiteGenerationSpecForCms; Phase 3 should add CTABlock runtime schema.",
    cmsEditableFields: [
      richtext("eyebrow", "Eyebrow", "inline", "script"),
      richtext("headline", "Headline", "inline", "heading"),
      richtext("description", "Description", "block", "text"),
      cta("primary", "Primary action"),
      cta("secondary", "Secondary action"),
      image("backgroundImage", "Background image"),
    ],
    renderer: {
      package: "@siteinabox/site-renderer",
      component: "CTABlockRenderer",
      output: "CTA section with one or two actions and optional background media.",
    },
    themeBehavior: ["font-heading", "font-text", "font-script", "radius-md", "accent", "bg", "ink"],
    fixtureCoverage: ["packages/site-renderer/src/fixtures/v1.ts", "amicareSiteGenerationSpec", "amblastSiteGenerationSpec"],
    variants: [
      {
        id: "cta:quote",
        label: "Quote request",
        intent: "Primary conversion action to an internal page or form anchor.",
        dataSignal: "renderer-inferred",
        rendererSupportStatus: "supported",
        provenance: siabOwnedProvenance("SIAB quote CTA"),
      },
      {
        id: "cta:tailblocksCtaA",
        label: "Tailblocks CTA A",
        intent: "Inline heading and action adapted from Tailblocks CTA A.",
        dataSignal: "analytics.sectionVariant",
        rendererSupportStatus: "supported",
        sectionVariant: "tailblocks-cta-a",
        rendererClassName: "cms-block--source-tailblocks-cta-a",
        provenance: tailblocksProvenance("LightCTAA", "src/blocks/cta/light/a.js"),
      },
    ],
    referenceSources: [blockReferenceSources.tailwindPlusMarketing, blockReferenceSources.hyperUi, blockReferenceSources.preline],
  },
  {
    slug: "contactSection",
    label: "Contact section",
    status: "approved",
    contractType: "ContactSectionBlock",
    runtimeValidationTarget: "SITE_BLOCK_SLUGS + validateSiteGenerationSpecForCms; Phase 3 should add ContactSectionBlock runtime schema.",
    cmsEditableFields: [
      richtext("title", "Title", "inline", "heading"),
      richtext("description", "Description", "block", "text"),
      text("formName", "Form name"),
      text("submitLabel", "Submit label"),
      {
        name: "fields",
        label: "Fields",
        kind: "array",
        itemLabel: "Field",
        itemFields: [
          text("name", "Name"),
          text("label", "Label"),
          {
            name: "type",
            label: "Type",
            kind: "select",
            options: [
              { label: "Text", value: "text" },
              { label: "Email", value: "email" },
              { label: "Phone", value: "tel" },
              { label: "Textarea", value: "textarea" },
            ],
          },
          { name: "required", label: "Required", kind: "checkbox" },
        ],
      },
    ],
    renderer: {
      package: "@siteinabox/site-renderer",
      component: "ContactSectionBlockRenderer",
      output: "Contact form section with SIAB-approved field types.",
    },
    themeBehavior: ["font-heading", "font-text", "radius-md", "radius-lg", "accent", "card", "rule"],
    fixtureCoverage: ["packages/site-renderer/src/fixtures/v1.ts", "amicareSiteGenerationSpec", "amblastSiteGenerationSpec"],
    variants: [
      {
        id: "contactSection:form",
        label: "Form",
        intent: "Lead-capture form with text, email, phone, and textarea fields.",
        dataSignal: "field-presence",
        rendererSupportStatus: "supported",
        provenance: siabOwnedProvenance("SIAB contact form"),
      },
      {
        id: "contactSection:tailwindPlusNewsletterDetails",
        label: "Tailwind Plus newsletter details",
        intent: "Dark side-by-side newsletter/contact capture section adapted from public free Tailwind Plus.",
        dataSignal: "analytics.sectionVariant",
        rendererSupportStatus: "supported",
        sectionVariant: "tailwind-plus-newsletter-details",
        rendererClassName: "cms-block--source-tailwind-plus-newsletter-details",
        provenance: tailwindPlusFreeProvenance(
          "Side-by-side with details",
          "82fc139db99143307df48bb9fe6152c5",
          "https://tailwindcss.com/plus/ui-blocks/marketing/sections/newsletter-sections#component-82fc139db99143307df48bb9fe6152c5",
        ),
      },
      {
        id: "contactSection:hyperUiNewsletterCentered",
        label: "HyperUI newsletter centered",
        intent: "Centered newsletter signup adapted from HyperUI's public marketing CTA component.",
        dataSignal: "analytics.sectionVariant",
        rendererSupportStatus: "supported",
        sectionVariant: "hyperui-newsletter-centered",
        rendererClassName: "cms-block--source-hyperui-newsletter-centered",
        provenance: hyperUiProvenance(
          "Newsletter sign up form with centered content and form",
          "component-2",
          "https://hyperui.dev/components/marketing/ctas/#component-2",
          "/examples/marketing/ctas/2.html",
        ),
      },
      {
        id: "contactSection:prelineCenteredNewsletter",
        label: "Preline centered newsletter",
        intent: "Centered newsletter signup adapted from Preline's Free centered newsletter block.",
        dataSignal: "analytics.sectionVariant",
        rendererSupportStatus: "supported",
        sectionVariant: "preline-centered-newsletter",
        rendererClassName: "cms-block--source-preline-centered-newsletter",
        provenance: prelineFreeProvenance(
          "Centered Newsletter Signup",
          "centered-newsletter-signup",
          "https://preline.co/blocks/forms/newsletter-signup-forms/#centered-newsletter-signup",
          "textarea#centered-newsletter-signup-tab-html-markup",
        ),
      },
    ],
    referenceSources: [blockReferenceSources.tailwindPlusMarketing, blockReferenceSources.hyperUi, blockReferenceSources.preline],
  },
  {
    slug: "faq",
    label: "FAQ",
    status: "approved",
    contractType: "FAQBlock",
    runtimeValidationTarget: "SITE_BLOCK_SLUGS + validateSiteGenerationSpecForCms; Phase 3 should add FAQBlock runtime schema.",
    cmsEditableFields: [
      richtext("title", "Title", "inline", "heading"),
      {
        name: "items",
        label: "Questions",
        kind: "array",
        itemLabel: "Question",
        itemFields: [
          richtext("question", "Question", "inline", "heading"),
          richtext("answer", "Answer", "block", "text"),
        ],
      },
    ],
    renderer: {
      package: "@siteinabox/site-renderer",
      component: "FAQBlockRenderer",
      output: "Accessible details/summary FAQ list.",
    },
    themeBehavior: ["font-heading", "font-text", "radius-md", "card", "rule", "ink"],
    fixtureCoverage: ["packages/site-renderer/src/fixtures/v1.ts", "amblastSiteGenerationSpec"],
    variants: [
      {
        id: "faq:accordion",
        label: "Accordion",
        intent: "Expandable question-and-answer list.",
        dataSignal: "field-presence",
        rendererSupportStatus: "supported",
        provenance: siabOwnedProvenance("SIAB FAQ accordion"),
      },
      {
        id: "faq:mambaFaq1",
        label: "Mamba FAQ 1",
        intent: "Centered FAQ section adapted from Mamba UI FAQ 1.",
        dataSignal: "analytics.sectionVariant",
        rendererSupportStatus: "supported",
        sectionVariant: "mamba-faq-1",
        rendererClassName: "cms-block--source-mamba-faq-1",
        provenance: mambaUiProvenance("FAQ 1", "src/app/components/faq/faq1/faq1.component.html"),
      },
    ],
    referenceSources: [blockReferenceSources.tailwindPlusMarketing, blockReferenceSources.hyperUi, blockReferenceSources.preline],
  },
  {
    slug: "testimonials",
    label: "Testimonials",
    status: "approved",
    contractType: "TestimonialsBlock",
    runtimeValidationTarget: "SITE_BLOCK_SLUGS + validateSiteGenerationSpecForCms; Phase 3 should add TestimonialsBlock runtime schema.",
    cmsEditableFields: [
      text("title", "Title"),
      {
        name: "items",
        label: "Testimonials",
        kind: "array",
        itemLabel: "Testimonial",
        itemFields: [
          text("quote", "Quote"),
          text("author", "Author"),
          text("role", "Role"),
          image("avatar", "Avatar"),
        ],
      },
    ],
    renderer: {
      package: "@siteinabox/site-renderer",
      component: "TestimonialsBlockRenderer",
      output: "Responsive testimonial cards with optional avatars.",
    },
    themeBehavior: ["font-heading", "font-text", "radius-lg", "card", "rule", "muted"],
    fixtureCoverage: ["packages/site-renderer/src/fixtures/v1.ts", "amblastSiteGenerationSpec"],
    variants: [
      {
        id: "testimonials:cards",
        label: "Cards",
        intent: "Grid of customer quotes or social proof.",
        dataSignal: "field-presence",
        rendererSupportStatus: "supported",
        provenance: siabOwnedProvenance("SIAB testimonial cards"),
      },
      {
        id: "testimonials:mambaTestimonial1",
        label: "Mamba testimonial 1",
        intent: "Two-column testimonial quote layout adapted from Mamba UI Testimonial 1.",
        dataSignal: "analytics.sectionVariant",
        rendererSupportStatus: "supported",
        sectionVariant: "mamba-testimonial-1",
        rendererClassName: "cms-block--source-mamba-testimonial-1",
        provenance: mambaUiProvenance("Testimonial 1", "src/app/components/testimonial/testimonial1/testimonial1.component.html"),
      },
    ],
    referenceSources: [blockReferenceSources.tailwindPlusMarketing, blockReferenceSources.tailblocks, blockReferenceSources.mambaUi],
  },
] as const satisfies readonly SiteBlockCatalogEntry[]

export type SiteBlockCatalog = typeof SITE_BLOCK_CATALOG

export const SITE_BLOCK_CATALOG_BY_SLUG = Object.fromEntries(
  SITE_BLOCK_CATALOG.map((entry) => [entry.slug, entry]),
) as Record<SiteBlockSlug, SiteBlockCatalog[number]>

export const SITE_BLOCK_MANIFEST_FROM_CATALOG = SITE_BLOCK_CATALOG.map((entry) => ({
  slug: entry.slug,
  label: entry.label,
  fields: entry.cmsEditableFields,
}))

const sourceBackedImplementations: readonly BlockSourceImplementation[] = ["exact-source", "adapted-exact-style"]
const sourceBackedAccessTypes: readonly BlockSourceAccessType[] = [
  "public-page-payload",
  "public-page-copy",
  "public-github-source",
]

export function isApprovedSourceBackedVariant(variant: SiteBlockCatalogVariant) {
  return (
    sourceBackedImplementations.includes(variant.provenance.implementation) &&
    variant.provenance.approvalStatus === "approved" &&
    variant.provenance.sourceAvailability === "free-public" &&
    variant.provenance.licenseCompatibility === "compatible" &&
    sourceBackedAccessTypes.includes(variant.provenance.sourceAccessType) &&
    ["reviewed-adapted-exact-style", "reviewed-exact-source"].includes(variant.provenance.visualExactnessStatus) &&
    variant.rendererSupportStatus === "supported" &&
    Boolean(variant.sectionVariant) &&
    Boolean(variant.rendererClassName) &&
    Boolean(variant.provenance.retrieval) &&
    Boolean(variant.provenance.visualSourceNotes)
  )
}

export const SITE_SOURCE_BACKED_BLOCK_VARIANTS = SITE_BLOCK_CATALOG.flatMap((entry) =>
  entry.variants
    .filter(isApprovedSourceBackedVariant)
    .map((variant) => {
      const catalogVariant = variant as SiteBlockCatalogVariant
      return {
        slug: entry.slug,
        variantId: catalogVariant.id,
        label: catalogVariant.label,
        sectionVariant: catalogVariant.sectionVariant,
        rendererClassName: catalogVariant.rendererClassName,
        provenance: catalogVariant.provenance,
      }
    }),
)

export const DEFERRED_SOURCE_BLOCK_CANDIDATES = [
  // Keep this list for future reviewed candidates that fail source or license gates.
] as const
