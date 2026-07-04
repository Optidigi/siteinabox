import type { SiteBlockEditorField } from "./generation"
import { SITE_BLOCK_SLUGS } from "./site"
import type { SiteBlockSlug, SiteChromeVariant, SiteGenerationBlockSlug } from "./site"

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
  variant: string
  label: string
  intent: string
  scope: BlockVariantScope
  dataSignal: "field-presence" | "renderer-inferred" | "variant"
  rendererSupportStatus: "supported" | "deferred" | "unsupported"
  rendererClassName?: string
  provenance: BlockVariantProvenance
}

export type BlockVariantScope =
  | { kind: "global" }
  | { kind: "tenant-exclusive"; tenantSlugs: string[] }

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

export type BlockSourceIntegrationKind =
  | "siab-owned"
  | "copy-paste-tailwind"
  | "provider-derived-package-css"
  | "preline-ui"
  | "tailwind-plus-elements"
  | "tenant-renderer-source"
  | "deferred"

export type BlockSourceRuntimeRequirement = {
  kind: BlockSourceIntegrationKind
  supportedAstroPath: string
  tailwindNotes?: string
  packages?: string[]
  cssImports?: string[]
  jsImports?: string[]
  initializer?: string
  interactive: boolean
  docs: string[]
  notes: string
}

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
  runtime: BlockSourceRuntimeRequirement
  notes: string
}

export type SiteBlockCatalogEntry = {
  slug: SiteGenerationBlockSlug
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

export type SiteChromeCatalogArea = "header" | "footer" | "banner"

export type SiteChromeCatalogVariant = {
  id: string
  area: SiteChromeCatalogArea
  variant: SiteChromeVariant
  label: string
  intent: string
  scope: BlockVariantScope
  dataSignal: "settings.chrome.variant"
  rendererSupportStatus: "supported" | "deferred" | "unsupported"
  rendererClassName?: string
  provenance: BlockVariantProvenance
  editableFields: SiteBlockEditorField[]
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
  tenantRendererSnapshots: {
    name: "SIAB tenant renderer snapshots",
    url: "https://github.com/optidigi/siteinabox",
    licenseStatus: "Operator-owned local tenant snapshot source retained for Amicare migration parity.",
    availability: "free",
    notes:
      "Use as a local visual/functionality parity reference only. Do not create new tenant source folders or tenant-specific renderer branches.",
  },
} as const satisfies Record<string, BlockReferenceSource>

export const SITE_BLOCK_REFERENCE_SOURCES = blockReferenceSources

const globalVariantScope = { kind: "global" } as const
const tenantExclusiveVariantScope = (...tenantSlugs: string[]) =>
  ({ kind: "tenant-exclusive", tenantSlugs } as const)

const siabOwnedRuntime: BlockSourceRuntimeRequirement = {
  kind: "siab-owned",
  supportedAstroPath: "Render through @siteinabox/site-renderer React components and package CSS.",
  interactive: false,
  docs: ["packages/site-renderer/src"],
  notes: "No external component runtime. SIAB owns both markup and CSS.",
}

const tenantRendererRuntime: BlockSourceRuntimeRequirement = {
  kind: "tenant-renderer-source",
  supportedAstroPath:
    "Map tenant renderer Astro/React/CSS source into tenant-exclusive @siteinabox/site-renderer variants; do not create new tenant source branches.",
  interactive: true,
  docs: [
    "packages/site-renderer/src/tenant-renderers",
  ],
  notes:
    "Used only for Amicare parity blocks. Renderer-owned tenant renderer sources and assets are canonical; deleted sites/* app sources must not be restored.",
}

const copyPasteTailwindRuntime = (sourceName: string, docs: string[]): BlockSourceRuntimeRequirement => ({
  kind: "copy-paste-tailwind",
  supportedAstroPath:
    "Use the provider's HTML/Tailwind classes inside renderer-owned React/Astro components with Tailwind v4 compiled by the consuming app.",
  tailwindNotes:
    "Astro apps should use @tailwindcss/vite, import tailwindcss in their app CSS, and @source scan packages/site-renderer plus any source-backed component files.",
  interactive: false,
  docs,
  notes: `${sourceName} blocks are source snippets, not app dependencies. Keep compact upstream provenance and map editable CMS fields into the same styled section structure.`,
})

const providerDerivedPackageCssRuntime = (
  sourceName: string,
  docs: string[],
  providerNativeNotes?: string,
): BlockSourceRuntimeRequirement => ({
  kind: "provider-derived-package-css",
  supportedAstroPath:
    "Render structured @siteinabox/site-renderer components and import @siteinabox/site-renderer/styles.css in each consuming app.",
  tailwindNotes:
    "Current renderer CSS is deterministic package CSS derived from reviewed provider source; consuming apps do not compile provider utility markup for this variant.",
  interactive: false,
  docs,
  notes: `${sourceName} is used as approved block reference material. The renderer keeps SIAB structured-data props and provider-derived package CSS, so no provider runtime package is loaded for the current adapted variant.${
    providerNativeNotes ? ` ${providerNativeNotes}` : ""
  }`,
})

const prelineRuntime = (interactive = false): BlockSourceRuntimeRequirement => ({
  kind: "preline-ui",
  supportedAstroPath:
    "Install Preline in any app that renders native Preline components, include Preline variants/forms in Tailwind CSS, and auto-init Preline JS for interactive components.",
  tailwindNotes:
    "Tailwind v4 CSS needs @import 'tailwindcss', app-local imports for node_modules/preline/css/themes/theme.css and node_modules/preline/variants.css, @plugin '@tailwindcss/forms', and @source scanning for Preline plus renderer component files. Provider source URLs are provenance; runtime CSS scans typed renderer files, not raw provider HTML.",
  packages: ["preline", "@tailwindcss/forms"],
  cssImports: ["node_modules/preline/css/themes/theme.css", "node_modules/preline/variants.css"],
  jsImports: interactive ? ["preline/dist"] : [],
  initializer: interactive ? "window.HSStaticMethods.autoInit()" : undefined,
  interactive,
  docs: ["https://preline.co/docs/index.html", "https://preline.co/docs/frameworks-astro.html"],
  notes:
    "Only free-badged Preline blocks can enter the catalog. Non-interactive form sections still require Tailwind/forms styling; interactive Preline UI requires the Preline runtime.",
})

const tailwindPlusStaticRuntime = (interactive = false): BlockSourceRuntimeRequirement => ({
  kind: interactive ? "tailwind-plus-elements" : "copy-paste-tailwind",
  supportedAstroPath: interactive
    ? "Install @tailwindplus/elements or load the Elements module when rendering Tailwind Plus HTML snippets with commands, dialogs, disclosures, dropdowns, tabs, or menus."
    : "Use the downloadable Tailwind Plus HTML/Tailwind snippet in renderer-owned components with Tailwind v4 compiled by the consuming app.",
  tailwindNotes:
    "Tailwind Plus snippets are Tailwind utility markup. If the snippet includes Elements markup or command attributes, the Elements runtime is part of the supported implementation.",
  packages: interactive ? ["@tailwindplus/elements"] : undefined,
  jsImports: interactive ? ["@tailwindplus/elements"] : undefined,
  interactive,
  docs: [
    "https://tailwindcss.com/plus/ui-blocks/marketing",
    "https://tailwindcss.com/plus/ui-blocks/documentation/using-html",
    "https://tailwindcss.com/plus/ui-blocks/documentation/elements",
  ],
  notes:
    "Use only free/downloadable Tailwind Plus blocks approved by the operator. Locked or non-downloadable blocks stay out of the usable catalog.",
})

const deferredRuntime: BlockSourceRuntimeRequirement = {
  kind: "deferred",
  supportedAstroPath: "Phase 2 must implement a renderer-owned component before this variant can be marked supported.",
  interactive: false,
  docs: ["packages/contracts/src/site.ts", "packages/contracts/src/runtime.ts"],
  notes: "Contract shape is locked, but renderer behavior and visual review are pending.",
}

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
  runtime: siabOwnedRuntime,
  notes: "Generic canonical renderer style, not copied from an external block.",
})

