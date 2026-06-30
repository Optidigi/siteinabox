import { z } from "zod"
import { SITE_CHROME_CATALOG, SITE_GENERATION_BLOCK_CATALOG, type SiteBlockCatalogVariant } from "./block-catalog"
import { SITE_GENERATION_BLOCK_SLUGS } from "./site"
import type {
  AnalyticsBlockMetadata,
  Block,
  BlogCardsBlock,
  ComparisonBlock,
  ContactSectionBlock,
  CTABlock,
  FAQBlock,
  FeatureListBlock,
  FormProviderConfig,
  FooterCompositionColumn,
  GalleryBlock,
  HeroBlock,
  LinkRef,
  LogoCloudBlock,
  MediaRef,
  Page,
  PricingBlock,
  ProcessStepsBlock,
  RichTextBlock,
  SiteSettings,
  SiteGenerationBlockSlug,
  StatsBlock,
  TeamBlock,
  TestimonialsBlock,
} from "./site"
import type {
  CmsApplyResult,
  GeneratedBlockSpec,
  GeneratedPageSpec,
  GeneratedSiteSettings,
  GenerationInput,
  CompanyFacts,
  IntakeSubmission,
  IntakeBrief,
  NormalizedIntake,
  PublicIntakeSubmission,
  RawIntakeSubmission,
  PublishedSiteSnapshot,
  SiteBlockEditorField,
  SiteBlockManifestItem,
  SiteGenerationSpec,
  ThemeTokenSpec,
  ValidationIssue,
  ValidationReport,
} from "./generation"
import type {
  RtBlock,
  RtBlockquote,
  RtBlockRoot,
  RtDivider,
  RtHeading,
  RtInline,
  RtInlineRoot,
  RtLineBreak,
  RtLink,
  RtList,
  RtListItem,
  RtParagraph,
  RtRoot,
  RtText,
  RtThemed,
} from "./rich-text"

const DOMAIN_REGEX =
  /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/
