import { z } from "zod"
import { BACKGROUND_MODE_IDS, CTA_VARIANTS, FOOTER_VARIANTS, HERO_VARIANTS, NAVBAR_PLACEMENTS, NAVBAR_VARIANTS, SERVICES_VARIANTS } from "@siteinabox/contracts"

const nullableString = z.string().trim().min(1).nullable()
const optionalBackgroundMode = z.enum(BACKGROUND_MODE_IDS).nullable().optional()
const action = z.object({ label: z.string().trim().min(1), href: z.string().trim().min(1) }).strict()
const optionalAction = action.nullable()
const mediaIds = z.array(z.string().trim().min(1)).max(8)
const heroHighlights = z.array(z.object({ title: z.string().trim().min(1), body: z.string().trim().min(1) }).strict())
  .max(4)
  .refine((items) => items.length !== 1, "Hero highlights must contain zero, two, three, or four items.")
  .optional()
const serviceHighlights = z.array(z.object({
  title: z.string().trim().min(1),
  body: z.string().trim().min(1),
  heroHeading: z.string().trim().min(1),
  heroBody: z.string().trim().min(1),
  primaryAction: optionalAction,
  secondaryAction: optionalAction,
  mediaId: nullableString.optional(),
}).strict()).min(2).max(4).nullable().optional()

const base = { anchor: nullableString.optional() }

export const HeroGenerationSchema = z.object({ blockType: z.literal("hero"), variant: z.enum(HERO_VARIANTS), ...base, backgroundMode: optionalBackgroundMode, heading: z.string().trim().min(1), body: z.string().trim().min(1), primaryAction: action, secondaryAction: optionalAction, mediaId: nullableString, highlights: heroHighlights, serviceHighlights }).strict()
export const ServicesGenerationSchema = z.object({ blockType: z.literal("services"), variant: z.enum(SERVICES_VARIANTS), ...base, heading: z.string().trim().min(1), intro: nullableString, items: z.array(z.object({ title: z.string().trim().min(1), body: z.string().trim().min(1), action: optionalAction }).strict()).min(2).max(6) }).strict()
export const AboutGenerationSchema = z.object({ blockType: z.literal("about"), ...base, heading: z.string().trim().min(1), body: z.string().trim().min(1), mediaId: nullableString, highlights: z.array(z.object({ title: z.string().trim().min(1), text: nullableString }).strict()).max(4) }).strict()
export const ProcessGenerationSchema = z.object({ blockType: z.literal("process"), ...base, heading: z.string().trim().min(1), intro: nullableString, steps: z.array(z.object({ title: z.string().trim().min(1), body: z.string().trim().min(1) }).strict()).min(2).max(6) }).strict()
export const WorkGenerationSchema = z.object({ blockType: z.literal("work"), ...base, heading: z.string().trim().min(1), intro: nullableString, projects: z.array(z.object({ sourceId: z.string().trim().min(1), title: z.string().trim().min(1), summary: nullableString, mediaIds, action: optionalAction }).strict()).min(1).max(6) }).strict()
export const ReviewsGenerationSchema = z.object({ blockType: z.literal("reviews"), ...base, heading: z.string().trim().min(1), intro: nullableString, reviewSourceIds: z.array(z.string().trim().min(1)).min(1).max(6) }).strict()
export const PricingGenerationSchema = z.object({ blockType: z.literal("pricing"), ...base, heading: z.string().trim().min(1), intro: nullableString, pricingSourceIds: z.array(z.string().trim().min(1)).min(1).max(4) }).strict()
export const FaqGenerationSchema = z.object({ blockType: z.literal("faq"), ...base, heading: z.string().trim().min(1), intro: nullableString, items: z.array(z.object({ question: z.string().trim().min(1), answer: z.string().trim().min(1) }).strict()).min(2).max(10) }).strict()
export const CtaGenerationSchema = z.object({ blockType: z.literal("cta"), variant: z.enum(CTA_VARIANTS), ...base, backgroundMode: optionalBackgroundMode, heading: z.string().trim().min(1), body: nullableString, primaryAction: action, secondaryAction: optionalAction, mediaId: nullableString }).strict()
export const ContactGenerationSchema = z.object({ blockType: z.literal("contact"), ...base, heading: z.string().trim().min(1), body: nullableString, bookingAction: optionalAction, serviceArea: z.array(z.string().trim().min(1)).max(8), openingHours: nullableString }).strict()

export const NavbarGenerationSchema = z.object({
  variant: z.enum(NAVBAR_VARIANTS),
  placement: z.enum(NAVBAR_PLACEMENTS),
}).strict()

export const FooterGenerationSchema = z.object({
  variant: z.enum(FOOTER_VARIANTS),
}).strict()

export const SitegenGeneratedSectionSchema = z.discriminatedUnion("blockType", [
  HeroGenerationSchema,
  ServicesGenerationSchema,
  AboutGenerationSchema,
  ProcessGenerationSchema,
  WorkGenerationSchema,
  ReviewsGenerationSchema,
  PricingGenerationSchema,
  FaqGenerationSchema,
  CtaGenerationSchema,
  ContactGenerationSchema,
])

// Kept optional for replaying older offline generations; the live structured
// output JSON Schema below requires it for new model calls.
export const SitegenOutputSchema = z.object({
  navbar: NavbarGenerationSchema.optional(),
  footer: FooterGenerationSchema.optional(),
  pages: z.array(z.object({
    slug: z.string().trim().min(1),
    title: z.string().trim().min(1),
    sections: z.array(SitegenGeneratedSectionSchema).min(1),
  }).strict()).min(1),
}).strict()

export type SitegenGeneratedSection = z.infer<typeof SitegenGeneratedSectionSchema>
export type SitegenOutputInput = z.input<typeof SitegenOutputSchema>
export type SitegenOutput = z.infer<typeof SitegenOutputSchema>
