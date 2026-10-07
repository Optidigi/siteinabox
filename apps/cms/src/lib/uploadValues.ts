import type { Field } from "payload"
import { blockBySlug } from "@/blocks/registry"
import { isSafeHref } from "@/lib/security/safeHref"

export const normalizeUploadId = (value: unknown): number | string | null => {
  if (value == null) return null
  if (typeof value === "object") {
    const id = (value as { id?: unknown }).id
    if (typeof id === "number" || typeof id === "string") return id
    return null
  }
  if (typeof value === "number" || typeof value === "string") return value
  return null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === "object" && !Array.isArray(value)

const isNamedField = (field: Field): field is Field & { name: string } =>
  "name" in field && typeof field.name === "string" && field.name.length > 0

const isLinkGroupField = (field: Field): boolean => {
  if (field.type !== "group") return false
  const names = new Set(
    field.fields
      .filter(isNamedField)
      .map((sub) => sub.name),
  )
  return names.has("label") && names.has("href")
}

const normalizeHrefValue = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const href = value.trim()
  if (!href || href === "#") return null
  return isSafeHref(href) ? href : href
}

const normalizeLinkGroupValue = (value: unknown): unknown => {
  if (!isRecord(value)) return value
  return {
    ...value,
    label: typeof value.label === "string" ? value.label.trim() : value.label,
    href: normalizeHrefValue(value.href),
  }
}

const normalizeObjectByFields = (
  value: Record<string, unknown>,
  fields: readonly Field[],
): Record<string, unknown> => {
  let next = value

  const write = (name: string, fieldValue: unknown) => {
    if (next === value) next = { ...value }
    next[name] = fieldValue
  }

  for (const field of fields) {
    if (field.type === "row" || field.type === "collapsible") {
      if ("fields" in field) {
        next = normalizeObjectByFields(next, field.fields)
      }
      continue
    }
    if (field.type === "tabs") continue
    if (!isNamedField(field) || !(field.name in next)) continue

    const current = next[field.name]

    if (field.type === "upload" && field.relationTo === "media") {
      write(field.name, normalizeUploadId(current))
      continue
    }

    if (isLinkGroupField(field)) {
      write(field.name, normalizeLinkGroupValue(current))
      continue
    }

    if (field.type === "array" && Array.isArray(current)) {
      write(field.name, current.map((item: unknown) => (
        isRecord(item) ? normalizeObjectByFields(item, field.fields) : item
      )))
      continue
    }

    if (field.type === "group" && isRecord(current)) {
      write(field.name, normalizeObjectByFields(current, field.fields))
    }
  }

  return next
}

export const normalizePageBlockUploadIds = (blocks: unknown): unknown => {
  if (!Array.isArray(blocks)) return blocks

  return blocks.map((block: unknown) => {
    if (!isRecord(block)) return block
    const blockType = typeof block.blockType === "string" ? block.blockType : undefined
    const schema = blockType ? blockBySlug[blockType] : undefined
    return schema ? normalizeObjectByFields(block, schema.fields as Field[]) : block
  })
}