const SLUG_REGEX = /^[a-z0-9-]+$/
const HEX_OR_CSS_FUNCTION_COLOR_REGEX =
  /^(#[0-9a-fA-F]{3,8}|(oklch|color|rgb[a]?|hsl[a]?)\(.*\)|[a-zA-Z]+)$/
const CSS_LENGTH_REGEX = /^(0|[0-9]+(\.[0-9]+)?(px|rem|em|%)|var\(--[A-Za-z0-9_-]+\))$/
const SITE_SHARED_CHROME_VARIANTS = ["default", "hyperUiSimple"] as const
const SITE_HEADER_FOOTER_CHROME_VARIANTS = [...SITE_SHARED_CHROME_VARIANTS, "amicareZen"] as const
type RuntimeVariantScope = "generic" | "officialTenant"

const strictObject = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict()
const nullableString = z.string().nullable().optional()
const jsonRecordSchema = z.record(z.string(), z.unknown())
const FORBIDDEN_GENERATED_PAYLOAD_KEYS = ["className", "classes", "rawHtml", "html", "component", "sourceCode", "filePath"] as const
const FORBIDDEN_GENERATED_PAYLOAD_KEY_SET = new Set<string>(FORBIDDEN_GENERATED_PAYLOAD_KEYS)
const hostnameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(253)
  .regex(DOMAIN_REGEX)
  .refine((value) => /[a-z]/.test(value.split(".").pop() ?? ""), {
    message: "Hostname must include an alphabetic top-level domain",
  })
const slugSchema = z.string().regex(SLUG_REGEX)
const cssColorSchema = z.string().regex(HEX_OR_CSS_FUNCTION_COLOR_REGEX)

export const SITE_SECTION_VARIANTS_BY_BLOCK_SLUG = Object.fromEntries(
  SITE_GENERATION_BLOCK_SLUGS.map((slug) => [
    slug,
    new Set(
      SITE_GENERATION_BLOCK_CATALOG
        .filter((entry) => entry.slug === slug)
        .flatMap((entry) => entry.variants as readonly SiteBlockCatalogVariant[])
        .map((variant) => variant.sectionVariant)
        .filter((variant): variant is string => typeof variant === "string" && variant.length > 0),
    ),
  ]),
) as unknown as Record<SiteGenerationBlockSlug, ReadonlySet<string>>

export const SITE_GENERIC_SECTION_VARIANTS_BY_BLOCK_SLUG = Object.fromEntries(
  SITE_GENERATION_BLOCK_SLUGS.map((slug) => [
    slug,
    new Set(
      SITE_GENERATION_BLOCK_CATALOG
        .filter((entry) => entry.slug === slug)
        .flatMap((entry) => entry.variants as readonly SiteBlockCatalogVariant[])
        .filter((variant) => variant.scope.kind === "global")
        .map((variant) => variant.sectionVariant)
        .filter((variant): variant is string => typeof variant === "string" && variant.length > 0),
    ),
  ]),
) as unknown as Record<SiteGenerationBlockSlug, ReadonlySet<string>>

export const SITE_VARIANTS_BY_BLOCK_SLUG = Object.fromEntries(
  SITE_GENERATION_BLOCK_SLUGS.map((slug) => [
    slug,
    new Set(
      SITE_GENERATION_BLOCK_CATALOG
        .filter((entry) => entry.slug === slug)
        .flatMap((entry) => entry.variants as readonly SiteBlockCatalogVariant[])
        .map((variant) => variant.variant)
        .filter((variant): variant is string => typeof variant === "string" && variant.length > 0),
    ),
  ]),
) as unknown as Record<SiteGenerationBlockSlug, ReadonlySet<string>>

export const SITE_GENERIC_VARIANTS_BY_BLOCK_SLUG = Object.fromEntries(
  SITE_GENERATION_BLOCK_SLUGS.map((slug) => [
    slug,
    new Set(
      SITE_GENERATION_BLOCK_CATALOG
        .filter((entry) => entry.slug === slug)
        .flatMap((entry) => entry.variants as readonly SiteBlockCatalogVariant[])
        .filter((variant) => variant.scope.kind === "global")
        .map((variant) => variant.variant)
        .filter((variant): variant is string => typeof variant === "string" && variant.length > 0),
    ),
  ]),
) as unknown as Record<SiteGenerationBlockSlug, ReadonlySet<string>>

export const isSupportedBlockVariant = (
  blockType: string,
  variant: string | null | undefined,
): boolean => {
  if (!variant) return true
  if (!SITE_GENERATION_BLOCK_SLUGS.includes(blockType as SiteGenerationBlockSlug)) return false
  return SITE_GENERIC_VARIANTS_BY_BLOCK_SLUG[blockType as SiteGenerationBlockSlug]?.has(variant) ?? false
}

export const isSupportedOfficialTenantBlockVariant = (
  blockType: string,
  variant: string | null | undefined,
): boolean => {
  if (!variant) return true
  if (!SITE_GENERATION_BLOCK_SLUGS.includes(blockType as SiteGenerationBlockSlug)) return false
  return SITE_VARIANTS_BY_BLOCK_SLUG[blockType as SiteGenerationBlockSlug]?.has(variant) ?? false
}

export const isSupportedBlockSectionVariant = (
  blockType: string,
  sectionVariant: string | null | undefined,
): boolean => {
  if (!sectionVariant) return true
  if (!SITE_GENERATION_BLOCK_SLUGS.includes(blockType as SiteGenerationBlockSlug)) return false
  return SITE_GENERIC_SECTION_VARIANTS_BY_BLOCK_SLUG[blockType as SiteGenerationBlockSlug]?.has(sectionVariant) ?? false
}

export const isSupportedOfficialTenantBlockSectionVariant = (
  blockType: string,
  sectionVariant: string | null | undefined,
): boolean => {
  if (!sectionVariant) return true
  if (!SITE_GENERATION_BLOCK_SLUGS.includes(blockType as SiteGenerationBlockSlug)) return false
  return SITE_SECTION_VARIANTS_BY_BLOCK_SLUG[blockType as SiteGenerationBlockSlug]?.has(sectionVariant) ?? false
}

export const RtTextSchema: z.ZodType<RtText> = strictObject({
  t: z.literal("text"),
  v: z.string(),
  marks: z.array(z.enum(["bold", "italic", "underline", "code", "strikethrough"])).optional(),
  style: z.string().optional(),
  color: z.string().optional(),
  font: z.string().optional(),
})

export const RtLineBreakSchema: z.ZodType<RtLineBreak> = strictObject({
  t: z.literal("linebreak"),
})

export const RtInlineSchema: z.ZodType<RtInline> = z.lazy(() =>
  z.union([RtTextSchema, RtLinkSchema, RtLineBreakSchema]),
)

export const RtLinkSchema: z.ZodType<RtLink> = z.lazy(() =>
  strictObject({
    t: z.literal("link"),
    href: z.string().min(1),
    rel: z.enum(["external", "internal"]).optional(),
    children: z.array(RtInlineSchema),
  }),
)

export const RtParagraphSchema: z.ZodType<RtParagraph> = z.lazy(() =>
  strictObject({
    t: z.literal("paragraph"),
    align: z.enum(["left", "center", "right", "justify"]).optional(),
    style: z.string().optional(),
    children: z.array(RtInlineSchema),
  }),
)

export const RtHeadingSchema: z.ZodType<RtHeading> = z.lazy(() =>
  strictObject({
    t: z.literal("heading"),
    level: z.union([z.literal(2), z.literal(3), z.literal(4)]),
    align: z.enum(["left", "center", "right", "justify"]).optional(),
    style: z.string().optional(),
    children: z.array(RtInlineSchema),
  }),
)

export const RtListItemSchema: z.ZodType<RtListItem> = z.lazy(() =>
  strictObject({
    t: z.literal("listItem"),
    children: z.array(RtBlockSchema),
  }),
)

export const RtListSchema: z.ZodType<RtList> = z.lazy(() =>
  strictObject({
    t: z.literal("list"),
    ordered: z.boolean(),
    items: z.array(RtListItemSchema),
  }),
)

export const RtBlockquoteSchema: z.ZodType<RtBlockquote> = z.lazy(() =>
  strictObject({
    t: z.literal("blockquote"),
    children: z.array(RtBlockSchema),
  }),
)

export const RtDividerSchema: z.ZodType<RtDivider> = strictObject({
  t: z.literal("divider"),
})

export const RtThemedSchema: z.ZodType<RtThemed> = z.lazy(() =>
  strictObject({
    t: z.literal("themed"),
    id: z.string().min(1),
    props: jsonRecordSchema,
    children: z.array(RtBlockSchema).optional(),
  }),
)

export const RtBlockSchema: z.ZodType<RtBlock> = z.lazy(() =>
  z.union([
    RtParagraphSchema,
    RtHeadingSchema,
    RtListSchema,
    RtBlockquoteSchema,
    RtDividerSchema,
    RtThemedSchema,
  ]),
)

export const RtBlockRootSchema: z.ZodType<RtBlockRoot> = z.lazy(() =>
  strictObject({
    t: z.literal("root"),
    variant: z.literal("block"),
    children: z.array(RtBlockSchema),
  }),
)

export const RtInlineRootSchema: z.ZodType<RtInlineRoot> = z.lazy(() =>
  strictObject({
    t: z.literal("root"),
    variant: z.literal("inline"),
    children: z.array(RtInlineSchema),
  }),
)

export const RtRootSchema: z.ZodType<RtRoot> = z.union([RtBlockRootSchema, RtInlineRootSchema])
const RtFieldSchema = RtRootSchema.nullable()

export const MediaRefSchema: z.ZodType<MediaRef> = z.union([
  z.string(),
  z.number(),
  strictObject({
    id: z.union([z.string(), z.number()]).optional(),
    url: nullableString,
    filename: nullableString,
    alt: nullableString,
    width: z.number().nullable().optional(),
    height: z.number().nullable().optional(),
  }).refine((value) => value.id != null || value.url != null || value.filename != null, {
    message: "Media reference must include id, url, or filename",
  }),
  z.null(),
])

export const AnalyticsBlockMetadataSchema: z.ZodType<AnalyticsBlockMetadata> = strictObject({
  sectionId: nullableString,
  sectionType: nullableString,
  sectionPosition: z.number().nullable().optional(),
  sectionAnchor: nullableString,
  sectionVariant: nullableString,
  blockPresetId: nullableString,
  contentSignature: nullableString,
})

const BlockInstanceTokensSchema = jsonRecordSchema.nullable().optional()
const BlockInstanceMetadataSchema = jsonRecordSchema.nullable().optional()

export const LinkRefSchema: z.ZodType<LinkRef> = strictObject({
  label: nullableString,
  href: nullableString,
})

export const FormProviderConfigSchema: z.ZodType<FormProviderConfig> = strictObject({
  provider: z.enum(["siab", "web3forms", "custom", "mailto"]).nullable().optional(),
  action: nullableString,
  method: z.enum(["GET", "POST"]).nullable().optional(),
  hiddenFields: z.array(strictObject({
    name: z.string().min(1),
    value: nullableString,
  })).nullable().optional(),
  honeypotField: nullableString,
  fallbackHref: nullableString,
  successMessage: nullableString,
  errorMessage: nullableString,
  requiresConsent: z.boolean().nullable().optional(),
  analyticsEnabled: z.boolean().nullable().optional(),
})

const generatedBlockSourceSchema = z.enum(["ai", "cms", "import", "operator"]).optional()

const baseBlockShape = {
  id: z.string().optional(),
  source: generatedBlockSourceSchema,
  variant: nullableString,
  tokens: BlockInstanceTokensSchema,
  metadata: BlockInstanceMetadataSchema,
  analytics: AnalyticsBlockMetadataSchema.nullable().optional(),
  anchor: nullableString,
}

export const HeroBlockSchema: z.ZodType<HeroBlock> = strictObject({
  blockType: z.literal("hero"),
  ...baseBlockShape,
  eyebrow: RtFieldSchema.optional(),
  headline: RtRootSchema,
  subheadline: RtFieldSchema.optional(),
  pills: z.array(strictObject({ label: z.string().min(1), id: nullableString })).optional(),
  cta: LinkRefSchema.nullable().optional(),
  image: MediaRefSchema.optional(),
})

export const FeatureListBlockSchema: z.ZodType<FeatureListBlock> = strictObject({
  blockType: z.literal("featureList"),
  ...baseBlockShape,
  title: RtFieldSchema.optional(),
  intro: RtFieldSchema.optional(),
  features: z
    .array(strictObject({
      title: RtRootSchema,
      description: RtFieldSchema.optional(),
      icon: nullableString,
    }))
    .min(1),
})

export const TestimonialsBlockSchema: z.ZodType<TestimonialsBlock> = strictObject({
  blockType: z.literal("testimonials"),
  ...baseBlockShape,
  title: nullableString,
  items: z
    .array(strictObject({
      quote: z.string().min(1),
      author: z.string().min(1),
      role: nullableString,
      avatar: MediaRefSchema.optional(),
    }))
    .min(1),
})

export const FAQBlockSchema: z.ZodType<FAQBlock> = strictObject({
  blockType: z.literal("faq"),
  ...baseBlockShape,
  title: RtFieldSchema.optional(),
  items: z
    .array(strictObject({
      question: RtRootSchema,
      answer: RtRootSchema,
    }))
    .min(1),
})

export const CTABlockSchema: z.ZodType<CTABlock> = strictObject({
  blockType: z.literal("cta"),
  ...baseBlockShape,
  eyebrow: RtFieldSchema.optional(),
  headline: RtRootSchema,
  description: RtFieldSchema.optional(),
  primary: LinkRefSchema.nullable().optional(),
  secondary: LinkRefSchema.nullable().optional(),
  backgroundImage: MediaRefSchema.optional(),
})

export const RichTextBlockSchema: z.ZodType<RichTextBlock> = strictObject({
  blockType: z.literal("richText"),
  ...baseBlockShape,
  body: RtRootSchema,
})

export const ContactSectionBlockSchema: z.ZodType<ContactSectionBlock> = strictObject({
  blockType: z.literal("contactSection"),
  ...baseBlockShape,
  title: RtFieldSchema.optional(),
  description: RtFieldSchema.optional(),
  formName: z.string().min(1),
  submitLabel: nullableString,
  fields: z
    .array(strictObject({
      name: z.string().min(1),
      label: z.string().min(1),
      type: z.enum(["text", "email", "tel", "textarea"]),
      required: z.boolean().optional(),
      placeholder: nullableString,
      maxLength: z.number().int().positive().nullable().optional(),
    }))
    .min(1),
  provider: FormProviderConfigSchema.nullable().optional(),
})

export const PricingBlockSchema: z.ZodType<PricingBlock> = strictObject({
  blockType: z.literal("pricing"),
  ...baseBlockShape,
  title: RtFieldSchema.optional(),
  intro: RtFieldSchema.optional(),
  plans: z
    .array(strictObject({
      title: RtRootSchema,
      description: RtFieldSchema.optional(),
      price: nullableString,
      period: nullableString,
      features: z.array(strictObject({
        label: RtRootSchema,
        included: z.boolean().nullable().optional(),
      })).nullable().optional(),
      cta: LinkRefSchema.nullable().optional(),
      badge: nullableString,
      highlighted: z.boolean().nullable().optional(),
    }))
    .min(1),
})

export const StatsBlockSchema: z.ZodType<StatsBlock> = strictObject({
  blockType: z.literal("stats"),
  ...baseBlockShape,
  title: RtFieldSchema.optional(),
  intro: RtFieldSchema.optional(),
  items: z
    .array(strictObject({
      value: z.string().min(1),
      label: z.string().min(1),
      description: RtFieldSchema.optional(),
    }))
    .min(1),
})

export const LogoCloudBlockSchema: z.ZodType<LogoCloudBlock> = strictObject({
  blockType: z.literal("logoCloud"),
  ...baseBlockShape,
  title: RtFieldSchema.optional(),
  intro: RtFieldSchema.optional(),
  logos: z
    .array(strictObject({
      name: z.string().min(1),
      image: MediaRefSchema,
      href: nullableString,
    }))
    .min(1),
})

export const GalleryBlockSchema: z.ZodType<GalleryBlock> = strictObject({
  blockType: z.literal("gallery"),
  ...baseBlockShape,
  title: RtFieldSchema.optional(),
  intro: RtFieldSchema.optional(),
  images: z
    .array(strictObject({
      image: MediaRefSchema,
      caption: RtFieldSchema.optional(),
      link: LinkRefSchema.nullable().optional(),
    }))
    .min(1),
  cta: LinkRefSchema.nullable().optional(),
})

export const TeamBlockSchema: z.ZodType<TeamBlock> = strictObject({
  blockType: z.literal("team"),
  ...baseBlockShape,
  title: RtFieldSchema.optional(),
  intro: RtFieldSchema.optional(),
  members: z
    .array(strictObject({
      name: z.string().min(1),
      role: nullableString,
      bio: RtFieldSchema.optional(),
      image: MediaRefSchema.optional(),
      links: z.array(LinkRefSchema).nullable().optional(),
    }))
    .min(1),
})

export const BlogCardsBlockSchema: z.ZodType<BlogCardsBlock> = strictObject({
  blockType: z.literal("blogCards"),
  ...baseBlockShape,
  title: RtFieldSchema.optional(),
  intro: RtFieldSchema.optional(),
  posts: z
    .array(strictObject({
      title: RtRootSchema,
      excerpt: RtFieldSchema.optional(),
      image: MediaRefSchema.optional(),
      href: nullableString,
      date: nullableString,
      author: nullableString,
      cta: LinkRefSchema.nullable().optional(),
    }))
    .min(1),
})

export const ProcessStepsBlockSchema: z.ZodType<ProcessStepsBlock> = strictObject({
  blockType: z.literal("processSteps"),
  ...baseBlockShape,
  title: RtFieldSchema.optional(),
  intro: RtFieldSchema.optional(),
  steps: z
    .array(strictObject({
      title: RtRootSchema,
      description: RtFieldSchema.optional(),
      icon: nullableString,
      image: MediaRefSchema.optional(),
      cta: LinkRefSchema.nullable().optional(),
    }))
    .min(1),
})

export const ComparisonBlockSchema: z.ZodType<ComparisonBlock> = strictObject({
  blockType: z.literal("comparison"),
  ...baseBlockShape,
  title: RtFieldSchema.optional(),
  intro: RtFieldSchema.optional(),
  columns: z
    .array(strictObject({
      title: RtRootSchema,
      description: RtFieldSchema.optional(),
      cta: LinkRefSchema.nullable().optional(),
    }))
    .min(1),
  rows: z
    .array(strictObject({
      label: z.string().min(1),
      values: z.array(z.union([z.string(), z.boolean(), z.null()])).min(1),
    }))
    .min(1),
})

const BlockSchemaBase = z.union([
  HeroBlockSchema,
  FeatureListBlockSchema,
  TestimonialsBlockSchema,
  FAQBlockSchema,
  CTABlockSchema,
  RichTextBlockSchema,
  ContactSectionBlockSchema,
  PricingBlockSchema,
  StatsBlockSchema,
  LogoCloudBlockSchema,
  GalleryBlockSchema,
  TeamBlockSchema,
  BlogCardsBlockSchema,
  ProcessStepsBlockSchema,
  ComparisonBlockSchema,
])

const GeneratedBlockSchemaBase = z.union([
  HeroBlockSchema,
  FeatureListBlockSchema,
  TestimonialsBlockSchema,
  FAQBlockSchema,
  CTABlockSchema,
  RichTextBlockSchema,
  ContactSectionBlockSchema,
  PricingBlockSchema,
  StatsBlockSchema,
  LogoCloudBlockSchema,
  GalleryBlockSchema,
  TeamBlockSchema,
  BlogCardsBlockSchema,
  ProcessStepsBlockSchema,
  ComparisonBlockSchema,
])

const refineGeneratedBlock = (
  block: { blockType: string; variant?: string | null; analytics?: AnalyticsBlockMetadata | null },
  ctx: z.RefinementCtx,
  scope: RuntimeVariantScope = "generic",
) => {
  for (const key of FORBIDDEN_GENERATED_PAYLOAD_KEYS) {
    if (Object.prototype.hasOwnProperty.call(block, key)) {
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: `Generated blocks must not include ${key}`,
      })
    }
  }
  addForbiddenGeneratedPayloadIssues((block as Record<string, unknown>).tokens, ctx, ["tokens"])
  addForbiddenGeneratedPayloadIssues((block as Record<string, unknown>).metadata, ctx, ["metadata"])

  const variant = block.variant
  const supportsBlockVariant = scope === "officialTenant" ? isSupportedOfficialTenantBlockVariant : isSupportedBlockVariant
  if (typeof variant === "string" && variant.length > 0 && !supportsBlockVariant(block.blockType, variant)) {
    ctx.addIssue({
      code: "custom",
      path: ["variant"],
      message: `Unsupported variant "${variant}" for block type "${block.blockType}"`,
    })
  }

  const sectionVariant = block.analytics?.sectionVariant
  const supportsSectionVariant = scope === "officialTenant" ? isSupportedOfficialTenantBlockSectionVariant : isSupportedBlockSectionVariant
  if (!variant && typeof sectionVariant === "string" && sectionVariant.length > 0 && !supportsSectionVariant(block.blockType, sectionVariant)) {
    ctx.addIssue({
      code: "custom",
      path: ["analytics", "sectionVariant"],
      message: `Unsupported section variant "${sectionVariant}" for block type "${block.blockType}"`,
    })
  }
}

