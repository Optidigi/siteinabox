import { z } from "zod"
import { blockBaseShape, contactMethodSchema, formConfigSchema, optionalMediaRefSchema, optionalTextSchema, textSchema } from "./common"

export const ContactBlockSchema = z.object({
  blockType: z.literal("contact"),
  ...blockBaseShape,
  heading: textSchema,
  body: optionalTextSchema,
  contactMethods: z.array(contactMethodSchema).min(1).max(4),
  serviceArea: z.array(textSchema).max(8).optional(),
  openingHours: optionalTextSchema,
  bookingAction: z.object({ label: textSchema, href: z.string().trim().min(1), external: z.boolean().optional() }).strict().nullable().optional(),
  form: formConfigSchema.nullable().optional(),
  image: optionalMediaRefSchema,
}).strict()

export type ContactBlock = z.infer<typeof ContactBlockSchema>
