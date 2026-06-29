import type {
  ContactSectionBlock,
  CTABlock,
  BlogCardsBlock,
  ComparisonBlock,
  FAQBlock,
  FeatureListBlock,
  GalleryBlock,
  HeroBlock,
  LogoCloudBlock,
  MediaRef,
  Page,
  PricingBlock,
  ProcessStepsBlock,
  RichTextBlock,
  SiteGenerationBlockSlug,
  SiteSettings,
  StatsBlock,
  TeamBlock,
  TestimonialsBlock,
} from "./site"

export type IntakeSubmission = {
  submittedAt?: string
  source?: "public-intake" | "cms" | "operator" | "import" | string
  businessName: string
  domain?: string | null
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  language?: string | null
  industry?: string | null
  serviceArea?: string[] | null
  goals?: string[] | null
  pages?: Array<{
    slug?: string | null
    title: string
    purpose?: string | null
  }> | null
  brand?: {
    colors?: string[] | null
    fonts?: string[] | null
    tone?: string[] | null
    assets?: MediaRef[] | null
  } | null
  content?: Record<string, unknown> | null
  notes?: string | null
}

export type NormalizedIntake = {
  businessName: string
  tenantSlug: string
  primaryDomain: string
  siteUrl: string
  language: string
  contact?: {
    name?: string | null
    email?: string | null
    phone?: string | null
  } | null
  industry?: string | null
  serviceArea: string[]
  goals: string[]
  requestedPages: Array<{
    slug: string
    title: string
    purpose?: string | null
  }>
  brandSignals?: {
    colors?: string[]
    fonts?: string[]
    tone?: string[]
    assets?: MediaRef[]
  } | null
  raw?: Record<string, unknown> | null
}

export type ThemeColorRole =
  | "accent"
  | "onAccent"
  | "bg"
  | "ink"
  | "muted"
  | "card"
  | "secondary"
  | "rule"

export type ThemeFontRole = "title" | "heading" | "text" | "script"
export type ThemeDensity = "compact" | "comfortable" | "spacious"

export type ThemeTokenSpec = {
  colors?: Partial<Record<ThemeColorRole, string>>
  darkColors?: Partial<Record<ThemeColorRole, string>>
  fonts?: Partial<Record<ThemeFontRole, string>>
  radius?: string
  density?: ThemeDensity
  stylePreset?: string
  borderStyle?: "solid" | "dashed" | "none"
  mode?: "light" | "dark"
}

export type SiteBlockEditorField = {
  name: string
  label?: string
  kind: "richtext" | "text" | "image" | "icon" | "cta" | "array" | "select" | "checkbox"
  role?: "title" | "heading" | "text" | "script"
  variant?: "block" | "inline"
  itemLabel?: string
  itemFields?: SiteBlockEditorField[]
  options?: Array<{ label: string; value: string }>
}

export type SiteBlockManifestItem = {
  slug: SiteGenerationBlockSlug
  label?: string
  defaultAnchor?: string
  fields?: SiteBlockEditorField[]
}

export type GeneratedBlockMetadata = {
  id?: string
  source?: "ai" | "cms" | "import" | "operator" | string
}

export type GeneratedHeroBlockSpec = HeroBlock & GeneratedBlockMetadata
export type GeneratedFeatureListBlockSpec = FeatureListBlock & GeneratedBlockMetadata
export type GeneratedTestimonialsBlockSpec = TestimonialsBlock & GeneratedBlockMetadata
export type GeneratedFAQBlockSpec = FAQBlock & GeneratedBlockMetadata
export type GeneratedCTABlockSpec = CTABlock & GeneratedBlockMetadata
export type GeneratedRichTextBlockSpec = RichTextBlock & GeneratedBlockMetadata
export type GeneratedContactSectionBlockSpec = ContactSectionBlock & GeneratedBlockMetadata
export type GeneratedPricingBlockSpec = PricingBlock & GeneratedBlockMetadata
export type GeneratedStatsBlockSpec = StatsBlock & GeneratedBlockMetadata
export type GeneratedLogoCloudBlockSpec = LogoCloudBlock & GeneratedBlockMetadata
export type GeneratedGalleryBlockSpec = GalleryBlock & GeneratedBlockMetadata
export type GeneratedTeamBlockSpec = TeamBlock & GeneratedBlockMetadata
export type GeneratedBlogCardsBlockSpec = BlogCardsBlock & GeneratedBlockMetadata
export type GeneratedProcessStepsBlockSpec = ProcessStepsBlock & GeneratedBlockMetadata
export type GeneratedComparisonBlockSpec = ComparisonBlock & GeneratedBlockMetadata

export type GeneratedBlockSpec =
  | GeneratedHeroBlockSpec
  | GeneratedFeatureListBlockSpec
  | GeneratedTestimonialsBlockSpec
  | GeneratedFAQBlockSpec
  | GeneratedCTABlockSpec
  | GeneratedRichTextBlockSpec
  | GeneratedContactSectionBlockSpec
  | GeneratedPricingBlockSpec
  | GeneratedStatsBlockSpec
  | GeneratedLogoCloudBlockSpec
  | GeneratedGalleryBlockSpec
  | GeneratedTeamBlockSpec
  | GeneratedBlogCardsBlockSpec
  | GeneratedProcessStepsBlockSpec
  | GeneratedComparisonBlockSpec

export type GeneratedPageSpec = Omit<Page, "blocks" | "updatedAt"> & {
  blocks: GeneratedBlockSpec[]
  updatedAt?: string
}

export type GeneratedSiteSettings = Omit<SiteSettings, "updatedAt"> & {
  updatedAt?: string
}

export type SiteGenerationSpec = {
  schemaVersion: 1
  intake: NormalizedIntake
  tenant: {
    name: string
    slug: string
    domain: string
    status?: "provisioning" | "active" | "suspended" | "archived"
  }
  theme: ThemeTokenSpec
  settings: GeneratedSiteSettings
  pages: GeneratedPageSpec[]
  blocks?: SiteBlockManifestItem[]
  assets?: MediaRef[]
  generatedAt?: string
  generator?: {
    name?: string
    version?: string
    model?: string
  } | null
}

export type PublishedSnapshotManifestEntry = {
  type: "page" | "media" | "settings"
  key: string
  updatedAt: string
}

export type PublishedSnapshotManifest = {
  tenantId: string
  version: number
  updatedAt: string
  entries: PublishedSnapshotManifestEntry[]
}

export type PublishedSiteSnapshot = {
  schemaVersion: 1
  tenantId: string
  tenantSlug: string
  domain: string
  siteUrl: string
  manifest: PublishedSnapshotManifest
  settings: GeneratedSiteSettings
  pages: GeneratedPageSpec[]
  theme?: ThemeTokenSpec | null
  blocks?: SiteBlockManifestItem[]
  media?: MediaRef[]
  publishedAt?: string
}

export type ValidationSeverity = "error" | "warning" | "info"

export type ValidationIssue = {
  severity: ValidationSeverity
  code: string
  message: string
  path?: Array<string | number>
}

export type ValidationReport = {
  valid: boolean
  issues: ValidationIssue[]
}

export type CmsApplyResult = {
  ok: boolean
  tenantId?: string | number
  tenantSlug?: string
  pageIds?: Array<string | number>
  settingsId?: string | number
  validation: ValidationReport
}

export * from "./runtime"