export const BlockSchema: z.ZodType<Block> = BlockSchemaBase.superRefine((block, ctx) => {
  refineGeneratedBlock(block, ctx)
})

export const GeneratedBlockSpecSchema: z.ZodType<GeneratedBlockSpec> =
  GeneratedBlockSchemaBase.superRefine((block, ctx) => {
    refineGeneratedBlock(block, ctx)
  })

export const OfficialTenantBlockSchema: z.ZodType<Block> = BlockSchemaBase.superRefine((block, ctx) => {
  refineGeneratedBlock(block, ctx, "officialTenant")
})

export const OfficialTenantGeneratedBlockSpecSchema: z.ZodType<GeneratedBlockSpec> =
  GeneratedBlockSchemaBase.superRefine((block, ctx) => {
    refineGeneratedBlock(block, ctx, "officialTenant")
  })

function addForbiddenGeneratedPayloadIssues(
  value: unknown,
  ctx: z.RefinementCtx,
  path: Array<string | number>,
): void {
  if (!value || typeof value !== "object") return
  if (Array.isArray(value)) {
    value.forEach((item, index) => addForbiddenGeneratedPayloadIssues(item, ctx, [...path, index]))
    return
  }

  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const entryPath = [...path, key]
    if (FORBIDDEN_GENERATED_PAYLOAD_KEY_SET.has(key)) {
      ctx.addIssue({
        code: "custom",
        path: entryPath,
        message: `Generated structured data must not include ${key}`,
      })
    }
    addForbiddenGeneratedPayloadIssues(entry, ctx, entryPath)
  }
}

