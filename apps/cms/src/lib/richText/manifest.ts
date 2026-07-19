import { z } from "zod"

// Reserved ids that would collide with Lexical / DOM tag-name conventions.
// Reject these at schema time so a site can't define a typeStyle named
// "h2" that conflicts with the heading-level class chain.
const RESERVED_IDS = new Set(["b", "i", "u", "s", "code", "h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "ol", "ul", "a", "default"])

const fieldSchema = z.discriminatedUnion("type", [
  z.object({ name: z.string().min(1), type: z.literal("text"), required: z.boolean().optional() }),
  z.object({
    name: z.string().min(1), type: z.literal("select"),
    options: z.array(z.object({ value: z.string(), label: z.string() })).min(1),
    required: z.boolean().optional(),
  }),
  z.object({ name: z.string().min(1), type: z.literal("upload"), relationTo: z.literal("media"), required: z.boolean().optional() }),
  z.object({ name: z.string().min(1), type: z.literal("url"), required: z.boolean().optional() }),
  z.object({ name: z.string().min(1), type: z.literal("checkbox") }),
])

// Bounds (OBS-32) protect the zod + downstream RtNode validators from a
// pathologically large/deeply-nested manifest pasted by a compromised admin.
// The manifest field is admin-only, so an attacker needs cookie access first;
// these bounds keep the worst case sub-millisecond regardless.
const themedNodeSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(80),
  container: z.boolean().optional(),
  fields: z.array(fieldSchema).max(32),
})

const colorTokenSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  cssVar: z.string().regex(/^--/, { message: "cssVar must start with --" }),
})

const fontFamilySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  cssVar: z.string().regex(/^--/, { message: "cssVar must start with --" }),
})

export const DEFAULT_FONT_FAMILIES = [
  { id: "title", label: "Title font", cssVar: "--font-title" },
  { id: "heading", label: "Heading font", cssVar: "--font-heading" },
  { id: "text", label: "Text font", cssVar: "--font-text" },
] as const

const typeStyleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  appliesTo: z.enum(["inline", "paragraph", "heading"]),
  sampleClass: z.string().min(1).optional(),
  description: z.string().optional(),
})

const blockMenuItemSchema = z.object({
  slug: z.string().min(1),
  label: z.string().min(1).optional(),
  defaultAnchor: z.string().min(1).optional(),
  fields: z.array(z.lazy(() => blockEditorFieldSchema)).min(1).max(32).optional(),
})

const blockEditorFieldKindSchema = z.enum(["richtext", "text", "image", "icon", "cta", "array", "select", "checkbox"])
const blockEditorFieldRoleSchema = z.enum(["title", "heading", "text", "script"])

const blockEditorFieldSchema: z.ZodType<{
  name: string
  label?: string
  kind: z.infer<typeof blockEditorFieldKindSchema>
  role?: z.infer<typeof blockEditorFieldRoleSchema>
  variant?: "block" | "inline"
  itemLabel?: string
  itemFields?: unknown[]
  options?: { label: string; value: string }[]
}> = z.lazy(() =>
  z.object({
    name: z.string().min(1),
    label: z.string().min(1).optional(),
    kind: blockEditorFieldKindSchema,
    role: blockEditorFieldRoleSchema.optional(),
    variant: z.enum(["block", "inline"]).optional(),
    itemLabel: z.string().min(1).optional(),
    itemFields: z.array(blockEditorFieldSchema).min(1).max(32).optional(),
    options: z.array(z.object({ label: z.string().min(1), value: z.string().min(1) })).min(1).max(64).optional(),
  }).superRefine((field, ctx) => {
    if (field.kind === "array" && !field.itemFields) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "array block fields require itemFields", path: ["itemFields"] })
    }
    if (field.kind !== "array" && field.itemFields) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "itemFields are only valid for array block fields", path: ["itemFields"] })
    }
    if (field.kind === "richtext" && !field.variant) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "richtext block fields require variant", path: ["variant"] })
    }
    if (field.kind !== "richtext" && field.variant) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "variant is only valid for richtext block fields", path: ["variant"] })
    }
    if (field.kind === "select" && !field.options) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "select block fields require options", path: ["options"] })
    }
    if (field.kind !== "select" && field.options) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "options are only valid for select block fields", path: ["options"] })
    }
  }),
)

const footerItemTypeSchema = z.enum(["brand", "text", "links", "contact", "business", "navigation"])

const footerContractSchema = z.object({
  columnCounts: z.array(z.number().int().min(1).max(6)).min(1).max(6),
  defaultColumnCount: z.number().int().min(1).max(6).optional(),
  items: z.array(z.object({
    type: footerItemTypeSchema,
    label: z.string().min(1).max(80).optional(),
  })).min(1).max(12),
}).optional()

const settingsContractSchema = z.object({
  general: z.object({
    description: z.boolean().optional(),
    language: z.boolean().optional(),
    contactEmail: z.boolean().optional(),
  }).optional(),
  identity: z.object({
    branding: z.object({
      logo: z.boolean().optional(),
      favicon: z.boolean().optional(),
    }).optional(),
    footer: z.object({
      tagline: z.boolean().optional(),
      copyright: z.boolean().optional(),
    }).optional(),
  }).optional(),
  details: z.object({
    contact: z.object({
      phone: z.boolean().optional(),
      address: z.boolean().optional(),
      social: z.boolean().optional(),
    }).optional(),
    business: z.object({
      legalName: z.boolean().optional(),
      kvkNumber: z.boolean().optional(),
      establishmentNumber: z.boolean().optional(),
      streetAddress: z.boolean().optional(),
      city: z.boolean().optional(),
      region: z.boolean().optional(),
      postalCode: z.boolean().optional(),
      country: z.boolean().optional(),
    }).optional(),
    serviceArea: z.boolean().optional(),
    hours: z.boolean().optional(),
  }).optional(),
  operations: z.object({
    maintenance: z.boolean().optional(),
  }).optional(),
}).optional()