const tenantRendererProvenance = (
  upstreamBlockName: string,
  sourcePath: string,
  notes: string,
): BlockVariantProvenance => ({
  sourceName: "SIAB tenant renderer snapshot",
  url: "https://github.com/optidigi/siteinabox",
  licenseStatus: "Operator-owned local tenant snapshot source for Amicare parity.",
  licenseCompatibility: "compatible",
  approvalStatus: "approved",
  sourceAvailability: "free-public",
  upstreamBlockName,
  sourceAccessType: "local-source",
  sourceAccess: "Local repository renderer-owned tenant renderer snapshot.",
  implementation: "adapted-exact-style",
  sourcePath,
  retrieval: `Inspect ${sourcePath} in this repository and map visible behavior to structured contract fields.`,
  verifiedAt: "2026-06-26",
  visualExactnessStatus: "needs-browser-comparison",
  visualSourceNotes:
    "Phase 2 records the local parity source and required data shape. Phase 3/6 must perform browser comparison after shared renderer implementation.",
  runtime: tenantRendererRuntime,
  notes,
})

const tailwindPlusFreeProvenance = (
  upstreamBlockName: string,
  upstreamId: string,
  url: string,
  runtime: BlockSourceRuntimeRequirement = tailwindPlusStaticRuntime(false),
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
  runtime,
  notes:
    "Renderer keeps SIAB structured-data props and maps the public block's spacing, layout, and visual treatment through renderer-owned Tailwind utility classes.",
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
  runtime: copyPasteTailwindRuntime("Tailblocks", [
    "https://tailblocks.cc",
    "https://github.com/mertJF/tailblocks",
  ]),
  notes:
    "Renderer keeps SIAB structured-data props and maps the upstream Tailwind layout/style through renderer-owned utility classes.",
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
  runtime: prelineRuntime(false),
  notes:
    "Renderer keeps structured contact-section data and maps the upstream max-width, centered title, form spacing, rounded input, and themed primary action through renderer-owned Preline/Tailwind utility classes.",
})