export const ThemeTokenSpecSchema: z.ZodType<ThemeTokenSpec> = strictObject({
  colors: strictObject({
    accent: cssColorSchema.optional(),
    onAccent: cssColorSchema.optional(),
    bg: cssColorSchema.optional(),
    ink: cssColorSchema.optional(),
    muted: cssColorSchema.optional(),
    card: cssColorSchema.optional(),
    secondary: cssColorSchema.optional(),
    rule: cssColorSchema.optional(),
  }).optional(),
  darkColors: strictObject({
    accent: cssColorSchema.optional(),
    onAccent: cssColorSchema.optional(),
    bg: cssColorSchema.optional(),
    ink: cssColorSchema.optional(),
    muted: cssColorSchema.optional(),
    card: cssColorSchema.optional(),
    secondary: cssColorSchema.optional(),
    rule: cssColorSchema.optional(),
  }).optional(),
  fonts: strictObject({
    title: z.string().min(1).optional(),
    heading: z.string().min(1).optional(),
    text: z.string().min(1).optional(),
    script: z.string().min(1).optional(),
  }).optional(),
  radius: z.string().regex(CSS_LENGTH_REGEX).optional(),
  density: z.enum(["compact", "comfortable", "spacious"]).optional(),
  stylePreset: z.string().regex(/^[a-z0-9-]+$/).optional(),
  borderStyle: z.enum(["solid", "dashed", "none"]).optional(),
  mode: z.enum(["light", "dark"]).optional(),
})

const FooterCompositionLinkSchema = LinkRefSchema
const FooterCompositionItemSchema = strictObject({
  id: nullableString,
  type: z.enum(["brand", "text", "links", "contact", "business", "navigation"]).nullable().optional(),
  label: nullableString,
  text: nullableString,
  links: z.array(FooterCompositionLinkSchema).nullable().optional(),
})
const FooterCompositionColumnSchema: z.ZodType<FooterCompositionColumn> = strictObject({
  id: nullableString,
  items: z.array(FooterCompositionItemSchema).nullable().optional(),
})

