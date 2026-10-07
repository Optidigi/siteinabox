import { z } from "zod"
import { themeSchema } from "@/lib/theme/schema"

const idSchema = z.union([z.string().min(1), z.number().finite()])
export const clientMediaSchema = z.object({
  id: idSchema,
  url: z.string().nullable().optional(),
  alt: z.string().nullable().optional(),
  filename: z.string().nullable().optional(),
  mimeType: z.string().nullable().optional(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
}).passthrough()
export type ClientMedia = z.infer<typeof clientMediaSchema>
export const clientMediaListSchema = z.object({ docs: z.array(clientMediaSchema).default([]) })
export const clientMeSchema = z.object({ user: z.object({
  role: z.enum(["super-admin", "owner", "editor", "viewer"]),
  tenants: z.array(z.object({ tenant: z.union([idSchema, z.object({ id: idSchema })]) })).nullable().optional(),
}).nullable().optional() })
export const clientTenantListSchema = z.object({ docs: z.array(z.object({
  id: idSchema, name: z.string().nullable().optional(), slug: z.string().nullable().optional(),
})).default([]) })
export const clientCreatedIdSchema = z.object({ id: idSchema })
export const clientCountSchema = z.object({ totalDocs: z.number().int().nonnegative().default(0) })
export const clientPresetListSchema = z.object({ docs: z.array(z.object({
  id: idSchema, name: z.string(), description: z.string().nullable().optional(),
  blockType: z.string(), data: z.record(z.string(), z.unknown()).nullable().optional(),
})).default([]) })
export const clientPageSaveSchema = z.object({
  page: z.object({ id: idSchema, slug: z.string().nullable().optional(), updatedAt: z.string().optional() }),
  theme: themeSchema.optional(),
})
