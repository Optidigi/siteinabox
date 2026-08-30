import { z } from "zod"
import { blockBaseShape, optionalTextSchema, serviceItemSchema, textSchema } from "./common"

export const SERVICES_VARIANTS = ["services-01", "services-02"] as const
export type ServicesVariant = (typeof SERVICES_VARIANTS)[number]
export const DEFAULT_SERVICES_VARIANT = "services-01" satisfies ServicesVariant

export const ServicesBlockSchema = z.object({
  blockType: z.literal("services"),
  variant: z.enum(SERVICES_VARIANTS),
  ...blockBaseShape,
  heading: textSchema,
  intro: optionalTextSchema,
  items: z.array(serviceItemSchema).min(2).max(6),
}).strict()

export type ServicesBlock = z.infer<typeof ServicesBlockSchema>
