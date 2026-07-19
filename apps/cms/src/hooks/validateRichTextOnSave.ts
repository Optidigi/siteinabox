import { rtRootSchema } from "@/lib/richText/rtNodeSchema"
import type { RtRoot } from "@/lib/richText/RtNode"
import { validateAgainstManifest } from "@/lib/richText/validateAgainstManifest"
import type { CollectionBeforeValidateHook } from "payload"
import { blockBySlug } from "@/blocks/registry"

// `loadTenantManifest` lives in a file that imports `server-only`, which
// THROWS at evaluation time outside a Next.js-server-component context.
// Static-importing it here makes the entire payload.config.ts load chain
// crash under `pnpm payload generate:types` / `payload generate:importmap`
// (both use tsx → CJS loader → no Next.js webpack to short-circuit
// server-only). Deferring to a dynamic import inside the hook body
// pushes the load to actual hook-execution time, which only ever happens
// in the running server — safe context for server-only.

const extractTenantId = (v: unknown): string | number | null => {
  if (v == null) return null
  if (typeof v === "string" || typeof v === "number") return v
  // Populated relationship — { id: ... } shape
  if (typeof v === "object" && "id" in (v as object)) {
    const id = (v as { id: unknown }).id
    if (typeof id === "string" || typeof id === "number") return id
  }
  return null
}

type RichTextVariant = "block" | "inline"

type RichTextSlot = {
  path: string
  value: unknown
  variant: RichTextVariant
}

type FieldLike = {
  name?: string
  type?: string
  fields?: FieldLike[]
  admin?: {
    editor?: unknown
  }
}

const editorToVariant = (editor: unknown): RichTextVariant | null => {
  if (editor === "richTextBlock") return "block"
  if (editor === "richTextInline") return "inline"
  return null
}

const collectRichTextSlots = (
  fields: readonly FieldLike[] | undefined,
  value: unknown,
  path: string,
): RichTextSlot[] => {
  if (!fields || !value || typeof value !== "object") return []
  const record = value as Record<string, unknown>
  const slots: RichTextSlot[] = []

  for (const field of fields) {
    if (!field.name) continue
    const fieldPath = `${path}.${field.name}`
    const fieldValue = record[field.name]
    const variant = editorToVariant(field.admin?.editor)
    if (variant) {
      slots.push({ path: fieldPath, value: fieldValue, variant })
    }

    if (field.type === "array" && Array.isArray(fieldValue)) {
      fieldValue.forEach((item, index) => {
        slots.push(...collectRichTextSlots(field.fields, item, `${fieldPath}[${index}]`))
      })
    }
  }

  return slots
}

export const validateRichTextOnSave: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  if (!data || !Array.isArray(data.blocks)) return data
  const tenantId = extractTenantId(data.tenant) ?? extractTenantId(originalDoc?.tenant)
  if (tenantId == null) return data // tenant validator runs separately; bail gracefully
  const { loadTenantManifest } = await import("@/lib/richText/loadManifest")
  const manifest = await loadTenantManifest(tenantId)

  const errors: string[] = []
  for (const [i, block] of (data.blocks as unknown[]).entries()) {
    if (!block || typeof block !== "object") continue
    const blockRecord = block as Record<string, unknown>
    const blockConfig = blockBySlug[String(blockRecord.blockType)]
    if (!blockConfig) continue
    for (const { path, value, variant } of collectRichTextSlots(blockConfig.fields as FieldLike[], block, `blocks[${i}]`)) {
      if (value == null) continue // null is acceptable for non-required fields
      const parsed = rtRootSchema.safeParse(value)
      if (!parsed.success) {
        errors.push(
          `${path}: ${parsed.error.issues[0]?.message ?? "invalid RtNode shape"}`,
        )
        continue
      }
      const parsedRoot = parsed.data as { variant: string }
      if (parsedRoot.variant !== variant) {
        errors.push(
          `${path}: variant must be "${variant}", got "${parsedRoot.variant}"`,
        )
        continue
      }
      const m = validateAgainstManifest(parsed.data as RtRoot, manifest)
      if (!m.ok) {
        errors.push(...m.errors.map((e) => `${path}: ${e}`))
      }
    }
  }
  if (errors.length > 0) {
    throw new Error(`Rich text validation failed: ${errors.join("; ")}`)
  }
  return data
}