const createSiteSettingsSchema = (
  headerFooterChromeVariants: typeof SITE_SHARED_CHROME_VARIANTS | typeof SITE_HEADER_FOOTER_CHROME_VARIANTS,
): z.ZodType<SiteSettings> => strictObject({
    siteName: z.string().min(1),
    siteUrl: z.string().url(),
    description: nullableString,
    language: z.string().min(1),
    aliases: z.array(strictObject({ host: z.string().min(1) })).optional(),
    contactEmail: nullableString,
    branding: strictObject({
      logo: MediaRefSchema.optional(),
      favicon: MediaRefSchema.optional(),
      primaryColor: nullableString,
    }).nullable().optional(),
    chrome: strictObject({
      header: strictObject({
        variant: z.enum(headerFooterChromeVariants).nullable().optional(),
        logo: MediaRefSchema.optional(),
        behavior: z.enum(["static", "sticky"]).nullable().optional(),
        activeMode: z.enum(["path", "anchor", "none"]).nullable().optional(),
        mobileMenu: z.enum(["dropdown", "drawer"]).nullable().optional(),
        cta: LinkRefSchema.nullable().optional(),
      }).nullable().optional(),
      footer: strictObject({
        variant: z.enum(headerFooterChromeVariants).nullable().optional(),
        logo: MediaRefSchema.optional(),
        tagline: nullableString,
        copyright: nullableString,
        legalLinks: z.array(LinkRefSchema).nullable().optional(),
        columns: z.array(FooterCompositionColumnSchema).nullable().optional(),
      }).nullable().optional(),
      banner: strictObject({
        variant: z.enum(SITE_SHARED_CHROME_VARIANTS).nullable().optional(),
        visible: z.boolean().nullable().optional(),
        title: nullableString,
        message: z.string().min(1),
        link: LinkRefSchema.nullable().optional(),
        dismissible: z.boolean().nullable().optional(),
      }).nullable().optional(),
    }).nullable().optional(),
    maintenance: strictObject({
      enabled: z.boolean().nullable().optional(),
      message: nullableString,
    }).nullable().optional(),
    contact: strictObject({
      phone: nullableString,
      address: nullableString,
      social: z.array(strictObject({ platform: z.string().min(1), url: z.string().min(1) })).optional(),
    }).nullable().optional(),
    nap: strictObject({
      legalName: nullableString,
      kvkNumber: nullableString,
      establishmentNumber: nullableString,
      streetAddress: nullableString,
      city: nullableString,
      region: nullableString,
      postalCode: nullableString,
      country: nullableString,
    }).nullable().optional(),
    hours: z.array(strictObject({
      day: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]),
      open: nullableString,
      close: nullableString,
      closed: z.boolean().optional(),
    })).optional(),
    serviceArea: z.array(strictObject({ name: z.string().min(1) })).optional(),
    navHeader: z.array(strictObject({
      label: z.string().min(1),
      href: z.string().min(1),
      external: z.boolean().optional(),
    })).optional(),
    navFooter: z.array(strictObject({
      label: z.string().min(1),
      href: z.string().min(1),
      external: z.boolean().optional(),
    })).optional(),
    analytics: jsonRecordSchema.nullable().optional(),
    analyticsConsent: strictObject({
      enabled: z.boolean().nullable().optional(),
      provider: z.enum(["posthog", "custom"]).nullable().optional(),
      consentStorageKey: nullableString,
      consentVersion: nullableString,
      captureSections: z.boolean().nullable().optional(),
      captureActions: z.boolean().nullable().optional(),
      captureForms: z.boolean().nullable().optional(),
    }).nullable().optional(),
    seoJsonLd: strictObject({
      organization: strictObject({
        enabled: z.boolean().nullable().optional(),
        type: z.enum(["Organization", "LocalBusiness", "ProfessionalService", "HomeAndConstructionBusiness"]).nullable().optional(),
        name: nullableString,
        url: nullableString,
        logo: MediaRefSchema.optional(),
        sameAs: z.array(z.string().url()).nullable().optional(),
      }).nullable().optional(),
      localBusiness: strictObject({
        enabled: z.boolean().nullable().optional(),
        type: z.enum(["LocalBusiness", "ProfessionalService", "HomeAndConstructionBusiness"]).nullable().optional(),
        name: nullableString,
        description: nullableString,
        telephone: nullableString,
        email: nullableString,
        priceRange: nullableString,
        serviceArea: z.array(z.string().min(1)).nullable().optional(),
      }).nullable().optional(),
    }).nullable().optional(),
    updatedAt: z.string().optional(),
  }).superRefine((settings, ctx) => {
  for (const key of FORBIDDEN_GENERATED_PAYLOAD_KEYS) {
    if (Object.prototype.hasOwnProperty.call(settings.chrome?.header ?? {}, key)) {
      ctx.addIssue({
        code: "custom",
        path: ["chrome", "header", key],
        message: `Generated chrome header must not include ${key}`,
      })
    }
    if (Object.prototype.hasOwnProperty.call(settings.chrome?.footer ?? {}, key)) {
      ctx.addIssue({
        code: "custom",
        path: ["chrome", "footer", key],
        message: `Generated chrome footer must not include ${key}`,
      })
    }
    if (Object.prototype.hasOwnProperty.call(settings.chrome?.banner ?? {}, key)) {
      ctx.addIssue({
        code: "custom",
        path: ["chrome", "banner", key],
        message: `Generated chrome banner must not include ${key}`,
      })
    }
  }
})

export const SiteSettingsSchema: z.ZodType<SiteSettings> = createSiteSettingsSchema(SITE_SHARED_CHROME_VARIANTS)
export const OfficialTenantSiteSettingsSchema: z.ZodType<SiteSettings> =
  createSiteSettingsSchema(SITE_HEADER_FOOTER_CHROME_VARIANTS)

export const GeneratedSiteSettingsSchema: z.ZodType<GeneratedSiteSettings> = SiteSettingsSchema
export const OfficialTenantGeneratedSiteSettingsSchema: z.ZodType<GeneratedSiteSettings> =
  OfficialTenantSiteSettingsSchema

const PageSchemaBase = strictObject({
  id: z.string().optional(),
  slug: slugSchema,
  title: z.string().min(1),
  status: z.enum(["draft", "published"]).optional(),
  analytics: jsonRecordSchema.nullable().optional(),
  blocks: z.array(BlockSchema).min(1),
  seo: strictObject({
    title: nullableString,
    description: nullableString,
    ogImage: MediaRefSchema.optional(),
  }).optional(),
  updatedAt: z.string(),
})

export const PageSchema: z.ZodType<Page> = PageSchemaBase

