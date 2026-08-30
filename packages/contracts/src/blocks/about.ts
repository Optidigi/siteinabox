import { z } from "zod"
import { blockBaseShape, optionalMediaRefSchema, optionalTextSchema, textSchema } from "./common"

const highlightSchema = z.object({ title: textSchema, text: optionalTextSchema }).strict()

export const AboutBlockSchema = z.object({
  blockType: z.literal("about"),
  ...blockBaseShape,
  heading: textSchema,
  body: textSchema,
  portrait: optionalMediaRefSchema,
  highlights: z.array(highlightSchema).max(4).default([]),
}).strict()

export type AboutBlock = z.infer<typeof AboutBlockSchema>
