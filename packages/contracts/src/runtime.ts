import { z } from "zod"
import { SITE_SOURCE_BACKED_BLOCK_VARIANTS } from "./block-catalog"
import { SITE_BLOCK_SLUGS } from "./site"
import type {
  AnalyticsBlockMetadata,
  Block,
  ContactSectionBlock,
  CTABlock,
  FAQBlock,
  FeatureListBlock,
  FooterCompositionColumn,
  HeroBlock,
  LinkRef,
  MediaRef,
  Page,
  RichTextBlock,
  SiteSettings,
  SiteBlockSlug,
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
  SITE_BLOCK_SLUGS.map((slug) => [
    slug,
    new Set(
      SITE_SOURCE_BACKED_BLOCK_VARIANTS
        .filter((variant) => variant.slug === slug)
        .map((variant) => variant.sectionVariant)
        .filter((variant): variant is string => typeof variant === "string" && variant.length > 0),
    ),
  ]),
) as unknown as Record<SiteBlockSlug, ReadonlySet<string>>

export const isSupportedBlockSectionVariant = (
  blockType: string,
  sectionVariant: string | null | undefined,
): boolean => {
  if (!sectionVariant) return true
  if (!SITE_BLOCK_SLUGS.includes(blockType as SiteBlockSlug)) return false
  return SITE_SECTION_VARIANTS_BY_BLOCK_SLUG[blockType as SiteBlockSlug]?.has(sectionVariant) ?? false
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
])

export const BlockSchema: z.ZodType<Block> = BlockSchemaBase.superRefine((block, ctx) => {
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
})

export const GeneratedBlockSpecSchema: z.ZodType<GeneratedBlockSpec> = BlockSchema

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
    }).nullable().optional(),
    footer: strictObject({
      logo: MediaRefSchema.optional(),
      tagline: nullableString,
      copyright: nullableString,
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
  slug: z.enum(SITE_BLOCK_SLUGS),
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