const GeneratedPageSpecSchemaBase = PageSchemaBase.omit({ updatedAt: true, blocks: true }).extend({
  blocks: z.array(GeneratedBlockSpecSchema).min(1),
  updatedAt: z.string().optional(),
})

export const GeneratedPageSpecSchema: z.ZodType<GeneratedPageSpec> = GeneratedPageSpecSchemaBase

const OfficialTenantGeneratedPageSpecSchemaBase = PageSchemaBase.omit({ updatedAt: true, blocks: true }).extend({
  blocks: z.array(OfficialTenantGeneratedBlockSpecSchema).min(1),
  updatedAt: z.string().optional(),
})

export const OfficialTenantGeneratedPageSpecSchema: z.ZodType<GeneratedPageSpec> =
  OfficialTenantGeneratedPageSpecSchemaBase

const IntakeCompanySourceSchema = z.enum(["kvk", "manual"]).nullable()
const IntakeContactActionSchema = z.enum(["message", "appointment", "quote", "phone", "whatsapp"])
const IntakeContactPrimaryActionSchema = z.union([IntakeContactActionSchema, z.literal("")])
const IntakeContactFormTypeSchema = z.enum(["message", "quote", "appointment", "multiple", "none", ""])
const IntakeContactWhatsappModeSchema = z.enum(["none", "same", "other", ""])
const IntakeContactLocationOptionSchema = z.enum(["region", "address", "none"])
const IntakeContactAvailabilityModeSchema = z.enum(["fixed", "appointment_only", "none", ""])
const IntakeWorkModeSchema = z.enum(["on_location", "at_business", "remote", "fixed_region", "nationwide"])
const IntakeVisualLogoModeSchema = z.enum(["uploaded", "textlogo", ""])
const IntakeVisualColorSourceTypeSchema = z.enum(["logo", "preset", "custom", ""])
const IntakeVisualPaletteIdSchema = z.enum(["palette_1", "palette_2", "palette_3", ""])
const IntakeVisualShapeSchema = z.enum(["straight", "slightly_rounded", "rounded", ""])
const IntakeVisualTypographySchema = z.enum(["clear", "soft", "classic", "strong", ""])

export const IntakeVisualThemeTokensSchema = strictObject({
  background: z.string(),
  foreground: z.string(),
  card: z.string(),
  cardForeground: z.string(),
  primary: z.string(),
  primaryForeground: z.string(),
  secondary: z.string(),
  secondaryForeground: z.string(),
  muted: z.string(),
  mutedForeground: z.string(),
  accent: z.string(),
  accentForeground: z.string(),
  border: z.string(),
  input: z.string(),
  ring: z.string(),
  destructive: z.string(),
  destructiveForeground: z.string(),
})

export const RawIntakeSubmissionSchema: z.ZodType<RawIntakeSubmission> = strictObject({
  submittedAt: z.string().optional(),
  source: z.string().optional(),
  company: strictObject({
    source: IntakeCompanySourceSchema,
    companyName: z.string(),
    kvkNumber: z.string(),
    address: z.string(),
    website: z.string(),
    mainActivity: z.string(),
    secondaryActivities: z.array(z.string()),
  }),
  content: strictObject({
    intro: z.string(),
    offers: z.array(strictObject({ value: z.string() })),
    audience: z.string(),
    situation: z.string(),
    approach: z.string(),
    workModes: z.array(IntakeWorkModeSchema),
    region: z.string(),
    notes: z.string(),
  }),
  contact: strictObject({
    selectedActions: z.array(IntakeContactActionSchema),
    formType: IntakeContactFormTypeSchema,
    formOptions: z.array(z.enum(["message", "quote", "appointment"])),
    primaryAction: IntakeContactPrimaryActionSchema,
    phoneNumber: z.string(),
    whatsappMode: IntakeContactWhatsappModeSchema,
    whatsappNumber: z.string(),
    locationOptions: z.array(IntakeContactLocationOptionSchema),
    publicRegion: z.string(),
    publicAddress: z.string(),
    availabilityMode: IntakeContactAvailabilityModeSchema,
    openingHours: z.string(),
  }),
  visual: strictObject({
    logo: strictObject({
      mode: IntakeVisualLogoModeSchema,
      file: z.unknown().nullable(),
      text: z.string(),
    }),
    color: strictObject({
      sourceType: IntakeVisualColorSourceTypeSchema,
      sourceValue: z.string(),
      selectedPalette: IntakeVisualPaletteIdSchema,
      tokens: IntakeVisualThemeTokensSchema,
    }),
    shape: IntakeVisualShapeSchema,
    typography: IntakeVisualTypographySchema,
  }),
  finalDetails: strictObject({
    name: z.string(),
    email: z.string(),
    phone: z.string(),
  }),
  domain: nullableString,
  email: nullableString,
  addOns: z.array(z.string()).nullable().optional(),
  notes: nullableString,
})

export const IntakeSubmissionSchema: z.ZodType<IntakeSubmission> = strictObject({
  submittedAt: z.string().optional(),
  source: z.string().optional(),
  businessName: z.string().min(1),
  domain: nullableString,
  contactName: nullableString,
  contactEmail: nullableString,
  contactPhone: nullableString,
  language: nullableString,
  industry: nullableString,
  serviceArea: z.array(z.string()).nullable().optional(),
  goals: z.array(z.string()).nullable().optional(),
  pages: z.array(strictObject({
    slug: nullableString,
    title: z.string().min(1),
    purpose: nullableString,
  })).nullable().optional(),
  brand: strictObject({
    colors: z.array(z.string()).nullable().optional(),
    fonts: z.array(z.string()).nullable().optional(),
    tone: z.array(z.string()).nullable().optional(),
    assets: z.array(MediaRefSchema).nullable().optional(),
  }).nullable().optional(),
  content: jsonRecordSchema.nullable().optional(),
  notes: nullableString,
})

export const PublicIntakeSubmissionSchema: z.ZodType<PublicIntakeSubmission> =
  z.union([IntakeSubmissionSchema, RawIntakeSubmissionSchema])

export const CompanyFactsSchema: z.ZodType<CompanyFacts> = strictObject({
  source: IntakeCompanySourceSchema,
  companyName: z.string().min(1),
  kvkNumber: nullableString,
  address: nullableString,
  website: nullableString,
  mainActivity: nullableString,
  secondaryActivities: z.array(z.string()),
})

