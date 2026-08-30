import { z } from "zod"
import { actionSchema, backgroundModeSchema, blockBaseShape, optionalActionSchema, optionalMediaRefSchema, optionalTextSchema, textSchema } from "./common"

export const HERO_BLOCK_TYPES = [
  "hero",
] as const

export const HERO_VARIANTS = [
  "hero-01",
  "hero-02",
  "hero-03",
  "hero-04",
  "hero-05",
] as const

export type HeroVariant = (typeof HERO_VARIANTS)[number]

export const HERO_VARIANTS_WITHOUT_REQUIRED_MEDIA = [
  "hero-01",
] as const

export type HeroVariantWithoutRequiredMedia = (typeof HERO_VARIANTS_WITHOUT_REQUIRED_MEDIA)[number]

export const isHeroVariantWithoutRequiredMedia = (
  value: string,
): value is HeroVariantWithoutRequiredMedia =>
  (HERO_VARIANTS_WITHOUT_REQUIRED_MEDIA as readonly string[]).includes(value)

export type HeroBlockType = (typeof HERO_BLOCK_TYPES)[number]

export const isHeroBlockType = (value: string): value is HeroBlockType =>
  (HERO_BLOCK_TYPES as readonly string[]).includes(value)

const heroContentShape = {
  ...blockBaseShape,
  heading: textSchema,
  body: textSchema,
  primaryAction: actionSchema,
  secondaryAction: optionalActionSchema,
} as const

const heroHighlightSchema = z.object({
  title: textSchema,
  body: textSchema,
}).strict()

const optionalHeroHighlightsShape = {
  highlights: z.array(heroHighlightSchema)
    .max(4)
    .refine((items) => items.length !== 1, "Hero highlights must contain zero, two, three, or four items.")
    .optional(),
} as const

export const HeroVariantRequirements = {
  "hero-01": { requiresImage: false, requiresServiceHighlights: false },
  "hero-02": { requiresImage: true, requiresServiceHighlights: true },
  "hero-03": { requiresImage: true, requiresServiceHighlights: false },
  "hero-04": { requiresImage: true, requiresServiceHighlights: false },
  "hero-05": { requiresImage: true, requiresServiceHighlights: false },
} as const satisfies Record<HeroVariant, { requiresImage: boolean; requiresServiceHighlights: boolean }>

const serviceHighlightSchema = z.object({
  title: textSchema,
  body: textSchema,
  heroHeading: optionalTextSchema,
  heroBody: optionalTextSchema,
  primaryAction: optionalActionSchema,
  secondaryAction: optionalActionSchema,
  image: optionalMediaRefSchema,
}).strict()

const serviceHighlightsShape = {
  serviceHighlights: z.array(serviceHighlightSchema).min(2).max(4).optional(),
} as const

export const HeroBlockSchema = z.object({
  blockType: z.literal("hero"),
  variant: z.enum(HERO_VARIANTS),
  ...heroContentShape,
  backgroundMode: backgroundModeSchema,
  image: optionalMediaRefSchema,
  ...optionalHeroHighlightsShape,
  ...serviceHighlightsShape,
}).strict().superRefine((block, ctx) => {
  const requirements = HeroVariantRequirements[block.variant]
  if (requirements.requiresImage && !block.image) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["image"], message: `${block.variant} requires a supplied image.` })
  }
  if (block.backgroundMode === "image" && !block.image) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["image"], message: "An image background override requires a supplied image." })
  }
  if (requirements.requiresServiceHighlights && !block.serviceHighlights) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["serviceHighlights"], message: `${block.variant} requires two to four service highlights.` })
  }
  if (!requirements.requiresServiceHighlights && block.serviceHighlights) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["serviceHighlights"], message: `${block.variant} does not accept service highlights.` })
  }
  if (block.variant !== "hero-01" && block.highlights) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["highlights"], message: `${block.variant} does not accept value-point highlights.` })
  }
})

export type HeroBlock = z.infer<typeof HeroBlockSchema>

export type HeroServiceHighlight = z.infer<typeof serviceHighlightSchema>
export type HeroHighlight = z.infer<typeof heroHighlightSchema>

export type AnyHeroBlock = HeroBlock
