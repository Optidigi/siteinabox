import type {
  ContactSectionBlock,
  ContactDetailsBlock,
  CTABlock,
  BentoGridBlock,
  BlogCardsBlock,
  ContentSectionBlock,
  TimelineBlock,
  FAQBlock,
  FeatureListBlock,
  GalleryBlock,
  HeroBlock,
  LogoCloudBlock,
  MediaRef,
  NewsletterBlock,
  Page,
  PricingBlock,
  RichTextBlock,
  SiteBlockSlug,
  SiteGenerationBlockSlug,
  SiteSettings,
  StatsBlock,
  TeamBlock,
  TestimonialsBlock,
} from "./site"
import type { ColorSchemeId, FontSchemeId, ShapeSchemeId } from "./theme-presets"

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

export type IntakeCompanySource = "kvk" | "manual" | null
export type IntakeContactAction = "message" | "appointment" | "quote" | "phone" | "whatsapp"
export type IntakeContactPrimaryAction = IntakeContactAction | ""
export type IntakeContactFormType = "message" | "quote" | "appointment" | "multiple" | "none" | ""
export type IntakeContactWhatsappMode = "none" | "same" | "other" | ""
export type IntakeContactLocationOption = "region" | "address" | "none"
export type IntakeContactAvailabilityMode = "fixed" | "appointment_only" | "none" | ""
export type IntakeWorkMode = "on_location" | "at_business" | "remote" | "fixed_region" | "nationwide"
export type IntakeVisualLogoMode = "uploaded" | "textlogo" | ""
export type IntakeVisualColorSourceType = "logo" | "preset" | "custom" | ""
export type IntakeVisualPaletteId = "palette_1" | "palette_2" | "palette_3" | ""
export type IntakeVisualShape = "straight" | "slightly_rounded" | "rounded" | ""
export type IntakeVisualTypography = "clear" | "soft" | "classic" | "strong" | ""

export type IntakeVisualThemeTokens = {
  background: string
  foreground: string
  card: string
  cardForeground: string
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  muted: string
  mutedForeground: string
  accent: string
  accentForeground: string
  border: string
  input: string
  ring: string
  destructive: string
  destructiveForeground: string
}

export type IntakeLegalStatementRecord = {
  statementVersion: string
  recordedAt: string
}

export type IntakeLegalMetadata = {
  businessUseDeclaration: IntakeLegalStatementRecord & {
    accepted: true
  }
  termsAcceptance: IntakeLegalStatementRecord & {
    accepted: true
    documentVersion: string
    acceptanceVersion: string
    contentHash: string
    url: string
  }
  marketingConsent: IntakeLegalStatementRecord & {
    granted: boolean
  }
  privacyNotice: {
    documentVersion: string
    url: string
  }
}

export type RawIntakeSubmission = {
  submittedAt?: string
  source?: "public-intake" | "cms" | "operator" | "import" | string
  company: {
    source: IntakeCompanySource
    companyName: string
    kvkNumber: string
    address: string
    website: string
    mainActivity: string
    secondaryActivities: string[]
  }
  content: {
    intro: string
    offers: Array<{ value: string }>
    audience: string
    situation: string
    approach: string
    workModes: IntakeWorkMode[]
    region: string
    notes: string
  }
  contact: {
    selectedActions: IntakeContactAction[]
    formType: IntakeContactFormType
    formOptions: Array<"message" | "quote" | "appointment">
    primaryAction: IntakeContactPrimaryAction
    phoneNumber: string
    whatsappMode: IntakeContactWhatsappMode
    whatsappNumber: string
    locationOptions: IntakeContactLocationOption[]
    publicRegion: string
    publicAddress: string
    availabilityMode: IntakeContactAvailabilityMode
    openingHours: string
  }
  visual: {
    logo: {
      mode: IntakeVisualLogoMode
      file: unknown | null
      text: string
    }
    color: {
      sourceType: IntakeVisualColorSourceType
      sourceValue: string
      selectedPalette: IntakeVisualPaletteId
      tokens: IntakeVisualThemeTokens
    }
    shape: IntakeVisualShape
    typography: IntakeVisualTypography
  }
  finalDetails: {
    name: string
    email: string
    phone: string
  }
  legal: IntakeLegalMetadata
  domain?: string | null
  email?: string | null
  addOns?: string[] | null
  notes?: string | null
}

export type PublicIntakeSubmission = IntakeSubmission | RawIntakeSubmission

export type CompanyFacts = {
  source: IntakeCompanySource
  companyName: string
  kvkNumber?: string | null
  address?: string | null
  website?: string | null
  mainActivity?: string | null
  secondaryActivities: string[]
}