export const IntakeBriefSchema: z.ZodType<IntakeBrief> = strictObject({
  intro: nullableString,
  services: z.array(z.string()),
  audience: nullableString,
  customerSituation: nullableString,
  approach: nullableString,
  workModes: z.array(IntakeWorkModeSchema),
  serviceArea: z.array(z.string()),
  proofTrust: z.array(z.string()),
  contactPreferences: strictObject({
    selectedActions: z.array(IntakeContactActionSchema),
    primaryAction: IntakeContactActionSchema.nullable().optional(),
    formType: z.enum(["message", "quote", "appointment", "multiple", "none"]).nullable().optional(),
    formOptions: z.array(z.enum(["message", "quote", "appointment"])),
    phoneNumber: nullableString,
    whatsappNumber: nullableString,
    locationOptions: z.array(IntakeContactLocationOptionSchema),
    publicRegion: nullableString,
    publicAddress: nullableString,
    availabilityMode: z.enum(["fixed", "appointment_only", "none"]).nullable().optional(),
    openingHours: nullableString,
  }),
  callsToAction: z.array(IntakeContactActionSchema),
  visualPreferences: strictObject({
    logoMode: z.enum(["uploaded", "textlogo"]).nullable().optional(),
    logoText: nullableString,
    colorSourceType: z.enum(["logo", "preset", "custom"]).nullable().optional(),
    colorSourceValue: nullableString,
    selectedPalette: z.enum(["palette_1", "palette_2", "palette_3"]).nullable().optional(),
    tokens: IntakeVisualThemeTokensSchema.nullable().optional(),
    shape: z.enum(["straight", "slightly_rounded", "rounded"]).nullable().optional(),
    typography: z.enum(["clear", "soft", "classic", "strong"]).nullable().optional(),
  }),
  tone: z.array(z.string()),
  notes: nullableString,
  domainInterest: nullableString,
  emailInterest: nullableString,
  addOnInterest: z.array(z.string()),
})

export const NormalizedIntakeSchema: z.ZodType<NormalizedIntake> = strictObject({
  businessName: z.string().min(1),
  tenantSlug: slugSchema,
  primaryDomain: hostnameSchema,
  siteUrl: z.string().url(),
  language: z.string().min(1),
  contact: strictObject({
    name: nullableString,
    email: nullableString,
    phone: nullableString,
  }).nullable().optional(),
  industry: nullableString,
  serviceArea: z.array(z.string()),
  goals: z.array(z.string()),
  requestedPages: z.array(strictObject({
    slug: slugSchema,
    title: z.string().min(1),
    purpose: nullableString,
  })).min(1),
  brandSignals: strictObject({
    colors: z.array(z.string()).optional(),
    fonts: z.array(z.string()).optional(),
    tone: z.array(z.string()).optional(),
    assets: z.array(MediaRefSchema).optional(),
  }).nullable().optional(),
  companyFacts: CompanyFactsSchema.nullable().optional(),
  intakeBrief: IntakeBriefSchema.nullable().optional(),
  raw: jsonRecordSchema.nullable().optional(),
})

export const GenerationInputSchema: z.ZodType<GenerationInput> = z.lazy(() =>
  strictObject({
    schemaVersion: z.literal(1),
    status: z.enum(["draft", "ai-prepared", "admin-approved"]),
    companyFacts: CompanyFactsSchema,
    brief: IntakeBriefSchema,
    normalizedIntake: NormalizedIntakeSchema,
    approvedAt: nullableString,
    approvedBy: nullableString,
    preparedAt: nullableString,
    notes: nullableString,
  }),
)

export const SiteBlockEditorFieldSchema: z.ZodType<SiteBlockEditorField> = z.lazy(() =>
  strictObject({
    name: z.string().min(1),
    label: z.string().optional(),
    kind: z.enum(["richtext", "text", "image", "icon", "cta", "array", "select", "checkbox"]),
    role: z.enum(["title", "heading", "text", "script"]).optional(),
    variant: z.enum(["block", "inline"]).optional(),
    itemLabel: z.string().optional(),
    itemFields: z.array(SiteBlockEditorFieldSchema).optional(),
    options: z.array(strictObject({ label: z.string(), value: z.string() })).optional(),
  }),
)

export const SiteBlockManifestItemSchema: z.ZodType<SiteBlockManifestItem> = strictObject({
  slug: z.enum(SITE_GENERATION_BLOCK_SLUGS),
  label: z.string().optional(),
  defaultAnchor: z.string().optional(),
  fields: z.array(SiteBlockEditorFieldSchema).optional(),
})

const createSiteGenerationSpecSchema = (
  settingsSchema: z.ZodType<GeneratedSiteSettings>,
  pageSchema: z.ZodType<GeneratedPageSpec>,
): z.ZodType<SiteGenerationSpec> => strictObject({
  schemaVersion: z.literal(1),
  intake: NormalizedIntakeSchema,
  tenant: strictObject({
    name: z.string().min(1),
    slug: slugSchema,
    domain: hostnameSchema,
    status: z.enum(["provisioning", "active", "suspended", "archived"]).optional(),
  }),
  theme: ThemeTokenSpecSchema,
  settings: settingsSchema,
  pages: z.array(pageSchema).min(1),
  blocks: z.array(SiteBlockManifestItemSchema).optional(),
  assets: z.array(MediaRefSchema).optional(),
  generatedAt: z.string().optional(),
  generator: strictObject({
    name: z.string().optional(),
    version: z.string().optional(),
    model: z.string().optional(),
  }).nullable().optional(),
})

export const SiteGenerationSpecSchema: z.ZodType<SiteGenerationSpec> =
  createSiteGenerationSpecSchema(GeneratedSiteSettingsSchema, GeneratedPageSpecSchema)

const tenantExclusiveBlockVariantAllowedForTenant = (
  blockType: string,
  field: "variant" | "sectionVariant",
  value: string | null | undefined,
  tenantSlug: string,
): boolean => {
  if (!value || !SITE_GENERATION_BLOCK_SLUGS.includes(blockType as SiteGenerationBlockSlug)) return true
  const catalogEntry = SITE_GENERATION_BLOCK_CATALOG
    .filter((entry) => entry.slug === blockType)
    .flatMap((entry) => entry.variants as readonly SiteBlockCatalogVariant[])
    .find((variant) => field === "variant" ? variant.variant === value : variant.sectionVariant === value)
  if (!catalogEntry || catalogEntry.scope.kind === "global") return true
  return catalogEntry.scope.tenantSlugs.includes(tenantSlug)
}

const tenantExclusiveChromeVariantAllowedForTenant = (
  area: "header" | "footer" | "banner",
  value: string | null | undefined,
  tenantSlug: string,
): boolean => {
  if (!value) return true
  const catalogEntry = SITE_CHROME_CATALOG.find((entry) => entry.area === area && entry.variant === value)
  if (!catalogEntry || catalogEntry.scope.kind === "global") return true
  return catalogEntry.scope.tenantSlugs.includes(tenantSlug)
}

