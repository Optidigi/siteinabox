import { z } from "zod"
import { actionSchema, blockBaseShape, optionalActionSchema, optionalTextSchema, sourceIdSchema, textSchema } from "./common"

const pricingOfferSchema = z.object({
  sourceId: sourceIdSchema,
  title: textSchema,
  description: optionalTextSchema,
  price: textSchema,
  period: optionalTextSchema,
  features: z.array(textSchema).max(12),
  action: optionalActionSchema,
  badge: optionalTextSchema,
}).strict()

export const PricingBlockSchema = z.object({
  blockType: z.literal("pricing"),
  ...blockBaseShape,
  heading: textSchema,
  intro: optionalTextSchema,
  pricingSourceIds: z.array(sourceIdSchema).min(1).max(4),
  offers: z.array(pricingOfferSchema).min(1).max(4),
}).strict()

export type PricingOffer = z.infer<typeof pricingOfferSchema>
export type PricingBlock = z.infer<typeof PricingBlockSchema>
