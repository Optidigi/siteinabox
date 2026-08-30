import { z } from "zod"
import { blockBaseShape, optionalTextSchema, textSchema } from "./common"

const processStepSchema = z.object({ title: textSchema, body: textSchema }).strict()

export const ProcessBlockSchema = z.object({
  blockType: z.literal("process"),
  ...blockBaseShape,
  heading: textSchema,
  intro: optionalTextSchema,
  steps: z.array(processStepSchema).min(2).max(6),
}).strict()

export type ProcessBlock = z.infer<typeof ProcessBlockSchema>