const refineOfficialTenantVariantOwnership = (
  value: { tenant?: { slug?: string } | null; tenantSlug?: string; settings?: GeneratedSiteSettings; pages?: GeneratedPageSpec[] },
  ctx: z.RefinementCtx,
): void => {
  const tenantSlug = value.tenant?.slug ?? value.tenantSlug
  if (!tenantSlug) return

  const chrome = value.settings?.chrome
  for (const area of ["header", "footer", "banner"] as const) {
    const variant = chrome?.[area]?.variant
    if (!tenantExclusiveChromeVariantAllowedForTenant(area, variant, tenantSlug)) {
      ctx.addIssue({
        code: "custom",
        path: ["settings", "chrome", area, "variant"],
        message: `Chrome variant "${variant}" is not allowed for official tenant "${tenantSlug}"`,
      })
    }
  }

  value.pages?.forEach((page, pageIndex) => {
    page.blocks.forEach((block, blockIndex) => {
      if (!tenantExclusiveBlockVariantAllowedForTenant(block.blockType, "variant", block.variant, tenantSlug)) {
        ctx.addIssue({
          code: "custom",
          path: ["pages", pageIndex, "blocks", blockIndex, "variant"],
          message: `Block variant "${block.variant}" is not allowed for official tenant "${tenantSlug}"`,
        })
      }
      const sectionVariant = block.analytics?.sectionVariant
      if (!block.variant && !tenantExclusiveBlockVariantAllowedForTenant(block.blockType, "sectionVariant", sectionVariant, tenantSlug)) {
        ctx.addIssue({
          code: "custom",
          path: ["pages", pageIndex, "blocks", blockIndex, "analytics", "sectionVariant"],
          message: `Block section variant "${sectionVariant}" is not allowed for official tenant "${tenantSlug}"`,
        })
      }
    })
  })
}

export const OfficialTenantSiteGenerationSpecSchema: z.ZodType<SiteGenerationSpec> =
  createSiteGenerationSpecSchema(
    OfficialTenantGeneratedSiteSettingsSchema,
    OfficialTenantGeneratedPageSpecSchema,
  ).superRefine(refineOfficialTenantVariantOwnership)

export const PublishedSnapshotManifestEntrySchema = strictObject({
  type: z.enum(["page", "media", "settings"]),
  key: z.string().min(1),
  updatedAt: z.string(),
})

export const PublishedSnapshotManifestSchema = strictObject({
  tenantId: z.string().min(1),
  version: z.number().int().positive(),
  updatedAt: z.string(),
  entries: z.array(PublishedSnapshotManifestEntrySchema).min(1),
})

const PublishedSnapshotPageSchema = GeneratedPageSpecSchemaBase.extend({
  status: z.literal("published"),
  updatedAt: z.string(),
})

const OfficialTenantPublishedSnapshotPageSchema = OfficialTenantGeneratedPageSpecSchemaBase.extend({
  status: z.literal("published"),
  updatedAt: z.string(),
})

const createPublishedSiteSnapshotSchema = (
  settingsSchema: z.ZodType<GeneratedSiteSettings>,
  pageSchema: z.ZodType<GeneratedPageSpec>,
): z.ZodType<PublishedSiteSnapshot> => strictObject({
  schemaVersion: z.literal(1),
  tenantId: z.string().min(1),
  tenantSlug: slugSchema,
  domain: hostnameSchema,
  siteUrl: z.string().url(),
  manifest: PublishedSnapshotManifestSchema,
  settings: settingsSchema,
  pages: z.array(pageSchema).min(1),
  theme: ThemeTokenSpecSchema.nullable().optional(),
  blocks: z.array(SiteBlockManifestItemSchema).optional(),
  media: z.array(MediaRefSchema).optional(),
  publishedAt: z.string().optional(),
}).superRefine((snapshot, ctx) => {
  if (snapshot.manifest.tenantId !== snapshot.tenantId) {
    ctx.addIssue({
      code: "custom",
      path: ["manifest", "tenantId"],
      message: "Snapshot manifest tenantId must match snapshot tenantId",
    })
  }
})

export const PublishedSiteSnapshotSchema: z.ZodType<PublishedSiteSnapshot> =
  createPublishedSiteSnapshotSchema(GeneratedSiteSettingsSchema, PublishedSnapshotPageSchema)

export const OfficialTenantPublishedSiteSnapshotSchema: z.ZodType<PublishedSiteSnapshot> =
  createPublishedSiteSnapshotSchema(
    OfficialTenantGeneratedSiteSettingsSchema,
    OfficialTenantPublishedSnapshotPageSchema,
  ).superRefine(refineOfficialTenantVariantOwnership)

export const OFFICIAL_TENANT_PUBLISHED_SNAPSHOT_SLUGS = [
  "ami-care",
  "amicare",
  "amicare-renderer",
] as const

const OFFICIAL_TENANT_PUBLISHED_SNAPSHOT_SLUG_SET = new Set<string>(OFFICIAL_TENANT_PUBLISHED_SNAPSHOT_SLUGS)

export function isOfficialTenantPublishedSnapshotSlug(tenantSlug: string | null | undefined): boolean {
  return OFFICIAL_TENANT_PUBLISHED_SNAPSHOT_SLUG_SET.has((tenantSlug ?? "").trim().toLowerCase())
}

export function schemaForPublishedSiteSnapshot(
  snapshot: Pick<PublishedSiteSnapshot, "tenantSlug"> | { tenantSlug?: string | null },
): z.ZodType<PublishedSiteSnapshot> {
  return isOfficialTenantPublishedSnapshotSlug(snapshot.tenantSlug)
    ? OfficialTenantPublishedSiteSnapshotSchema
    : PublishedSiteSnapshotSchema
}

export const ValidationIssueSchema: z.ZodType<ValidationIssue> = strictObject({
  severity: z.enum(["error", "warning", "info"]),
  code: z.string().min(1),
  message: z.string().min(1),
  path: z.array(z.union([z.string(), z.number()])).optional(),
})

export const ValidationReportSchema: z.ZodType<ValidationReport> = strictObject({
  valid: z.boolean(),
  issues: z.array(ValidationIssueSchema),
})

export const CmsApplyResultSchema: z.ZodType<CmsApplyResult> = strictObject({
  ok: z.boolean(),
  tenantId: z.union([z.string(), z.number()]).optional(),
  tenantSlug: z.string().optional(),
  pageIds: z.array(z.union([z.string(), z.number()])).optional(),
  settingsId: z.union([z.string(), z.number()]).optional(),
  validation: ValidationReportSchema,
})

export const formatContractValidationIssues = (error: z.ZodError): string =>
  error.issues
    .map((entry) => {
      const path = entry.path.length > 0 ? `${entry.path.join(".")}: ` : ""
      return `${path}${entry.message}`
    })
    .join("; ")

export const contractValidationReport = (error: z.ZodError): ValidationReport => ({
  valid: false,
  issues: error.issues.map((entry) => ({
    severity: "error",
    code: "invalid_contract_shape",
    message: entry.message,
    path: entry.path.filter((item): item is string | number => typeof item === "string" || typeof item === "number"),
  })),
})
