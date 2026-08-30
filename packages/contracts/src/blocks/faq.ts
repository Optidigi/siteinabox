import { z } from "zod"
import { blockBaseShape, optionalTextSchema, textSchema } from "./common"

const faqItemSchema = z.object({ question: textSchema, answer: textSchema }).strict()

export const FaqBlockSchema = z.object({
  blockType: z.literal("faq"),
  ...blockBaseShape,
  heading: textSchema,
  intro: optionalTextSchema,
  items: z.array(faqItemSchema).min(2).max(10),
}).strict()

export type FaqItem = z.infer<typeof faqItemSchema>
export type FaqBlock = z.infer<typeof FaqBlockSchema>