export type IntakeBrief = {
  intro?: string | null
  services: string[]
  audience?: string | null
  customerSituation?: string | null
  approach?: string | null
  workModes: IntakeWorkMode[]
  serviceArea: string[]
  proofTrust: string[]
  contactPreferences: {
    selectedActions: IntakeContactAction[]
    primaryAction?: IntakeContactAction | null
    formType?: Exclude<IntakeContactFormType, ""> | null
    formOptions: Array<"message" | "quote" | "appointment">
    phoneNumber?: string | null
    whatsappNumber?: string | null
    locationOptions: IntakeContactLocationOption[]
    publicRegion?: string | null
    publicAddress?: string | null
    availabilityMode?: Exclude<IntakeContactAvailabilityMode, ""> | null
    openingHours?: string | null
  }
  callsToAction: IntakeContactAction[]
  visualPreferences: {
    logoMode?: Exclude<IntakeVisualLogoMode, ""> | null
    logoText?: string | null
    colorSourceType?: Exclude<IntakeVisualColorSourceType, ""> | null
    colorSourceValue?: string | null
    selectedPalette?: Exclude<IntakeVisualPaletteId, ""> | null
    colorSchemeId?: ColorSchemeId | null
    fontSchemeId?: FontSchemeId | null
    shapeSchemeId?: ShapeSchemeId | null
    shape?: Exclude<IntakeVisualShape, ""> | null
    typography?: Exclude<IntakeVisualTypography, ""> | null
  }
  tone: string[]
  notes?: string | null
  domainInterest?: string | null
  emailInterest?: string | null
  addOnInterest: string[]
}

export type BusinessBrief = IntakeBrief

export type GenerationInput = {
  schemaVersion: 1
  status: "draft" | "ai-prepared" | "admin-approved"
  companyFacts: CompanyFacts
  brief: IntakeBrief
  normalizedIntake: NormalizedIntake
  approvedAt?: string | null
  approvedBy?: string | null
  preparedAt?: string | null
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
  companyFacts?: CompanyFacts | null
  intakeBrief?: IntakeBrief | null
  raw?: Record<string, unknown> | null
}

export type ThemeMode = "light" | "dark" | "system"
export type ThemeSchemeSource = "builtin" | "custom"
export type FontSchemeSource = "builtin" | "custom"

export type ColorRamp = {
  50: string
  100: string
  200: string
  300: string
  400: string
  500: string
  600: string
  700: string
  800: string
  900: string
  950?: string
}

export type ProviderColorSchemeMode = {
  neutral: ColorRamp
  accent: ColorRamp
  surface: string
  ink: string
  muted: string
  rule: string
  onAccent: string
}

export type ProviderColorScheme = {
  id: string
  label: string
  source: ThemeSchemeSource
  light: ProviderColorSchemeMode
  dark: ProviderColorSchemeMode
}

export type FontScheme = {
  id: string
  label: string
  source: FontSchemeSource
  roles: {
    body: string
    heading: string
    display?: string
    mono?: string
  }
}

export type ShapeScheme = {
  id: string
  label: string
  radius: {
    none: string
    sm: string
    md: string
    lg: string
    xl: string
    "2xl": string
    "3xl": string
    "4xl": string
    full: string
  }
}

export type ThemeTokenSpecV3 = {
  version: 3
  appearance: {
    mode: ThemeMode
  }
  colors: {
    schemeId: ColorSchemeId
  }
  fonts: {
    schemeId: FontSchemeId
  }
  shape: {
    schemeId: ShapeSchemeId
  }
}

export type ThemeTokenSpec = ThemeTokenSpecV3

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
  slug: SiteBlockSlug
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
export type GeneratedContactSectionBlockSpec = ContactSectionBlock & GeneratedBlockMetadata
export type GeneratedContactDetailsBlockSpec = ContactDetailsBlock & GeneratedBlockMetadata
export type GeneratedPricingBlockSpec = PricingBlock & GeneratedBlockMetadata
export type GeneratedStatsBlockSpec = StatsBlock & GeneratedBlockMetadata
export type GeneratedLogoCloudBlockSpec = LogoCloudBlock & GeneratedBlockMetadata
export type GeneratedGalleryBlockSpec = GalleryBlock & GeneratedBlockMetadata
export type GeneratedContentSectionBlockSpec = ContentSectionBlock & GeneratedBlockMetadata
export type GeneratedTimelineBlockSpec = TimelineBlock & GeneratedBlockMetadata
export type GeneratedTeamBlockSpec = TeamBlock & GeneratedBlockMetadata
export type GeneratedBlogCardsBlockSpec = BlogCardsBlock & GeneratedBlockMetadata

export type GeneratedBlockSpec =
  | GeneratedHeroBlockSpec
  | GeneratedFeatureListBlockSpec
  | GeneratedTestimonialsBlockSpec
  | GeneratedFAQBlockSpec
  | GeneratedCTABlockSpec
  | GeneratedContactSectionBlockSpec
  | GeneratedContactDetailsBlockSpec
  | GeneratedPricingBlockSpec
  | GeneratedStatsBlockSpec
  | GeneratedLogoCloudBlockSpec
  | GeneratedGalleryBlockSpec
  | GeneratedContentSectionBlockSpec
  | GeneratedTimelineBlockSpec
  | GeneratedTeamBlockSpec
  | GeneratedBlogCardsBlockSpec

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