const deferredCatalogProvenance = ({
  sourceName,
  url,
  licenseStatus,
  upstreamBlockName,
  upstreamId,
  sourceAccessType = "deferred",
  sourceAccess,
  sourcePath,
  notes,
}: {
  sourceName: string
  url: string
  licenseStatus: string
  upstreamBlockName: string
  upstreamId?: string
  sourceAccessType?: BlockSourceAccessType
  sourceAccess: string
  sourcePath?: string
  notes: string
}): BlockVariantProvenance => ({
  sourceName,
  url,
  licenseStatus,
  licenseCompatibility: "operator-review-required",
  approvalStatus: "deferred",
  sourceAvailability: "unavailable",
  upstreamBlockName,
  upstreamId,
  sourceAccessType,
  sourceAccess,
  sourcePath,
  implementation: "deferred",
  retrieval: "No approved typed renderer implementation has been selected for this variant.",
  verifiedAt: "2026-06-27",
  visualExactnessStatus: "needs-browser-comparison",
  visualSourceNotes: "Structured contract exists; renderer implementation and browser visual comparison remain pending.",
  runtime: deferredRuntime,
  notes,
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
] as const

export type RequiredV1MarketingBlock = (typeof REQUIRED_V1_MARKETING_BLOCKS)[number]

export const DEFERRED_V1_MARKETING_BLOCKS = [
] as const satisfies readonly Exclude<RequiredV1MarketingBlock, SiteGenerationBlockSlug>[]

export const DEFERRED_V1_MARKETING_RENDERER_BLOCKS = [
] as const satisfies readonly SiteGenerationBlockSlug[]

export const APPROVED_V1_MARKETING_CAPABILITY_COVERAGE = [
  {
    capability: "newsletter",
    blockSlug: "contactSection",
    variantId: "contactSection:tailwindPlusNewsletterDetails",
    designVariant: "tailwindPlusNewsletterDetails",
    variant: "tailwindPlusNewsletterDetails",
    rendererClassName: "cms-block--source-tailwind-plus-newsletter-details",
    notes: "Newsletter is represented by the approved contactSection contract rather than a separate newsletter block slug.",
  },
] as const satisfies readonly {
  capability: Exclude<RequiredV1MarketingBlock, SiteBlockSlug>
  blockSlug: SiteBlockSlug
  variantId: string
  designVariant: string
  variant: string
  rendererClassName: string
  notes: string
}[]

const SITE_GENERATION_BLOCK_CATALOG_ENTRIES = [
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
    fixtureCoverage: ["packages/site-renderer/src/fixtures/v1.ts", "amicareSiteGenerationSpec"],
    variants: [
      {
        id: "hero:tailwindPlusSimpleCentered",
        variant: "tailwindPlusSimpleCentered",
        label: "Tailwind Plus simple centered",
        intent: "Centered marketing hero adapted from the public free Tailwind Plus Simple centered block.",
        scope: globalVariantScope,
        dataSignal: "variant",
        rendererSupportStatus: "supported",
        rendererClassName: "cms-block--source-tailwind-plus-simple-centered",
        provenance: tailwindPlusFreeProvenance(
          "Simple centered",
          "b9bcab4538776a17fff93d18f82a8272",
          "https://tailwindcss.com/plus/ui-blocks/marketing/sections/heroes#component-b9bcab4538776a17fff93d18f82a8272",
        ),
      },
      {
        id: "hero:amicareZenHero",
        variant: "amicareZenHero",
        label: "Amicare zen hero",
        intent: "Amicare-only warm editorial hero with image card, pills, pull quote, and location badge.",
        scope: tenantExclusiveVariantScope("amicare", "ami-care", "amicare-renderer"),
        dataSignal: "variant",
        rendererSupportStatus: "supported",
        rendererClassName: "cms-block--source-amicare-zen-hero",
        provenance: tenantRendererProvenance(
          "Amicare Hero",
          "packages/site-renderer/src/tenant-renderers/amicare/AmicarePage.tsx",
          "Maps the renderer-owned Amicare hero visual treatment to structured hero fields without restoring deleted tenant app source.",
        ),
      },
    ],
    referenceSources: [blockReferenceSources.tailwindPlusMarketing, blockReferenceSources.tailblocks],
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
    fixtureCoverage: ["packages/site-renderer/src/fixtures/v1.ts", "amicareSiteGenerationSpec"],
    variants: [
      {
        id: "featureList:tailwindPlusCentered2x2",
        variant: "tailwindPlusCentered2x2",
        label: "Tailwind Plus centered 2x2",
        intent: "Centered feature grid adapted from the public free Tailwind Plus Centered 2x2 grid block.",
        scope: globalVariantScope,
        dataSignal: "variant",
        rendererSupportStatus: "supported",
        rendererClassName: "cms-block--source-tailwind-plus-centered-2x2",
        provenance: tailwindPlusFreeProvenance(
          "Centered 2x2 grid",
          "64ac58e032276db96bf343a8d4f332a8",
          "https://tailwindcss.com/plus/ui-blocks/marketing/sections/feature-sections#component-64ac58e032276db96bf343a8d4f332a8",
        ),
      },
      {
        id: "featureList:amicareCareCards",
        variant: "amicareCareCards",
        label: "Amicare care cards",
        intent: "Amicare-only centered feature cards with script kicker, accent icon panels, and warm card styling.",
        scope: tenantExclusiveVariantScope("amicare", "ami-care", "amicare-renderer"),
        dataSignal: "variant",
        rendererSupportStatus: "supported",
        rendererClassName: "cms-block--source-amicare-care-cards",
        provenance: tenantRendererProvenance(
          "Amicare FeatureList",
          "packages/site-renderer/src/tenant-renderers/amicare/AmicarePage.tsx",
          "Maps the renderer-owned Amicare feature-card grid to structured featureList data and tenant-exclusive renderer CSS.",
        ),
      },
    ],
    referenceSources: [blockReferenceSources.tailwindPlusMarketing, blockReferenceSources.tailblocks],
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
    fixtureCoverage: ["packages/site-renderer/src/fixtures/v1.ts"],
    variants: [
      {
        id: "faq:amicareWarmAccordion",
        variant: "amicareWarmAccordion",
        label: "Amicare warm accordion",
        intent: "Amicare-only FAQ accordion with warm cards, centered serif heading, and compact disclosure rows.",
        scope: tenantExclusiveVariantScope("amicare", "ami-care", "amicare-renderer"),
        dataSignal: "variant",
        rendererSupportStatus: "supported",
        rendererClassName: "cms-block--source-amicare-warm-accordion",
        provenance: tenantRendererProvenance(
          "Amicare FAQ",
          "packages/site-renderer/src/tenant-renderers/amicare/AmicarePage.tsx",
          "Maps renderer-owned Amicare FAQ details styling to structured FAQ items and tenant-exclusive renderer CSS.",
        ),
      },
    ],
    referenceSources: [blockReferenceSources.tailwindPlusMarketing, blockReferenceSources.preline],
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
    fixtureCoverage: ["packages/site-renderer/src/fixtures/v1.ts", "amicareSiteGenerationSpec"],
    variants: [
      {
        id: "richText:tailblocksContentA",
        variant: "tailblocksContentA",
        label: "Tailblocks content A",
        intent: "Centered content section adapted from Tailblocks Content A.",
        scope: globalVariantScope,
        dataSignal: "variant",
        rendererSupportStatus: "supported",
        rendererClassName: "cms-block--source-tailblocks-content-a",
        provenance: tailblocksProvenance("LightContentA", "src/blocks/content/light/a.js"),
      },
      {
        id: "richText:amicareEditorial",
        variant: "amicareEditorial",
        label: "Amicare editorial prose",
        intent: "Amicare-only centered prose section with themed script eyebrow, serif headings, and warm rich-text spacing.",
        scope: tenantExclusiveVariantScope("amicare", "ami-care", "amicare-renderer"),
        dataSignal: "variant",
        rendererSupportStatus: "supported",
        rendererClassName: "cms-block--source-amicare-editorial",
        provenance: tenantRendererProvenance(
          "Amicare RichText",
          "packages/site-renderer/src/tenant-renderers/amicare/AmicarePage.tsx",
          "Maps renderer-owned Amicare rich text and themed eyebrow behavior into structured RtRoot data and package CSS.",
        ),
      },
    ],
    referenceSources: [blockReferenceSources.tailwindPlusMarketing],
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
    fixtureCoverage: ["packages/site-renderer/src/fixtures/v1.ts", "amicareSiteGenerationSpec"],
    variants: [
      {
        id: "cta:tailblocksCtaA",
        variant: "tailblocksCtaA",
        label: "Tailblocks CTA A",
        intent: "Inline heading and action adapted from Tailblocks CTA A.",
        scope: globalVariantScope,
        dataSignal: "variant",
        rendererSupportStatus: "supported",
        rendererClassName: "cms-block--source-tailblocks-cta-a",
        provenance: tailblocksProvenance("LightCTAA", "src/blocks/cta/light/a.js"),
      },
      {
        id: "cta:amicareQuoteContact",
        variant: "amicareQuoteContact",
        label: "Amicare quote/contact CTA",
        intent: "Amicare-only quote and contact CTA treatment with script kicker, warm backdrop, and large serif link mode.",
        scope: tenantExclusiveVariantScope("amicare", "ami-care", "amicare-renderer"),
        dataSignal: "variant",
        rendererSupportStatus: "supported",
        rendererClassName: "cms-block--source-amicare-quote-contact",
        provenance: tenantRendererProvenance(
          "Amicare CTA",
          "packages/site-renderer/src/tenant-renderers/amicare/AmicarePage.tsx",
          "Maps renderer-owned Amicare quote/contact CTA presentation to structured CTA fields and tenant-exclusive renderer CSS.",
        ),
      },
    ],
    referenceSources: [blockReferenceSources.tailwindPlusMarketing, blockReferenceSources.preline],
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
          text("placeholder", "Placeholder"),
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
          text("maxLength", "Max length"),
        ],
      },
      text("provider.provider", "Form provider"),
      text("provider.action", "Form action"),
      text("provider.fallbackHref", "Fallback href"),
    ],
    renderer: {
      package: "@siteinabox/site-renderer",
      component: "ContactSectionBlockRenderer",
      output: "Contact form section with SIAB-approved field types.",
    },
    themeBehavior: ["font-heading", "font-text", "radius-md", "radius-lg", "accent", "card", "rule"],
    fixtureCoverage: ["packages/site-renderer/src/fixtures/v1.ts", "amicareSiteGenerationSpec"],
    variants: [
      {
        id: "contactSection:tailwindPlusNewsletterDetails",
        variant: "tailwindPlusNewsletterDetails",
        label: "Tailwind Plus newsletter details",
        intent: "Dark side-by-side newsletter/contact capture section adapted from public free Tailwind Plus.",
        scope: globalVariantScope,
        dataSignal: "variant",
        rendererSupportStatus: "supported",
        rendererClassName: "cms-block--source-tailwind-plus-newsletter-details",
        provenance: tailwindPlusFreeProvenance(
          "Side-by-side with details",
          "82fc139db99143307df48bb9fe6152c5",
          "https://tailwindcss.com/plus/ui-blocks/marketing/sections/newsletter-sections#component-82fc139db99143307df48bb9fe6152c5",
        ),
      },
      {
        id: "contactSection:prelineCenteredNewsletter",
        variant: "prelineCenteredNewsletter",
        label: "Preline centered newsletter",
        intent: "Centered newsletter signup adapted from Preline's Free centered newsletter block.",
        scope: globalVariantScope,
        dataSignal: "variant",
        rendererSupportStatus: "supported",
        rendererClassName: "cms-block--source-preline-centered-newsletter",
        provenance: prelineFreeProvenance(
          "Centered Newsletter Signup",
          "centered-newsletter-signup",
          "https://preline.co/blocks/forms/newsletter-signup-forms/#centered-newsletter-signup",
          "textarea#centered-newsletter-signup-tab-html-markup",
        ),
      },
      {
        id: "contactSection:amicareContactForm",
        variant: "amicareContactForm",
        label: "Amicare contact form",
        intent: "Amicare-only narrow warm contact form with serif heading and quiet card fields.",
        scope: tenantExclusiveVariantScope("amicare", "ami-care", "amicare-renderer"),
        dataSignal: "variant",
        rendererSupportStatus: "supported",
        rendererClassName: "cms-block--source-amicare-contact-form",
        provenance: tenantRendererProvenance(
          "Amicare ContactSection",
          "packages/site-renderer/src/tenant-renderers/amicare/AmicarePage.tsx",
          "Maps renderer-owned Amicare contact form styling to structured fields and SIAB form provider data.",
        ),
      },
    ],
    referenceSources: [blockReferenceSources.tailwindPlusMarketing, blockReferenceSources.preline],
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
    fixtureCoverage: ["packages/site-renderer/src/fixtures/v1.ts"],
    variants: [
      {
        id: "testimonials:amicareStoryCards",
        variant: "amicareStoryCards",
        label: "Amicare story cards",
        intent: "Amicare-only testimonial cards with warm secondary band and italic serif quotes.",
        scope: tenantExclusiveVariantScope("amicare", "ami-care", "amicare-renderer"),
        dataSignal: "variant",
        rendererSupportStatus: "supported",
        rendererClassName: "cms-block--source-amicare-story-cards",
        provenance: tenantRendererProvenance(
          "Amicare Testimonials",
          "packages/site-renderer/src/tenant-renderers/amicare/AmicarePage.tsx",
          "Maps renderer-owned Amicare testimonial cards to structured quote, author, role, and optional avatar fields.",
        ),
      },
    ],
    referenceSources: [blockReferenceSources.tailwindPlusMarketing, blockReferenceSources.tailblocks],
  },
  {
    slug: "pricing",
    label: "Pricing",
    status: "approved",
    contractType: "PricingBlock",
    runtimeValidationTarget: "SITE_BLOCK_SLUGS + validateSiteGenerationSpecForCms + PricingBlockSchema + GeneratedBlockSpecSchema.",
    cmsEditableFields: [
      richtext("title", "Title", "inline", "heading"),
      richtext("intro", "Intro", "block", "text"),
      {
        name: "plans",
        label: "Plans",
        kind: "array",
        itemLabel: "Plan",
        itemFields: [
          richtext("title", "Title", "inline", "heading"),
          richtext("description", "Description", "block", "text"),
          text("price", "Price"),
          text("period", "Period"),
          cta("cta", "Action"),
          text("badge", "Badge"),
          { name: "highlighted", label: "Highlighted", kind: "checkbox" },
        ],
      },
    ],
    renderer: {
      package: "@siteinabox/site-renderer",
      component: "PricingBlockRenderer",
      output: "Shared renderer for structured pricing plans with feature lists and CTA links.",
    },
    themeBehavior: ["font-heading", "font-text", "accent", "card", "rule", "radius-lg"],
    fixtureCoverage: ["packages/site-renderer/src/fixtures/v1.ts"],
    variants: [
      {
        id: "pricing:tailwindPlusSimpleTiers",
        variant: "tailwindPlusSimpleTiers",
        label: "Tailwind Plus simple tiers",
        intent: "Pricing cards adapted from a reviewed Tailwind Plus free/downloadable pricing source.",
        scope: globalVariantScope,
        dataSignal: "variant",
        rendererSupportStatus: "supported",
        rendererClassName: "cms-block--source-tailwind-plus-simple-pricing",
        provenance: tailwindPlusFreeProvenance(
          "Simple pricing tiers",
          "4a9182e85945751476472f12356adb68",
          "https://tailwindcss.com/plus/ui-blocks/marketing/sections/pricing#component-4a9182e85945751476472f12356adb68",
        ),
      },
    ],
    referenceSources: [blockReferenceSources.tailwindPlusMarketing],
  },
  {
    slug: "stats",
    label: "Stats",
    status: "approved",
    contractType: "StatsBlock",
    runtimeValidationTarget: "SITE_BLOCK_SLUGS + validateSiteGenerationSpecForCms + StatsBlockSchema + GeneratedBlockSpecSchema.",
    cmsEditableFields: [
      richtext("title", "Title", "inline", "heading"),
      richtext("intro", "Intro", "block", "text"),
      {
        name: "items",
        label: "Stats",
        kind: "array",
        itemLabel: "Stat",
        itemFields: [text("value", "Value"), text("label", "Label"), richtext("description", "Description", "block", "text")],
      },
    ],
    renderer: {
      package: "@siteinabox/site-renderer",
      component: "StatsBlockRenderer",
      output: "Shared renderer for structured metric/value sections.",
    },
    themeBehavior: ["font-heading", "font-text", "accent", "ink", "muted", "rule"],
    fixtureCoverage: ["packages/site-renderer/src/fixtures/v1.ts"],
    variants: [
      {
        id: "stats:tailwindPlusSimple",
        variant: "tailwindPlusSimple",
        label: "Tailwind Plus stats",
        intent: "Metric row adapted from a reviewed Tailwind Plus stats source.",
        scope: globalVariantScope,
        dataSignal: "variant",
        rendererSupportStatus: "supported",
        rendererClassName: "cms-block--source-tailwind-plus-stats-simple",
        provenance: tailwindPlusFreeProvenance(
          "Stats section",
          "b5eb58f5c8fd565cc54bf488d647f02b",
          "https://tailwindcss.com/plus/ui-blocks/marketing/sections/stats-sections#component-b5eb58f5c8fd565cc54bf488d647f02b",
        ),
      },
    ],
    referenceSources: [blockReferenceSources.tailwindPlusMarketing],
  },
  {
    slug: "logoCloud",
    label: "Logo cloud",
    status: "approved",
    contractType: "LogoCloudBlock",
    runtimeValidationTarget: "SITE_BLOCK_SLUGS + validateSiteGenerationSpecForCms + LogoCloudBlockSchema + GeneratedBlockSpecSchema.",
    cmsEditableFields: [
      richtext("title", "Title", "inline", "heading"),
      richtext("intro", "Intro", "block", "text"),
      {
        name: "logos",
        label: "Logos",
        kind: "array",
        itemLabel: "Logo",
        itemFields: [text("name", "Name"), image("image", "Logo image"), text("href", "Href")],
      },
    ],
    renderer: {
      package: "@siteinabox/site-renderer",
      component: "LogoCloudBlockRenderer",
      output: "Shared renderer for linked or unlinked organization logos.",
    },
    themeBehavior: ["font-heading", "font-text", "muted", "rule", "logo-treatment"],
    fixtureCoverage: ["packages/site-renderer/src/fixtures/v1.ts"],
    variants: [
      {
        id: "logoCloud:tailwindPlusSimple",
        variant: "tailwindPlusSimple",
        label: "Tailwind Plus logo cloud",
        intent: "Logo row adapted from a reviewed Tailwind Plus logo cloud source.",
        scope: globalVariantScope,
        dataSignal: "variant",
        rendererSupportStatus: "supported",
        rendererClassName: "cms-block--source-tailwind-plus-logo-cloud-simple",
        provenance: tailwindPlusFreeProvenance(
          "Logo cloud",
          "6b864c393af88d7b8a2ac53eaebf6403",
          "https://tailwindcss.com/plus/ui-blocks/marketing/sections/logo-clouds#component-6b864c393af88d7b8a2ac53eaebf6403",
        ),
      },
    ],
    referenceSources: [blockReferenceSources.tailwindPlusMarketing],
  },
  {
    slug: "gallery",
    label: "Gallery",
    status: "approved",
    contractType: "GalleryBlock",
    runtimeValidationTarget: "SITE_BLOCK_SLUGS + validateSiteGenerationSpecForCms + GalleryBlockSchema + GeneratedBlockSpecSchema.",
    cmsEditableFields: [
      richtext("title", "Title", "inline", "heading"),
      richtext("intro", "Intro", "block", "text"),
      {
        name: "images",
        label: "Images",
        kind: "array",
        itemLabel: "Image",
        itemFields: [image("image", "Image"), richtext("caption", "Caption", "block", "text"), cta("link", "Link")],
      },
      cta("cta", "Action"),
    ],
    renderer: {
      package: "@siteinabox/site-renderer",
      component: "GalleryBlockRenderer",
      output: "Shared renderer for structured image galleries.",
    },
    themeBehavior: ["font-heading", "font-text", "accent", "radius-md", "media-grid"],
    fixtureCoverage: ["packages/site-renderer/src/fixtures/v1.ts"],
    variants: [
      {
        id: "gallery:prelineSquareGrid",
        variant: "prelineSquareGrid",
        label: "Preline square grid",
        intent: "Image grid adapted from a reviewed free Preline gallery source.",
        scope: globalVariantScope,
        dataSignal: "variant",
        rendererSupportStatus: "supported",
        rendererClassName: "cms-block--source-preline-gallery-square-grid",
        provenance: prelineFreeProvenance(
          "Square Image Grid with Four Columns",
          "square-image-grid-with-four-columns",
          "https://preline.co/blocks/marketing/gallery-grids/#square-image-grid-with-four-columns",
          "textarea#square-image-grid-with-four-columns-tab-html-markup",
        ),
      },
    ],
    referenceSources: [blockReferenceSources.preline],
  },
  {
    slug: "team",
    label: "Team",
    status: "approved",
    contractType: "TeamBlock",
    runtimeValidationTarget: "SITE_BLOCK_SLUGS + validateSiteGenerationSpecForCms + TeamBlockSchema + GeneratedBlockSpecSchema.",
    cmsEditableFields: [
      richtext("title", "Title", "inline", "heading"),
      richtext("intro", "Intro", "block", "text"),
      {
        name: "members",
        label: "Members",
        kind: "array",
        itemLabel: "Member",
        itemFields: [
          text("name", "Name"),
          text("role", "Role"),
          richtext("bio", "Bio", "block", "text"),
          image("image", "Image"),
          cta("links", "Links"),
        ],
      },
    ],
    renderer: {
      package: "@siteinabox/site-renderer",
      component: "TeamBlockRenderer",
      output: "Shared renderer for team member cards.",
    },
    themeBehavior: ["font-heading", "font-text", "muted", "radius-lg", "media-treatment"],
    fixtureCoverage: ["packages/site-renderer/src/fixtures/v1.ts"],
    variants: [
      {
        id: "team:tailwindPlusGrid",
        variant: "tailwindPlusGrid",
        label: "Tailwind Plus team grid",
        intent: "Team grid adapted from a reviewed Tailwind Plus team section source.",
        scope: globalVariantScope,
        dataSignal: "variant",
        rendererSupportStatus: "supported",
        rendererClassName: "cms-block--source-tailwind-plus-team-grid",
        provenance: tailwindPlusFreeProvenance(
          "Team grid",
          "1ea7e52a3e89a3cf7b4a0a4fd2dcdf84",
          "https://tailwindcss.com/plus/ui-blocks/marketing/sections/team-sections#component-1ea7e52a3e89a3cf7b4a0a4fd2dcdf84",
        ),
      },
    ],
    referenceSources: [blockReferenceSources.tailwindPlusMarketing],
  },
  {
    slug: "blogCards",
    label: "Blog cards",
    status: "approved",
    contractType: "BlogCardsBlock",
    runtimeValidationTarget: "SITE_BLOCK_SLUGS + validateSiteGenerationSpecForCms + BlogCardsBlockSchema + GeneratedBlockSpecSchema.",
    cmsEditableFields: [
      richtext("title", "Title", "inline", "heading"),
      richtext("intro", "Intro", "block", "text"),
      {
        name: "posts",
        label: "Posts",
        kind: "array",
        itemLabel: "Post",
        itemFields: [
          richtext("title", "Title", "inline", "heading"),
          richtext("excerpt", "Excerpt", "block", "text"),
          image("image", "Image"),
          text("href", "Href"),
          text("date", "Date"),
          text("author", "Author"),
          cta("cta", "Action"),
        ],
      },
    ],
    renderer: {
      package: "@siteinabox/site-renderer",
      component: "BlogCardsBlockRenderer",
      output: "Shared renderer for article or news card lists.",
    },
    themeBehavior: ["font-heading", "font-text", "accent", "card", "radius-lg"],
    fixtureCoverage: ["packages/site-renderer/src/fixtures/v1.ts"],
    variants: [
      {
        id: "blogCards:tailwindPlusThreeColumn",
        variant: "tailwindPlusThreeColumn",
        label: "Tailwind Plus three column",
        intent: "Article cards adapted from a reviewed Tailwind Plus blog section source.",
        scope: globalVariantScope,
        dataSignal: "variant",
        rendererSupportStatus: "supported",
        rendererClassName: "cms-block--source-tailwind-plus-blog-three-column",
        provenance: tailwindPlusFreeProvenance(
          "Three-column blog section",
          "b8172652fa29dc3eac306c2a8a922323",
          "https://tailwindcss.com/plus/ui-blocks/marketing/sections/blog-sections#component-b8172652fa29dc3eac306c2a8a922323",
        ),
      },
    ],
    referenceSources: [blockReferenceSources.tailwindPlusMarketing],
  },
] as const satisfies readonly SiteBlockCatalogEntry[]

