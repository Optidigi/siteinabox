import type { Field, SelectField } from "payload"
import { blockBySlug } from "@/blocks/registry"
import type { RtBlockEditorField, RtManifest } from "@/lib/richText/manifest"

export type ElementKind = "richtext" | "text" | "image" | "icon" | "cta" | "array" | "select" | "checkbox"

export type ElementRole = "title" | "heading" | "text" | "script"

export interface ElementOption {
  label: string
  value: string
}

export interface ElementSpec {
  field: string
  label: string
  kind: ElementKind
  role?: ElementRole
  variant?: "block" | "inline"
  itemFields?: ElementSpec[]
  itemLabel?: (item: any, i: number) => string
  options?: ElementOption[]
}

const fallbackItemLabel = (label: string) => (item: any, index: number) => {
  const title =
    typeof item?.label === "string" ? item.label :
    typeof item?.title === "string" ? item.title :
    typeof item?.question === "string" ? item.question :
    ""
  return title.trim() || `${label} ${index + 1}`
}

const labelFor = (field: Field & { name?: string }): string => {
  const label = "label" in field ? field.label : undefined
  if (typeof label === "string" && label.trim()) return label
  const name = "name" in field && typeof field.name === "string" ? field.name : "Field"
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

const titleCaseName = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())

const roleFor = (name: string): ElementRole | undefined => {
  if (name === "eyebrow") return "script"
  if (name === "headline" || name === "title") return "heading"
  if (name === "body" || name === "description" || name === "subheadline" || name === "quote") return "text"
  if (name === "label" || name === "author" || name === "role" || name === "submitLabel" || name === "formName") return "text"
  return undefined
}

const selectOptions = (field: SelectField): ElementOption[] =>
  field.options.map((option) => {
    if (typeof option === "string") return { label: option, value: option }
    return {
      label: typeof option.label === "string" ? option.label : option.value,
      value: option.value,
    }
  })

const isLinkGroup = (field: Field): boolean => {
  if (field.type !== "group") return false
  const names = new Set(
    field.fields
      .filter((sub): sub is Field & { name: string } => "name" in sub && typeof sub.name === "string")
      .map((sub) => sub.name),
  )
  return names.has("label") && names.has("href")
}

const specForField = (field: Field): ElementSpec | null => {
  if (field.type === "row" || field.type === "collapsible") return null
  if (field.type === "tabs") return null
  if (!("name" in field) || typeof field.name !== "string" || !field.name) return null

  const name = field.name
  const label = labelFor(field)

  if (field.type === "json") {
    const editor = (field.admin as { editor?: unknown } | undefined)?.editor
    if (editor === "richTextInline" || editor === "richTextBlock") {
      return {
        field: name,
        label,
        kind: "richtext",
        variant: editor === "richTextBlock" ? "block" : "inline",
        role: roleFor(name),
      }
    }
    return { field: name, label, kind: "text", role: roleFor(name) }
  }

  if (field.type === "upload" && field.relationTo === "media") {
    return { field: name, label, kind: "image" }
  }

  if (field.type === "array") {
    const itemFields = elementSpecsFromFields(field.fields)
    return {
      field: name,
      label,
      kind: "array",
      itemFields,
      itemLabel: fallbackItemLabel(label),
    }
  }

  if (isLinkGroup(field)) {
    return { field: name, label, kind: "cta" }
  }

  if (field.type === "select") {
    return { field: name, label, kind: "select", options: selectOptions(field) }
  }

  if (field.type === "checkbox") {
    return { field: name, label, kind: "checkbox" }
  }

  if (field.type === "text" || field.type === "textarea" || field.type === "email") {
    return { field: name, label, kind: name === "icon" ? "icon" : "text", role: roleFor(name) }
  }

  return null
}

export const elementSpecsFromFields = (fields: readonly Field[]): ElementSpec[] => {
  const specs: ElementSpec[] = []
  for (const field of fields) {
    if (field.type === "row" || field.type === "collapsible") {
      if ("fields" in field) specs.push(...elementSpecsFromFields(field.fields))
      continue
    }
    const spec = specForField(field)
    if (spec) specs.push(spec)
  }
  return specs
}

const labelFromManifestField = (field: RtBlockEditorField): string =>
  field.label ?? titleCaseName(field.name)

const manifestFieldToSpec = (field: RtBlockEditorField): ElementSpec => {
  const label = labelFromManifestField(field)
  if (field.kind === "array") {
    return {
      field: field.name,
      label,
      kind: "array",
      itemFields: (field.itemFields ?? []).map(manifestFieldToSpec),
      itemLabel: fallbackItemLabel(field.itemLabel ?? label),
    }
  }

  return {
    field: field.name,
    label,
    kind: field.kind,
    role: field.role,
    variant: field.variant,
    options: field.options,
  }
}

export const elementSpecsFromManifest = (
  blockType: string | undefined,
  manifest: RtManifest | null | undefined,
): ElementSpec[] | null => {
  if (!blockType || !manifest?.blocks) return null
  const block = manifest.blocks.find((item) => item.slug === blockType)
  if (!block?.fields?.length) return null
  return block.fields.map(manifestFieldToSpec)
}

export const getBlockElementSpecs = (
  blockType: string | undefined,
  manifest?: RtManifest | null,
): ElementSpec[] => {
  const manifestSpecs = elementSpecsFromManifest(blockType, manifest)
  if (manifestSpecs) return manifestSpecs
  if (!blockType) return []
  const block = blockBySlug[blockType]
  return block ? elementSpecsFromFields(block.fields as Field[]) : []
}

export const BLOCK_ELEMENTS: Record<string, ElementSpec[]> = Object.fromEntries(
  Object.entries(blockBySlug).map(([slug, block]) => [slug, elementSpecsFromFields(block.fields as Field[])]),
)