const analyticsContractSchema = z.object({
  enabled: z.boolean().optional(),
  dashboardVisible: z.boolean().optional(),
  consentMode: z.literal("required").optional(),
  conversionGoals: z.object({
    acceptedForms: z.literal(true).optional(),
    contactClicks: z.array(z.enum(["phone", "email", "whatsapp"])).optional(),
  }).optional(),
}).optional()

const analyticsConsentSchema = z.object({
  enabled: z.boolean().optional(),
  provider: z.enum(["posthog", "custom"]).optional(),
  consentStorageKey: z.string().optional(),
  consentVersion: z.string().optional(),
  captureSections: z.boolean().optional(),
  captureActions: z.boolean().optional(),
  captureForms: z.boolean().optional(),
}).optional()

export const manifestSchema = z.object({
  version: z.literal(1),
  inlineMarks: z.object({
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    underline: z.boolean().optional(),
    code: z.boolean().optional(),
    strikethrough: z.boolean().optional(),
  }),
  typeStyles: z.array(typeStyleSchema).optional(),
  colorTokens: z.array(colorTokenSchema).optional(),
  fontFamilies: z.array(fontFamilySchema).optional(),
  blockTypes: z.object({
    paragraph: z.literal(true),
    heading: z.object({ levels: z.array(z.union([z.literal(2), z.literal(3), z.literal(4)])).min(1) }).optional(),
    bulletList: z.boolean().optional(),
    orderedList: z.boolean().optional(),
    blockquote: z.boolean().optional(),
    divider: z.boolean().optional(),
  }),
  themedNodes: z.array(themedNodeSchema).max(64).optional(),
  blocks: z.array(blockMenuItemSchema).min(1).optional(),
  settings: settingsContractSchema,
  footer: footerContractSchema,
  analytics: analyticsContractSchema,
  analyticsConsent: analyticsConsentSchema,
}).superRefine((m, ctx) => {
  if (m.themedNodes) {
    const seen = new Set<string>()
    for (const n of m.themedNodes) {
      if (seen.has(n.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate themedNode id: ${n.id}`, path: ["themedNodes"] })
      }
      seen.add(n.id)
    }
  }
  if (m.colorTokens) {
    const seen = new Set<string>()
    for (const c of m.colorTokens) {
      if (RESERVED_IDS.has(c.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `colorToken id "${c.id}" is reserved`, path: ["colorTokens"] })
      }
      if (seen.has(c.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate colorToken id: ${c.id}`, path: ["colorTokens"] })
      }
      seen.add(c.id)
    }
  }
  if (m.fontFamilies) {
    const seen = new Set<string>()
    for (const f of m.fontFamilies) {
      if (RESERVED_IDS.has(f.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `fontFamily id "${f.id}" is reserved`, path: ["fontFamilies"] })
      }
      if (seen.has(f.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate fontFamily id: ${f.id}`, path: ["fontFamilies"] })
      }
      seen.add(f.id)
    }
  }
  if (m.typeStyles) {
    const seen = new Set<string>()
    for (const s of m.typeStyles) {
      if (RESERVED_IDS.has(s.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `typeStyle id "${s.id}" is reserved`, path: ["typeStyles"] })
      }
      if (seen.has(s.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate typeStyle id: ${s.id}`, path: ["typeStyles"] })
      }
      seen.add(s.id)
    }
  }
  if (m.blocks) {
    const seen = new Set<string>()
    for (const [blockIndex, b] of m.blocks.entries()) {
      if (seen.has(b.slug)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate blocks slug: ${b.slug}`, path: ["blocks"] })
      }
      seen.add(b.slug)
      if (b.fields) {
        const fieldNames = new Set<string>()
        for (const [fieldIndex, field] of b.fields.entries()) {
          if (fieldNames.has(field.name)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `duplicate block field: ${field.name}`,
              path: ["blocks", blockIndex, "fields", fieldIndex],
            })
          }
          fieldNames.add(field.name)
        }
      }
    }
  }
  if (m.footer) {
    if (m.footer.defaultColumnCount != null && !m.footer.columnCounts.includes(m.footer.defaultColumnCount)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "footer.defaultColumnCount must be listed in footer.columnCounts", path: ["footer", "defaultColumnCount"] })
    }
    const seen = new Set<string>()
    for (const item of m.footer.items) {
      if (seen.has(item.type)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate footer item type: ${item.type}`, path: ["footer", "items"] })
      }
      seen.add(item.type)
    }
  }
})

export type RtManifest = z.infer<typeof manifestSchema>
export type RtBlockEditorField = z.infer<typeof blockEditorFieldSchema>
export type RtColorToken = z.infer<typeof colorTokenSchema>
export type RtFontFamily = z.infer<typeof fontFamilySchema>
export type RtTypeStyle = z.infer<typeof typeStyleSchema>
