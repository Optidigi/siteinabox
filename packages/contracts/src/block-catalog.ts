import type { SiteBlockEditorField } from "./generation"
import { SHADCNUI_BLOCK_VARIANTS, SHADCNUI_CHROME_VARIANTS, SHADCNUI_SYSTEM_BLOCK_VARIANTS } from "./generated/shadcnui-blocks"
import type { SiteSettings } from "./site"
import { SITE_BLOCK_SLUGS, SITE_GENERATION_BLOCK_SLUGS } from "./site"
import type { SiteBlockSlug, SiteChromeVariant, SiteGenerationBlockSlug } from "./site"

export type BlockReferenceAvailability = "free" | "paid" | "unavailable" | "mixed"
export type BlockReferenceSource = {
  name: string
  url: string
  licenseStatus: string
  availability: BlockReferenceAvailability
  notes: string
}
export type BlockVariantScope = { kind: "global" } | { kind: "tenant-exclusive"; tenantSlugs: readonly string[] }
export type BlockSourceImplementation = "exact-source" | "adapted-exact-style" | "siab-owned" | "deferred"
export type BlockSourceAccessType = "local-source" | "public-page-payload" | "public-page-copy" | "public-github-source" | "operator-provided-archive" | "deferred"
export type BlockVariantSourceAvailability = "free-public" | "operator-archive-required" | "paid" | "locked" | "license-incompatible" | "unavailable"
export type BlockVariantApprovalStatus = "approved" | "deferred" | "blocked"
export type BlockVariantLicenseCompatibility = "compatible" | "incompatible" | "operator-review-required"
export type BlockVariantVisualExactnessStatus = "reviewed-adapted-exact-style" | "reviewed-exact-source" | "needs-browser-comparison" | "blocked"
export type BlockSourceIntegrationKind = "radix-nova" | "deferred"
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
export type SiteBlockCatalogVariant = {
  id: string
  variant: string
  providerVariantId?: string
  label: string
  intent: string
  scope: BlockVariantScope
  dataSignal: "field-presence" | "renderer-inferred" | "variant"
  rendererSupportStatus: "supported" | "deferred" | "unsupported"
  rendererClassName?: string
  provenance: BlockVariantProvenance
}
export type SiteBlockCatalogEntry = {
  slug: SiteBlockSlug
  label: string
  status: "approved"
  contractType: string
  runtimeValidationTarget: string
  cmsEditableFields: SiteBlockEditorField[]
  renderer: { package: "@siteinabox/site-renderer"; component: string; output: string }
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

const globalScope = { kind: "global" } as const

export const SITE_BLOCK_REFERENCE_SOURCES = {
  shadcnUiBlocks: {
    name: "akash3444/shadcn-ui-blocks",
    url: "https://github.com/akash3444/shadcn-ui-blocks",
    licenseStatus: "MIT; LICENSE and pinned source provenance are vendored with the provider inventory.",
    availability: "free",
    notes: "Imported only from the pinned Radix registry commit; moving main is never a source input.",
  },
} as const satisfies Record<string, BlockReferenceSource>

const text = (name: string, label = name): SiteBlockEditorField => ({ name, label, kind: "text" })
const rich = (name: string, label = name): SiteBlockEditorField => ({ name, label, kind: "richtext", variant: "block" })
const cta = (name: string, label = name): SiteBlockEditorField => ({ name, label, kind: "cta" })
const image = (name: string, label = name): SiteBlockEditorField => ({ name, label, kind: "image" })
const checkbox = (name: string, label = name): SiteBlockEditorField => ({ name, label, kind: "checkbox" })
const array = (name: string, fields: SiteBlockEditorField[], label = name): SiteBlockEditorField => ({ name, label, kind: "array", itemFields: fields })

const fieldsBySlug: Record<SiteBlockSlug, SiteBlockEditorField[]> = {
  hero: [rich("eyebrow"), rich("headline"), rich("subheadline"), array("links", [text("label"), text("href")]), cta("cta"), cta("secondary"), image("image"), array("stats", [text("value"), text("label")]), text("trustLabel"), array("logos", [text("name"), image("image"), text("href")])],
  featureList: [rich("eyebrow"), rich("title"), rich("intro"), image("image"), array("features", [rich("title"), rich("description"), text("icon"), image("image"), cta("cta"), text("metricValue"), text("metricLabel")])],
  testimonials: [text("title"), text("intro"), image("logo"), array("items", [text("quote"), text("author"), text("role"), image("avatar")])],
  faq: [rich("title"), rich("intro"), array("items", [rich("question"), rich("answer")])],
  cta: [rich("eyebrow"), rich("headline"), rich("description"), cta("primary"), cta("secondary"), image("backgroundImage")],
  richText: [rich("body")],
  contactSection: [rich("title"), rich("description"), text("formName"), text("submitLabel"), array("fields", [text("name"), text("label"), text("type")])],
  contactDetails: [rich("title"), rich("description"), array("items", [text("title"), text("description"), text("value"), text("href"), text("icon")])],
  pricing: [rich("eyebrow"), rich("title"), rich("intro"), array("plans", [rich("title"), rich("description"), text("price"), text("period"), array("features", [rich("label"), checkbox("included")]), cta("cta"), text("badge"), checkbox("highlighted")])],
  stats: [rich("title"), rich("intro"), array("items", [text("value"), text("label"), rich("description")])],
  logoCloud: [rich("title"), rich("intro"), array("logos", [text("name"), text("description"), image("image"), text("href")]), cta("cta")],
  gallery: [rich("title"), rich("intro"), array("images", [image("image"), rich("caption"), cta("link")]), cta("cta")],
  team: [rich("title"), rich("intro"), array("members", [text("name"), text("role"), rich("bio"), image("image"), array("links", [text("label"), text("href")])])],
  newsletter: [rich("title"), rich("description"), text("emailLabel"), text("emailPlaceholder"), text("submitLabel")],
  bentoGrid: [rich("title"), rich("intro"), array("items", [rich("title"), rich("description"), image("image"), text("icon"), cta("cta")])],
  contentSection: [rich("eyebrow"), rich("title"), rich("intro"), rich("body"), array("features", [rich("title"), rich("description"), text("icon")]), rich("bridge"), rich("secondaryTitle"), rich("secondaryBody"), image("image"), cta("cta")],
  timeline: [rich("title"), rich("intro"), array("items", [text("title"), text("description"), text("label"), text("date"), array("tags", [text("value")])])],
  blogCards: [rich("title"), rich("intro"), array("posts", [rich("title"), rich("excerpt"), image("image"), text("href"), text("date"), text("author")]), cta("cta"), cta("secondary")],
}

const providerRuntime: BlockSourceRuntimeRequirement = {
  kind: "radix-nova",
  supportedAstroPath: "Render the pinned provider view through @siteinabox/site-renderer using structured contract adapters.",
  interactive: true,
  docs: ["packages/site-renderer/src/providers/shadcnui-blocks/inventory.json"],
  notes: "Provider primitives are namespaced in @siteinabox/ui; no second components.json is used.",
}
type ProviderCatalogSource = { id: string; upstreamName: string; entryFile: string; sourceHash: string }
const provenanceFor = (variant: ProviderCatalogSource): BlockVariantProvenance => ({
  sourceName: "akash3444/shadcn-ui-blocks", url: "https://github.com/akash3444/shadcn-ui-blocks",
  licenseStatus: "MIT", licenseCompatibility: "compatible", approvalStatus: "approved", sourceAvailability: "free-public",
  upstreamBlockName: variant.upstreamName, upstreamId: variant.id, sourceAccessType: "public-github-source",
  sourceAccess: `Pinned commit 46c2e50bb538c9bc7a8927979d38bae178ae4452 / registry-radix.json / ${variant.upstreamName}`,
  implementation: variant.upstreamName === "legal-content-01" ? "siab-owned" : "adapted-exact-style",
  sourcePath: variant.upstreamName === "legal-content-01" ? "packages/site-renderer/src/providers/shadcnui-blocks/system-views.tsx" : `packages/site-renderer/src/providers/shadcnui-blocks/variants/${variant.upstreamName}/${variant.entryFile}`,
  retrieval: "scripts/import-shadcnui-blocks.mjs verifies the pinned commit, records original SHA-256 hashes, and generates one runtime literal tree.",
  verifiedAt: "2026-07-16", visualExactnessStatus: variant.upstreamName === "legal-content-01" ? "reviewed-adapted-exact-style" : "needs-browser-comparison",
  visualSourceNotes: variant.upstreamName === "legal-content-01" ? "Provider-token long-form system layout for generated legal content." : "Pinned literal source; true upstream browser comparison is required before exact parity can be claimed.",
  runtime: providerRuntime, notes: `Aggregate source hash ${variant.sourceHash}.`,
})
const grouped = new Map<string, SiteBlockCatalogVariant[]>()
for (const source of [...SHADCNUI_BLOCK_VARIANTS, ...SHADCNUI_SYSTEM_BLOCK_VARIANTS]) {
  const variants = grouped.get(source.blockType) ?? []
  variants.push({
    id: `${source.blockType}:${source.id}`, variant: source.id, providerVariantId: source.id, label: source.title,
    intent: source.description, scope: globalScope, dataSignal: "variant", rendererSupportStatus: "supported",
    rendererClassName: `cms-block--source-shadcnui-blocks-${source.upstreamName}`, provenance: provenanceFor(source),
  })
  grouped.set(source.blockType, variants)
}
export const SITE_BLOCK_CATALOG = SITE_BLOCK_SLUGS.map((slug): SiteBlockCatalogEntry => ({
  slug, label: slug, status: "approved", contractType: `${slug}Block`, runtimeValidationTarget: "SiteGenerationSpecSchema + provider slot validation",
  cmsEditableFields: fieldsBySlug[slug], renderer: { package: "@siteinabox/site-renderer", component: "ProviderBlockRenderer", output: "Pinned provider view" },
  themeBehavior: ["reference-tokens", "scoped-semantic-preset-tokens"], fixtureCoverage: ["packages/site-renderer/src/providers/shadcnui-blocks/inventory.json"],
  variants: grouped.get(slug) ?? [], referenceSources: [SITE_BLOCK_REFERENCE_SOURCES.shadcnUiBlocks],
}))
export const SITE_GENERATION_BLOCK_CATALOG = SITE_BLOCK_CATALOG.filter((entry): entry is SiteBlockCatalogEntry & { slug: SiteGenerationBlockSlug } =>
  SITE_GENERATION_BLOCK_SLUGS.includes(entry.slug as SiteGenerationBlockSlug),
)
export type SiteBlockCatalog = typeof SITE_BLOCK_CATALOG
export const SITE_BLOCK_CATALOG_BY_SLUG = Object.fromEntries(SITE_BLOCK_CATALOG.map((entry) => [entry.slug, entry])) as Record<SiteBlockSlug, SiteBlockCatalogEntry>
export const SITE_GENERATION_BLOCK_CATALOG_BY_SLUG = SITE_BLOCK_CATALOG_BY_SLUG as Record<SiteGenerationBlockSlug, SiteBlockCatalogEntry>
export const SITE_BLOCK_MANIFEST_FROM_CATALOG = SITE_GENERATION_BLOCK_CATALOG.map((entry) => ({ slug: entry.slug, label: entry.label, fields: entry.cmsEditableFields }))

const chromeField = (area: SiteChromeCatalogArea, source?: (typeof SHADCNUI_CHROME_VARIANTS)[number]): SiteBlockEditorField[] => {
  const active = (name: string) => !source || (source.slots as Record<string, { status: string }>)[name]?.status !== "inactive"
  if (area === "header") return [
    active("logo") && image("chrome.header.logo"),
    active("links") && array("navHeader", [text("label"), text("href"), text("description"), text("icon")]),
    active("cta") && cta("chrome.header.cta"),
    active("secondaryAction") && cta("chrome.header.secondaryAction"),
    active("search") && text("chrome.header.search"),
    active("behavior") && text("chrome.header.behavior"),
    active("activeMode") && text("chrome.header.activeMode"),
    active("mobileMenu") && text("chrome.header.mobileMenu"),
  ].filter((field): field is SiteBlockEditorField => Boolean(field))
  if (area === "footer") return [
    active("logo") && image("chrome.footer.logo"),
    active("tagline") && text("chrome.footer.tagline"),
    active("columns") && array("chrome.footer.columns", [text("label"), text("text"), array("links", [text("label"), text("href")])]),
    active("legalLinks") && array("chrome.footer.legalLinks", [text("label"), text("href")]),
    active("copyright") && text("chrome.footer.copyright"),
    active("newsletter") && text("chrome.footer.newsletter"),
    active("social") && array("contact.social", [text("platform"), text("url")]),
  ].filter((field): field is SiteBlockEditorField => Boolean(field))
  return [text("chrome.banner.title"), text("chrome.banner.message"), cta("chrome.banner.link"), { name: "chrome.banner.dismissible", kind: "checkbox" }]
}

export const SITE_CHROME_CATALOG: SiteChromeCatalogVariant[] = [
  ...SHADCNUI_CHROME_VARIANTS.map((source) => ({
    id: `${source.area}:${source.id}`, area: source.area, variant: source.id as SiteChromeVariant, label: source.title, intent: source.description,
    scope: globalScope, dataSignal: "settings.chrome.variant" as const, rendererSupportStatus: "supported" as const,
    rendererClassName: `site-${source.area}--source-shadcnui-blocks-${source.upstreamName}`, provenance: provenanceFor(source as never), editableFields: chromeField(source.area, source),
  })),
]

export type ChromeCapabilityIssue = { path: string; message: string }

type ShadcnUiHeaderChromeVariant = Extract<(typeof SHADCNUI_CHROME_VARIANTS)[number], { area: "header" }>
type ShadcnUiFooterChromeVariant = Extract<(typeof SHADCNUI_CHROME_VARIANTS)[number], { area: "footer" }>

const findHeaderCapabilities = (variantId: string | null | undefined) => {
  if (!variantId) return undefined
  const entry = SHADCNUI_CHROME_VARIANTS.find((candidate): candidate is ShadcnUiHeaderChromeVariant =>
    candidate.id === variantId && candidate.area === "header")
  return entry?.capabilities
}

const findFooterCapabilities = (variantId: string | null | undefined) => {
  if (!variantId) return undefined
  const entry = SHADCNUI_CHROME_VARIANTS.find((candidate): candidate is ShadcnUiFooterChromeVariant =>
    candidate.id === variantId && candidate.area === "footer")
  return entry?.capabilities
}

export function validateSiteChromeCapabilities(settings: SiteSettings): ChromeCapabilityIssue[] {
  const issues: ChromeCapabilityIssue[] = []
  const header = settings.chrome?.header
  const headerCapability = findHeaderCapabilities(header?.variant)
  if (header?.variant?.startsWith("shadcnui-blocks.") && !headerCapability) issues.push({ path: "chrome.header.variant", message: `No capability contract exists for ${header.variant}.` })
  if (headerCapability && header) {
    const navigation = settings.navHeader ?? []
    const groups = navigation.filter((entry) => entry.children?.length)
    if (navigation.length > headerCapability.primaryItems.max) issues.push({ path: "navHeader", message: `${header.variant} supports at most ${headerCapability.primaryItems.max} primary navigation items.` })
    if (headerCapability.navigation === "none" && navigation.length) issues.push({ path: "navHeader", message: `${header.variant} has no primary-navigation region.` })
    if (headerCapability.navigation === "flat" && groups.length) issues.push({ path: "navHeader", message: `${header.variant} supports flat links, not flyout groups.` })
    if (groups.length > headerCapability.groupItems.max) issues.push({ path: "navHeader", message: `${header.variant} supports at most ${headerCapability.groupItems.max} flyout groups.` })
    groups.forEach((group, index) => {
      const count = group.children?.length ?? 0
      if (count < headerCapability.childItems.min || count > headerCapability.childItems.max) issues.push({ path: `navHeader.${index}.children`, message: `This flyout requires ${headerCapability.childItems.min}-${headerCapability.childItems.max} links.` })
    })
    if (!headerCapability.secondaryAction && header.secondaryAction?.href) issues.push({ path: "chrome.header.secondaryAction", message: `${header.variant} has no secondary-action region.` })
    if (!headerCapability.search && header.search?.enabled) issues.push({ path: "chrome.header.search", message: `${header.variant} has no search region.` })
    if (header.mobileMenu && headerCapability.mobileMenu.length > 0 && !(headerCapability.mobileMenu as readonly string[]).includes(header.mobileMenu)) issues.push({ path: "chrome.header.mobileMenu", message: `${header.variant} does not support the ${header.mobileMenu} mobile-menu behavior.` })
  }
  const footer = settings.chrome?.footer
  const footerCapability = findFooterCapabilities(footer?.variant)
  if (footer?.variant?.startsWith("shadcnui-blocks.") && !footerCapability) issues.push({ path: "chrome.footer.variant", message: `No capability contract exists for ${footer.variant}.` })
  if (footerCapability && footer) {
    const columns = footer.columns ?? []
    if (columns.length < footerCapability.columns.min || columns.length > footerCapability.columns.max) issues.push({ path: "chrome.footer.columns", message: `${footer.variant} supports ${footerCapability.columns.min}-${footerCapability.columns.max} columns.` })
    columns.forEach((column, columnIndex) => (column.items ?? []).forEach((item, itemIndex) => {
      if ((item.links?.length ?? 0) > footerCapability.linksPerColumn.max) issues.push({ path: `chrome.footer.columns.${columnIndex}.items.${itemIndex}.links`, message: `This footer supports at most ${footerCapability.linksPerColumn.max} links per column item.` })
    }))
    if ((footer.legalLinks?.length ?? 0) + (settings.navFooter?.length ?? 0) > footerCapability.flatLinks.max) issues.push({ path: "navFooter", message: `${footer.variant} supports at most ${footerCapability.flatLinks.max} utility and legal links combined.` })
    if (!footerCapability.newsletter && footer.newsletter?.action) issues.push({ path: "chrome.footer.newsletter", message: `${footer.variant} has no newsletter form region.` })
  }
  return issues
}

export function isApprovedSourceBackedVariant(variant: SiteBlockCatalogVariant | SiteChromeCatalogVariant) {
  return variant.scope.kind === "global" && variant.rendererSupportStatus === "supported" && variant.provenance.sourceName === "akash3444/shadcn-ui-blocks" && variant.provenance.approvalStatus === "approved"
}
export const SITE_SOURCE_BACKED_BLOCK_VARIANTS = SITE_BLOCK_CATALOG.flatMap((entry) => entry.variants.filter(isApprovedSourceBackedVariant).map((variant) => ({
  slug: entry.slug, variantId: variant.id, providerVariantId: variant.providerVariantId, legacyDesignVariant: undefined,
  designVariant: variant.providerVariantId ?? variant.variant, variant: variant.providerVariantId ?? variant.variant,
  label: variant.label, rendererClassName: variant.rendererClassName, provenance: variant.provenance,
})))
export const SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS = SITE_SOURCE_BACKED_BLOCK_VARIANTS.filter(
  (variant) => variant.providerVariantId !== "shadcnui-blocks.legal-content-01",
)
export const SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_PROVIDER_NAMES = ["akash3444/shadcn-ui-blocks"] as const
export const SITE_SOURCE_BACKED_CHROME_VARIANTS = SITE_CHROME_CATALOG.filter(isApprovedSourceBackedVariant).map((variant) => ({
  area: variant.area, variantId: variant.id, variant: variant.variant, label: variant.label, rendererClassName: variant.rendererClassName, provenance: variant.provenance,
}))
export const SITE_SELF_SERVE_CHROME_VARIANTS = SITE_CHROME_CATALOG.filter(isApprovedSourceBackedVariant)
export const REQUIRED_V1_MARKETING_BLOCKS = SITE_GENERATION_BLOCK_SLUGS
export type RequiredV1MarketingBlock = (typeof REQUIRED_V1_MARKETING_BLOCKS)[number]
export const DEFERRED_V1_MARKETING_BLOCKS = [] as const
export const DEFERRED_V1_MARKETING_RENDERER_BLOCKS = [] as const
export const APPROVED_V1_MARKETING_CAPABILITY_COVERAGE = [] as const
export const DEFERRED_SOURCE_BLOCK_CANDIDATES = [] as const
