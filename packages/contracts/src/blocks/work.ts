import { z } from "zod"
import { actionSchema, blockBaseShape, mediaRefSchema, optionalActionSchema, optionalTextSchema, sourceIdSchema, textSchema } from "./common"

const projectSchema = z.object({
  sourceId: sourceIdSchema,
  title: textSchema,
  summary: optionalTextSchema,
  media: z.array(mediaRefSchema).max(8),
  action: optionalActionSchema,
}).strict()

export const WorkBlockSchema = z.object({
  blockType: z.literal("work"),
  ...blockBaseShape,
  heading: textSchema,
  intro: optionalTextSchema,
  projects: z.array(projectSchema).min(1).max(6),
}).strict()

export type WorkProject = z.infer<typeof projectSchema>
export type WorkBlock = z.infer<typeof WorkBlockSchema>