export const SITE_CHROME_CATALOG = [
  {
    id: "header:default",
    area: "header",
    variant: "default",
    label: "Default header",
    intent: "SIAB-owned responsive brand, nav, and CTA header.",
    scope: globalVariantScope,
    dataSignal: "settings.chrome.variant",
    rendererSupportStatus: "supported",
    provenance: siabOwnedProvenance("SIAB default header"),
    editableFields: [
      image("chrome.header.logo", "Logo"),
      cta("chrome.header.cta", "Header action"),
      {
        name: "chrome.header.behavior",
        label: "Header behavior",
        kind: "select",
        options: [
          { label: "Static", value: "static" },
          { label: "Sticky", value: "sticky" },
        ],
      },
    ],
  },
  {
    id: "header:amicareZen",
    area: "header",
    variant: "amicareZen",
    label: "Amicare zen header",
    intent: "Amicare-only sticky translucent anchor navigation with compact uppercase brand lockup.",
    scope: tenantExclusiveVariantScope("amicare", "ami-care", "amicare-renderer"),
    dataSignal: "settings.chrome.variant",
    rendererSupportStatus: "supported",
    rendererClassName: "site-header--source-amicare-zen",
    provenance: tenantRendererProvenance(
      "Amicare Nav",
      "packages/site-renderer/src/tenant-renderers/amicare/AmicarePage.tsx",
      "Maps renderer-owned Amicare sticky anchor navigation to structured SiteSettings navHeader/chrome data.",
    ),
    editableFields: [
      image("chrome.header.logo", "Logo"),
      cta("chrome.header.cta", "Header action"),
      {
        name: "navHeader",
        label: "Header navigation",
        kind: "array",
        itemLabel: "Navigation link",
        itemFields: [text("label", "Label"), text("href", "Href")],
      },
    ],
  },
  {
    id: "footer:default",
    area: "footer",
    variant: "default",
    label: "Default footer",
    intent: "SIAB-owned responsive footer with brand, columns, navigation, and legal links.",
    scope: globalVariantScope,
    dataSignal: "settings.chrome.variant",
    rendererSupportStatus: "supported",
    provenance: siabOwnedProvenance("SIAB default footer"),
    editableFields: [
      image("chrome.footer.logo", "Logo"),
      text("chrome.footer.tagline", "Tagline"),
      text("chrome.footer.copyright", "Copyright"),
    ],
  },
  {
    id: "footer:amicareZen",
    area: "footer",
    variant: "amicareZen",
    label: "Amicare zen footer",
    intent: "Amicare-only warm gradient footer with brand, business details, contact, navigation, and legal row.",
    scope: tenantExclusiveVariantScope("amicare", "ami-care", "amicare-renderer"),
    dataSignal: "settings.chrome.variant",
    rendererSupportStatus: "supported",
    rendererClassName: "site-footer--source-amicare-zen",
    provenance: tenantRendererProvenance(
      "Amicare Footer",
      "packages/site-renderer/src/tenant-renderers/amicare/AmicarePage.tsx",
      "Maps renderer-owned Amicare footer composition to structured SiteSettings footer columns, navFooter, and NAP data.",
    ),
    editableFields: [
      image("chrome.footer.logo", "Logo"),
      text("chrome.footer.tagline", "Tagline"),
      text("chrome.footer.copyright", "Copyright"),
      {
        name: "chrome.footer.columns",
        label: "Footer columns",
        kind: "array",
        itemLabel: "Column",
      },
    ],
  },
  {
    id: "banner:default",
    area: "banner",
    variant: "default",
    label: "Default announcement banner",
    intent: "SIAB-owned global announcement bar for site-wide messages.",
    scope: globalVariantScope,
    dataSignal: "settings.chrome.variant",
    rendererSupportStatus: "supported",
    provenance: siabOwnedProvenance("SIAB default announcement banner"),
    editableFields: [
      text("chrome.banner.title", "Title"),
      text("chrome.banner.message", "Message"),
      cta("chrome.banner.link", "Banner link"),
      { name: "chrome.banner.dismissible", label: "Dismissible", kind: "checkbox" },
    ],
  },
] as const satisfies readonly SiteChromeCatalogVariant[]

