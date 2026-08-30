import { z } from "zod"
import {
  COLOR_SCHEME_IDS,
  FONT_SCHEME_IDS,
  BACKGROUND_MODE_IDS,
  SHAPE_SCHEME_IDS,
} from "./theme-presets"
import { CURRENT_INTAKE_TERMS_ACCEPTANCE } from "./intake-legal"
import {
  DEFAULT_NAVBAR_PLACEMENT,
  DEFAULT_NAVBAR_VARIANT,
  CONSENT_VARIANTS,
  DEFAULT_CONSENT_VARIANT,
  DEFAULT_FOOTER_VARIANT,
  FOOTER_VARIANTS,
  NAVBAR_PLACEMENTS,
  NAVBAR_VARIANTS,
  SITE_BLOCK_SLUGS,
  type SiteBlockSlug,
  type SiteSettings,
  type Page,
  type Block,
  type LinkRef,
  type MediaRef,
  type NavLink,
  type FooterCompositionColumn,
} from "./site"
import {
  AboutBlockSchema,
  BlockSchema as OwnedBlockSchema,
  ContactBlockSchema,
  CtaBlockSchema,
  FaqBlockSchema,
  HeroBlockSchema,
  ProcessBlockSchema,
  PricingBlockSchema,
  ReviewsBlockSchema,
  ServicesBlockSchema,
  WorkBlockSchema,
} from "./blocks"
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
const strictObject = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict()
const nullableString = z.string().nullable().optional()
const jsonRecordSchema = z.record(z.string(), z.unknown())
const FORBIDDEN_GENERATED_PAYLOAD_KEYS = [
  "className",
  "classes",
  "tailwindClasses",
  "rawHtml",
  "html",
  "css",
  "component",
  "imports",
  "jsx",
  "tsx",
  "sourceCode",
  "filePath",
  "tokens",
  "style",
  "color",
  "font",
] as const
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
export const RtFieldSchema = RtRootSchema.nullable()

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

export const LinkRefSchema: z.ZodType<LinkRef> = strictObject({
  label: nullableString,
  href: nullableString,
  external: z.boolean().nullable().optional(),
})

const NavigationIconSchema = z.enum(["backpack", "cake-slice", "coffee", "grape", "hotel", "ice-cream", "map-pin", "package", "pizza", "plane", "sandwich", "smile"])
export const NavLinkSchema: z.ZodType<NavLink> = z.lazy(() => strictObject({
  label: z.string().trim().min(1).max(32),
  href: z.string().trim().min(1).nullable().optional(),
  external: z.boolean().optional(),
  description: z.string().trim().max(90).nullable().optional(),
  icon: NavigationIconSchema.nullable().optional(),
  children: z.array(NavLinkSchema).min(1).max(6).nullable().optional(),
}).superRefine((value, ctx) => {
  const hasHref = Boolean(value.href?.trim())
  const hasChildren = Boolean(value.children?.length)
  if (hasHref === hasChildren) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Navigation items require exactly one of href or children." })
  if (hasChildren && value.external) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["external"], message: "Navigation groups cannot be external links." })
}))


export {
  AboutBlockSchema,
  ContactBlockSchema,
  CtaBlockSchema,
  FaqBlockSchema,
  HeroBlockSchema,
  ProcessBlockSchema,
  PricingBlockSchema,
  ReviewsBlockSchema,
  ServicesBlockSchema,
  WorkBlockSchema,
}

export const GeneratedBlockSpecSchema: z.ZodType<GeneratedBlockSpec> = OwnedBlockSchema
const BlockSchema = OwnedBlockSchema
const ThemeTokenSpecV3Schema = strictObject({
  version: z.literal(3),
  appearance: strictObject({
    mode: z.enum(["light", "dark", "system"]),
    backgroundMode: z.enum(BACKGROUND_MODE_IDS).optional(),
  }),
  colors: strictObject({
    schemeId: z.enum(COLOR_SCHEME_IDS),
  }),
  fonts: strictObject({
    schemeId: z.enum(FONT_SCHEME_IDS),
  }),
  shape: strictObject({
    schemeId: z.enum(SHAPE_SCHEME_IDS),
  }),
})

export const ThemeTokenSpecSchema: z.ZodType<ThemeTokenSpec> = ThemeTokenSpecV3Schema

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

