import { z } from "zod"
import { actionSchema, backgroundModeSchema, blockBaseShape, optionalActionSchema, optionalMediaRefSchema, optionalTextSchema, textSchema } from "./common"

export const CTA_VARIANTS = ["cta-01", "cta-02"] as const
export type CtaVariant = (typeof CTA_VARIANTS)[number]
export const DEFAULT_CTA_VARIANT = "cta-01" satisfies CtaVariant

export const CtaBlockSchema = z.object({
  blockType: z.literal("cta"),
  variant: z.enum(CTA_VARIANTS),
  ...blockBaseShape,
  backgroundMode: backgroundModeSchema,
  heading: textSchema,
  body: optionalTextSchema,
  primaryAction: actionSchema,
  secondaryAction: optionalActionSchema,
  image: optionalMediaRefSchema,
}).strict().superRefine((block, ctx) => {
  if (block.backgroundMode === "image" && !block.image) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["image"], message: "An image background override requires a supplied image." })
  }
})

export type CtaBlock = z.infer<typeof CtaBlockSchema>