export const SITE_GENERATION_BLOCK_CATALOG = SITE_GENERATION_BLOCK_CATALOG_ENTRIES

export const SITE_BLOCK_CATALOG = SITE_GENERATION_BLOCK_CATALOG_ENTRIES.filter((entry) =>
  SITE_BLOCK_SLUGS.includes(entry.slug as SiteBlockSlug),
)

export type SiteBlockCatalog = typeof SITE_BLOCK_CATALOG

export const SITE_BLOCK_CATALOG_BY_SLUG = Object.fromEntries(
  SITE_BLOCK_CATALOG.map((entry) => [entry.slug, entry]),
) as Record<SiteBlockSlug, SiteBlockCatalog[number]>

export const SITE_GENERATION_BLOCK_CATALOG_BY_SLUG = Object.fromEntries(
  SITE_GENERATION_BLOCK_CATALOG.map((entry) => [entry.slug, entry]),
) as Record<SiteGenerationBlockSlug, (typeof SITE_GENERATION_BLOCK_CATALOG)[number]>

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
const sourceBackedRuntimeKinds: readonly BlockSourceIntegrationKind[] = [
  "copy-paste-tailwind",
  "provider-derived-package-css",
  "preline-ui",
  "tailwind-plus-elements",
]

export function isApprovedSourceBackedVariant(variant: SiteBlockCatalogVariant | SiteChromeCatalogVariant) {
  return (
    sourceBackedImplementations.includes(variant.provenance.implementation) &&
    variant.provenance.approvalStatus === "approved" &&
    variant.provenance.sourceAvailability === "free-public" &&
    variant.provenance.licenseCompatibility === "compatible" &&
    sourceBackedAccessTypes.includes(variant.provenance.sourceAccessType) &&
    sourceBackedRuntimeKinds.includes(variant.provenance.runtime.kind) &&
    ["reviewed-adapted-exact-style", "reviewed-exact-source"].includes(variant.provenance.visualExactnessStatus) &&
    variant.rendererSupportStatus === "supported" &&
    Boolean(variant.variant) &&
    Boolean(variant.rendererClassName) &&
    Boolean(variant.provenance.retrieval) &&
    Boolean(variant.provenance.visualSourceNotes) &&
    Boolean(variant.provenance.runtime.supportedAstroPath) &&
    Boolean(variant.provenance.runtime.docs.length) &&
    Boolean(variant.provenance.runtime.notes)
  )
}