export const TenantPrivacyDisclosureSchema: z.ZodType<NonNullable<SiteSettings["privacyDisclosure"]>> = strictObject({
  enabled: z.boolean().nullable().optional(),
  mode: z.enum(["template", "custom"]).nullable().optional(),
  title: nullableString,
  body: RtFieldSchema.optional(),
  version: z.string().min(1),
  effectiveAt: z.iso.datetime(),
  controller: strictObject({
    legalName: z.string().min(1),
    tradeName: nullableString,
    email: z.email(),
    privacyEmail: z.email().nullable().optional(),
    kvkNumber: nullableString,
    address: nullableString,
  }),
  contactMethods: strictObject({
    email: z.boolean().nullable().optional(),
    phone: z.boolean().nullable().optional(),
    whatsapp: z.boolean().nullable().optional(),
    forms: strictObject({
      enabled: z.boolean(),
      mode: z.enum(["direct", "forwarded", "cms"]),
      retention: z.discriminatedUnion("kind", [
        strictObject({ kind: z.literal("days"), days: z.number().int().positive().max(3650) }),
        strictObject({ kind: z.literal("active_agreement") }),
      ]).nullable().optional(),
    }).nullable().optional(),
  }).nullable().optional(),
  marketingTechnologies: z.array(strictObject({
    name: z.string().min(1),
    purpose: z.string().min(1),
  })).nullable().optional(),
  additionalProcessors: z.array(strictObject({
    name: z.string().min(1),
    purpose: z.string().min(1),
    location: nullableString,
  })).nullable().optional(),
})

