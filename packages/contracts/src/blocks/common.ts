import { z } from "zod"
import { BACKGROUND_MODE_IDS } from "../theme-presets"

export const blockBaseShape = {
  id: z.string().trim().min(1).optional(),
  anchor: z.string().trim().min(1).max(80).nullable().optional(),
  // The projection layer attaches section telemetry for analytics
  // and content deduplication. It is optional and never part of Sitegen input.
  analytics: z.record(z.string(), z.unknown()).nullable().optional(),
} as const

export const textSchema = z.string().trim().min(1)
export const optionalTextSchema = textSchema.nullable().optional()
export const sourceIdSchema = z.string().trim().min(1).max(160)

export const mediaRefSchema = z.union([
  z.string().trim().min(1),
  z.number().int().positive(),
  z.object({
    id: z.union([z.string().trim().min(1), z.number().int().positive()]).optional(),
    url: z.string().trim().min(1).optional(),
    filename: z.string().trim().min(1).optional(),
    alt: z.string().trim().nullable().optional(),
    width: z.number().int().positive().nullable().optional(),
    height: z.number().int().positive().nullable().optional(),
  }).strict().refine((value) => value.id !== undefined || value.url !== undefined || value.filename !== undefined, {
    message: "Media must include an id, url, or filename",
  }),
])

export const optionalMediaRefSchema = mediaRefSchema.nullable().optional()

/** Optional per-section effect override; null/undefined inherits the site theme. */
export const backgroundModeSchema = z.enum(BACKGROUND_MODE_IDS).nullable().optional()

export const actionSchema = z.object({
  label: textSchema,
  href: z.string().trim().min(1),
  external: z.boolean().optional(),
}).strict()

export const optionalActionSchema = actionSchema.nullable().optional()

/**
 * Closed first-party icon choices for icon-led service presentations. The
 * value is semantic content configuration, not a component name or an
 * arbitrary icon registry key.
 */
export const SERVICE_ICON_NAMES = [
  "briefcase",
  "building",
  "calendar",
  "camera",
  "check-circle",
  "clipboard",
  "clock",
  "globe",
  "heart",
  "house",
  "layers",
  "map-pin",
  "message",
  "package",
  "ruler",
  "shield-check",
  "spark",
  "star",
  "user",
  "wrench",
] as const

export const serviceIconSchema = z.enum(SERVICE_ICON_NAMES)

export const serviceItemSchema = z.object({
  title: textSchema,
  body: textSchema,
  icon: serviceIconSchema.nullable().optional(),
  action: optionalActionSchema,
}).strict()

export const contactMethodSchema = z.object({
  kind: z.enum(["email", "phone", "whatsapp", "address", "other"]),
  label: textSchema,
  value: textSchema,
  href: z.string().trim().min(1).nullable().optional(),
}).strict()

export const formFieldSchema = z.object({
  name: z.string().trim().min(1).max(80),
  label: textSchema,
  type: z.enum(["text", "email", "tel", "textarea", "select", "checkbox"]),
  required: z.boolean().default(false),
  placeholder: optionalTextSchema,
  options: z.array(z.object({ label: textSchema, value: textSchema }).strict()).max(12).nullable().optional(),
}).strict()

export const formConfigSchema = z.object({
  formName: textSchema,
  submitLabel: textSchema,
  fields: z.array(formFieldSchema).min(1).max(12),
}).strict()

export type BlockBase = z.infer<z.ZodObject<typeof blockBaseShape>>
export type Action = z.infer<typeof actionSchema>
export type CanonicalMediaRef = z.infer<typeof mediaRefSchema>
export type ContactMethod = z.infer<typeof contactMethodSchema>
export type FormConfig = z.infer<typeof formConfigSchema>
export type ServiceIconName = z.infer<typeof serviceIconSchema>