const siteSelfServeSourceBackedProviderNames = ["Tailwind Plus"] as const
const siteSelfServeSourceBackedProviderNameSet = new Set<string>(siteSelfServeSourceBackedProviderNames)

export const SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_PROVIDER_NAMES = siteSelfServeSourceBackedProviderNames

export const SITE_SOURCE_BACKED_BLOCK_VARIANTS = SITE_BLOCK_CATALOG.flatMap((entry) =>
  entry.variants
    .filter(isApprovedSourceBackedVariant)
    .map((variant) => {
      const catalogVariant = variant as SiteBlockCatalogVariant
      return {
        slug: entry.slug,
        variantId: catalogVariant.id,
        designVariant: catalogVariant.variant,
        variant: catalogVariant.variant,
        label: catalogVariant.label,
        rendererClassName: catalogVariant.rendererClassName,
        provenance: catalogVariant.provenance,
      }
    }),
)

export const SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS = SITE_SOURCE_BACKED_BLOCK_VARIANTS.filter((variant) =>
  siteSelfServeSourceBackedProviderNameSet.has(variant.provenance.sourceName),
)

export const SITE_SOURCE_BACKED_CHROME_VARIANTS = SITE_CHROME_CATALOG
  .filter(isApprovedSourceBackedVariant)
  .map((variant) => {
    const catalogVariant = variant as SiteChromeCatalogVariant
    return {
      area: catalogVariant.area,
      variantId: catalogVariant.id,
      variant: catalogVariant.variant,
      label: catalogVariant.label,
      rendererClassName: catalogVariant.rendererClassName,
      provenance: catalogVariant.provenance,
    }
  })

export const SITE_SELF_SERVE_CHROME_VARIANTS = SITE_CHROME_CATALOG.filter((variant) =>
  variant.scope.kind === "global" &&
  (
    variant.variant === "default" ||
    siteSelfServeSourceBackedProviderNameSet.has(variant.provenance.sourceName)
  ),
)

export const DEFERRED_SOURCE_BLOCK_CANDIDATES = [
  // Keep this list for future reviewed candidates that fail source or license gates.
] as const
