import { z } from "zod"
import { blockBaseShape, optionalTextSchema, sourceIdSchema, textSchema } from "./common"

export const reviewRecordSchema = z.object({
  sourceId: sourceIdSchema,
  quote: textSchema,
  name: textSchema,
  context: optionalTextSchema,
}).strict()

export const ReviewsBlockSchema = z.object({
  blockType: z.literal("reviews"),
  ...blockBaseShape,
  heading: textSchema,
  intro: optionalTextSchema,
  reviewSourceIds: z.array(sourceIdSchema).min(1).max(6),
  items: z.array(reviewRecordSchema).min(1).max(6),
}).strict()

export type ReviewRecord = z.infer<typeof reviewRecordSchema>
export type ReviewsBlock = z.infer<typeof ReviewsBlockSchema>