const createSiteSettingsSchema = (): z.ZodType<SiteSettings> => strictObject({
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
      navbar: strictObject({
        variant: z.enum(NAVBAR_VARIANTS).default(DEFAULT_NAVBAR_VARIANT),
        placement: z.enum(NAVBAR_PLACEMENTS).default(DEFAULT_NAVBAR_PLACEMENT),
        logo: MediaRefSchema.optional(),
        activeMode: z.enum(["path", "anchor", "none"]).nullable().optional(),
        mobileMenu: z.enum(["dropdown", "drawer"]).nullable().optional(),
        showThemeToggle: z.boolean().nullable().optional(),
        cta: LinkRefSchema.nullable().optional(),
      }).nullable().optional(),
      footer: strictObject({
        variant: z.enum(FOOTER_VARIANTS).default(DEFAULT_FOOTER_VARIANT),
        logo: MediaRefSchema.optional(),
        tagline: nullableString,
        copyright: nullableString,
        legalLinks: z.array(LinkRefSchema).nullable().optional(),
        columns: z.array(FooterCompositionColumnSchema).nullable().optional(),
        newsletter: strictObject({
          title: nullableString,
          placeholder: nullableString,
          submitLabel: nullableString,
          action: nullableString,
          method: z.enum(["GET", "POST"]).nullable().optional(),
        }).nullable().optional(),
      }).nullable().optional(),
      announcement: strictObject({
        visible: z.boolean().nullable().optional(),
        title: nullableString,
        message: nullableString,
        link: LinkRefSchema.nullable().optional(),
        dismissible: z.boolean().nullable().optional(),
      }).nullable().optional(),
    }).nullable().optional(),
    consent: strictObject({
      variant: z.enum(CONSENT_VARIANTS).default(DEFAULT_CONSENT_VARIANT),
      visible: z.boolean().nullable().optional(),
      title: nullableString,
      message: nullableString,
      acceptLabel: nullableString,
      allowSelectionLabel: nullableString,
      rejectLabel: nullableString,
      necessaryLabel: nullableString,
      preferencesLabel: nullableString,
      statisticsLabel: nullableString,
      marketingLabel: nullableString,
      // Retained for older published snapshots; current consent uses direct category switches.
      manageLabel: nullableString,
      privacyLink: LinkRefSchema.nullable().optional(),
    }).nullable().optional(),
    systemTemplates: strictObject({
      notFound: strictObject({
        heading: nullableString,
        body: nullableString,
        primaryAction: LinkRefSchema.nullable().optional(),
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
    navigation: strictObject({
      primary: z.array(z.lazy(() => NavLinkSchema)).optional(),
      footer: z.array(z.lazy(() => NavLinkSchema)).optional(),
    }).nullable().optional(),
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
    privacyDisclosure: TenantPrivacyDisclosureSchema.nullable().optional(),
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
    if (Object.prototype.hasOwnProperty.call(settings.chrome?.navbar ?? {}, key)) {
      ctx.addIssue({
        code: "custom",
        path: ["chrome", "navbar", key],
        message: `Generated chrome navbar must not include ${key}`,
      })
    }
    if (Object.prototype.hasOwnProperty.call(settings.chrome?.footer ?? {}, key)) {
      ctx.addIssue({
        code: "custom",
        path: ["chrome", "footer", key],
        message: `Generated chrome footer must not include ${key}`,
      })
    }
    if (Object.prototype.hasOwnProperty.call(settings.chrome?.announcement ?? {}, key)) {
      ctx.addIssue({
        code: "custom",
        path: ["chrome", "announcement", key],
        message: `Generated chrome announcement must not include ${key}`,
      })
    }
  }
})

export const SiteSettingsSchema: z.ZodType<SiteSettings> = createSiteSettingsSchema()
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
/** Renderer-safe editor/preview page; save and publish still require PageSchema's non-empty blocks. */
export const CanvasPageSchema: z.ZodType<Page> = PageSchemaBase.extend({
  blocks: z.array(BlockSchema),
})

const GeneratedPageSpecSchemaBase = PageSchemaBase.omit({ updatedAt: true, blocks: true }).extend({
  blocks: z.array(GeneratedBlockSpecSchema).min(1),
  updatedAt: z.string().optional(),
})

export const GeneratedPageSpecSchema: z.ZodType<GeneratedPageSpec> = GeneratedPageSpecSchemaBase

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
  legal: strictObject({
    businessUseDeclaration: strictObject({
      accepted: z.literal(true),
      statementVersion: z.string().min(1),
      recordedAt: z.string().min(1),
    }),
    termsAcceptance: strictObject({
      accepted: z.literal(true),
      documentVersion: z.literal(CURRENT_INTAKE_TERMS_ACCEPTANCE.documentVersion),
      acceptanceVersion: z.literal(CURRENT_INTAKE_TERMS_ACCEPTANCE.acceptanceVersion),
      statementVersion: z.literal(CURRENT_INTAKE_TERMS_ACCEPTANCE.statementVersion),
      contentHash: z.literal(CURRENT_INTAKE_TERMS_ACCEPTANCE.contentHash),
      url: z.literal(CURRENT_INTAKE_TERMS_ACCEPTANCE.url),
      recordedAt: z.iso.datetime(),
    }),
    marketingConsent: strictObject({
      granted: z.boolean(),
      statementVersion: z.string().min(1),
      recordedAt: z.string().min(1),
    }),
    privacyNotice: strictObject({
      documentVersion: z.string().min(1),
      url: z.string().url(),
    }),
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
    colorSchemeId: z.enum(COLOR_SCHEME_IDS).nullable().optional(),
    fontSchemeId: z.enum(FONT_SCHEME_IDS).nullable().optional(),
    shapeSchemeId: z.enum(SHAPE_SCHEME_IDS).nullable().optional(),
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
  slug: z.enum(SITE_BLOCK_SLUGS),
  label: z.string().optional(),
  defaultAnchor: z.string().optional(),
  fields: z.array(SiteBlockEditorFieldSchema).optional(),
})

const createSiteGenerationSpecSchema = (
  settingsSchema: z.ZodType<GeneratedSiteSettings>,
  pageSchema: z.ZodType<GeneratedPageSpec>,
  manifestItemSchema: z.ZodType<SiteBlockManifestItem> = SiteBlockManifestItemSchema,
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
  blocks: z.array(manifestItemSchema).optional(),
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

const createPublishedSiteSnapshotSchema = (
  settingsSchema: z.ZodType<GeneratedSiteSettings>,
  pageSchema: z.ZodType<GeneratedPageSpec>,
  manifestItemSchema: z.ZodType<SiteBlockManifestItem> = SiteBlockManifestItemSchema,
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
  blocks: z.array(manifestItemSchema).optional(),
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

export function schemaForPublishedSiteSnapshot(
  _snapshot: Pick<PublishedSiteSnapshot, "tenantSlug"> | { tenantSlug?: string | null },
): z.ZodType<PublishedSiteSnapshot> {
  return PublishedSiteSnapshotSchema
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
