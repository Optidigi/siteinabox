import { z } from "zod"
import { SITE_GENERATION_BLOCK_CATALOG, type SiteBlockCatalogVariant } from "./block-catalog"
import { SITE_GENERATION_BLOCK_SLUGS } from "./site"
import type {
  AnalyticsBlockMetadata,
  Block,
  BeforeAfterGalleryBlock,
  ContactSectionBlock,
  ContactDetailsBlock,
  CTABlock,
  FAQBlock,
  FeatureListBlock,
  FormProviderConfig,
  FooterCompositionColumn,
  HeroBlock,
  InfoCardListBlock,
  LinkRef,
  MediaRef,
  MediaHeroBlock,
  Page,
  RichTextBlock,
  SiteSettings,
  SiteGenerationBlockSlug,
  ServiceCarouselBlock,
  TestimonialsBlock,
} from "./site"
import type {
  CmsApplyResult,
  GeneratedBlockSpec,
  GeneratedPageSpec,
  GeneratedSiteSettings,
  IntakeSubmission,
  NormalizedIntake,
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

const strictObject = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict()
const nullableString = z.string().nullable().optional()
const jsonRecordSchema = z.record(z.string(), z.unknown())
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

export const isSupportedBlockSectionVariant = (
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

export const MediaHeroBlockSchema: z.ZodType<MediaHeroBlock> = strictObject({
  blockType: z.literal("mediaHero"),
  ...baseBlockShape,
  eyebrow: RtFieldSchema.optional(),
  headline: RtRootSchema,
  subheadline: RtFieldSchema.optional(),
  cta: LinkRefSchema.nullable().optional(),
  secondary: LinkRefSchema.nullable().optional(),
  backgroundImage: MediaRefSchema,
  foregroundImage: MediaRefSchema.optional(),
  overlay: strictObject({
    color: nullableString,
    opacity: z.number().min(0).max(1).nullable().optional(),
  }).nullable().optional(),
  minHeight: z.enum(["compact", "standard", "tall", "viewport"]).nullable().optional(),
  contentAlign: z.enum(["left", "center", "right"]).nullable().optional(),
  contentWidth: z.enum(["narrow", "wide"]).nullable().optional(),
  shapeDividers: strictObject({
    top: z.enum(["mountains", "wave-brush", "none"]).nullable().optional(),
    bottom: z.enum(["mountains", "wave-brush", "none"]).nullable().optional(),
  }).nullable().optional(),
  priority: z.boolean().nullable().optional(),
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

export const InfoCardListBlockSchema: z.ZodType<InfoCardListBlock> = strictObject({
  blockType: z.literal("infoCardList"),
  ...baseBlockShape,
  title: RtFieldSchema.optional(),
  intro: RtFieldSchema.optional(),
  layout: z.enum(["row", "grid", "stack"]).nullable().optional(),
  iconPosition: z.enum(["top", "left"]).nullable().optional(),
  items: z
    .array(strictObject({
      title: RtRootSchema,
      description: RtFieldSchema.optional(),
      icon: nullableString,
      image: MediaRefSchema.optional(),
      link: LinkRefSchema.nullable().optional(),
      animation: z.enum(["fadeInUp", "fadeInDown", "float", "grow", "none"]).nullable().optional(),
    }))
    .min(1),
})

export const ServiceCarouselBlockSchema: z.ZodType<ServiceCarouselBlock> = strictObject({
  blockType: z.literal("serviceCarousel"),
  ...baseBlockShape,
  title: RtFieldSchema.optional(),
  intro: RtFieldSchema.optional(),
  layout: z.enum(["carousel", "grid"]).nullable().optional(),
  items: z
    .array(strictObject({
      title: RtRootSchema,
      description: RtFieldSchema.optional(),
      image: MediaRefSchema.optional(),
      cta: LinkRefSchema.nullable().optional(),
    }))
    .min(1),
  carousel: strictObject({
    slidesPerView: z.number().min(1).max(6).nullable().optional(),
    slidesPerViewTablet: z.number().min(1).max(6).nullable().optional(),
    slidesPerViewMobile: z.number().min(1).max(6).nullable().optional(),
    spaceBetween: z.number().min(0).max(128).nullable().optional(),
    autoplay: z.boolean().nullable().optional(),
    autoplayDelayMs: z.number().int().min(500).max(30000).nullable().optional(),
    loop: z.boolean().nullable().optional(),
    pagination: z.enum(["bullets", "fraction", "none"]).nullable().optional(),
    pauseOnInteraction: z.boolean().nullable().optional(),
  }).nullable().optional(),
})

export const BeforeAfterGalleryBlockSchema: z.ZodType<BeforeAfterGalleryBlock> = strictObject({
  blockType: z.literal("beforeAfterGallery"),
  ...baseBlockShape,
  title: RtFieldSchema.optional(),
  intro: RtFieldSchema.optional(),
  pairs: z
    .array(strictObject({
      before: MediaRefSchema,
      after: MediaRefSchema,
      beforeLabel: nullableString,
      afterLabel: nullableString,
      caption: RtFieldSchema.optional(),
      initialRatio: z.number().min(0).max(1).nullable().optional(),
      orientation: z.enum(["horizontal", "vertical"]).nullable().optional(),
    }))
    .min(1),
})

export const ContactDetailsBlockSchema: z.ZodType<ContactDetailsBlock> = strictObject({
  blockType: z.literal("contactDetails"),
  ...baseBlockShape,
  title: RtFieldSchema.optional(),
  intro: RtFieldSchema.optional(),
  layout: z.enum(["cards", "split", "list"]).nullable().optional(),
  items: z
    .array(strictObject({
      kind: z.enum(["phone", "email", "address", "hours", "legal", "custom"]).nullable().optional(),
      label: z.string().min(1),
      value: RtRootSchema,
      href: nullableString,
      icon: nullableString,
      image: MediaRefSchema.optional(),
    }))
    .min(1),
  legal: strictObject({
    kvkNumber: nullableString,
    btwId: nullableString,
    iban: nullableString,
    bic: nullableString,
  }).nullable().optional(),
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

const BlockSchemaBase = z.union([
  HeroBlockSchema,
  MediaHeroBlockSchema,
  FeatureListBlockSchema,
  InfoCardListBlockSchema,
  ServiceCarouselBlockSchema,
  BeforeAfterGalleryBlockSchema,
  ContactDetailsBlockSchema,
  TestimonialsBlockSchema,
  FAQBlockSchema,
  CTABlockSchema,
  RichTextBlockSchema,
  ContactSectionBlockSchema,
])

const GeneratedBlockSchemaBase = z.union([
  HeroBlockSchema,
  MediaHeroBlockSchema,
  FeatureListBlockSchema,
  InfoCardListBlockSchema,
  ServiceCarouselBlockSchema,
  BeforeAfterGalleryBlockSchema,
  ContactDetailsBlockSchema,
  TestimonialsBlockSchema,
  FAQBlockSchema,
  CTABlockSchema,
  RichTextBlockSchema,
  ContactSectionBlockSchema,
])

const refineGeneratedBlock = (block: { blockType: string; analytics?: AnalyticsBlockMetadata | null }, ctx: z.RefinementCtx) => {
  for (const key of ["className", "classes", "rawHtml", "html", "component", "sourceCode", "filePath"]) {
    if (Object.prototype.hasOwnProperty.call(block, key)) {
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: `Generated blocks must not include ${key}`,
      })
    }
  }

  const sectionVariant = block.analytics?.sectionVariant
  if (typeof sectionVariant === "string" && sectionVariant.length > 0 && !isSupportedBlockSectionVariant(block.blockType, sectionVariant)) {
    ctx.addIssue({
      code: "custom",
      path: ["analytics", "sectionVariant"],
      message: `Unsupported section variant "${sectionVariant}" for block type "${block.blockType}"`,
    })
  }
}

export const BlockSchema: z.ZodType<Block> = BlockSchemaBase.superRefine(refineGeneratedBlock)

export const GeneratedBlockSpecSchema: z.ZodType<GeneratedBlockSpec> =
  GeneratedBlockSchemaBase.superRefine(refineGeneratedBlock)

export const ThemeTokenSpecSchema: z.ZodType<ThemeTokenSpec> = strictObject({
  colors: strictObject({
    accent: cssColorSchema.optional(),
    bg: cssColorSchema.optional(),
    ink: cssColorSchema.optional(),
    muted: cssColorSchema.optional(),
    card: cssColorSchema.optional(),
    secondary: cssColorSchema.optional(),
    rule: cssColorSchema.optional(),
  }).optional(),
  darkColors: strictObject({
    accent: cssColorSchema.optional(),
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

export const SiteSettingsSchema: z.ZodType<SiteSettings> = strictObject({
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
      logo: MediaRefSchema.optional(),
      behavior: z.enum(["static", "sticky"]).nullable().optional(),
      activeMode: z.enum(["path", "anchor", "none"]).nullable().optional(),
      mobileMenu: z.enum(["dropdown", "drawer"]).nullable().optional(),
      cta: LinkRefSchema.nullable().optional(),
    }).nullable().optional(),
    footer: strictObject({
      logo: MediaRefSchema.optional(),
      tagline: nullableString,
      copyright: nullableString,
      legalLinks: z.array(LinkRefSchema).nullable().optional(),
      columns: z.array(FooterCompositionColumnSchema).nullable().optional(),
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
})

export const GeneratedSiteSettingsSchema: z.ZodType<GeneratedSiteSettings> = SiteSettingsSchema

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
  raw: jsonRecordSchema.nullable().optional(),
})

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

export const SiteGenerationSpecSchema: z.ZodType<SiteGenerationSpec> = strictObject({
  schemaVersion: z.literal(1),
  intake: NormalizedIntakeSchema,
  tenant: strictObject({
    name: z.string().min(1),
    slug: slugSchema,
    domain: hostnameSchema,
    status: z.enum(["provisioning", "active", "suspended", "archived"]).optional(),
  }),
  theme: ThemeTokenSpecSchema,
  settings: GeneratedSiteSettingsSchema,
  pages: z.array(GeneratedPageSpecSchema).min(1),
  blocks: z.array(SiteBlockManifestItemSchema).optional(),
  assets: z.array(MediaRefSchema).optional(),
  generatedAt: z.string().optional(),
  generator: strictObject({
    name: z.string().optional(),
    version: z.string().optional(),
    model: z.string().optional(),
  }).nullable().optional(),
})

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

export const PublishedSiteSnapshotSchema: z.ZodType<PublishedSiteSnapshot> = strictObject({
  schemaVersion: z.literal(1),
  tenantId: z.string().min(1),
  tenantSlug: slugSchema,
  domain: hostnameSchema,
  siteUrl: z.string().url(),
  manifest: PublishedSnapshotManifestSchema,
  settings: GeneratedSiteSettingsSchema,
  pages: z.array(PublishedSnapshotPageSchema).min(1),
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
