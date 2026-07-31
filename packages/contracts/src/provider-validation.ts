import {
  SHADCNUI_BLOCK_VARIANTS,
  SHADCNUI_SYSTEM_BLOCK_VARIANTS,
} from "./generated/shadcnui-blocks"

export type ProviderValidationCoreIssue =
  | { code: "missing_provider_variant"; path: ["designVariant"] }
  | { code: "unresolved_provider_variant"; path: ["designVariant"]; variantId: string }
  | { code: "missing_required_slot" | "inactive_slot_value"; path: [string]; variantId: string; field: string }
  | { code: "missing_required_media"; path: ["logos", number, "image"]; variantId: string; index: number }

type ProviderSlot = {
  kind: string
  status: "required" | "optional"
  repeated: boolean
  minItems?: number
  maxItems?: number
}

export type ProviderRuntimeBlockVariant = {
  id: string
  blockType: string
  activeSlots: Readonly<Record<string, ProviderSlot>>
  forbiddenFields: readonly string[]
}

const contentVariants = SHADCNUI_BLOCK_VARIANTS as readonly ProviderRuntimeBlockVariant[]
const allBlockVariants = [
  ...SHADCNUI_BLOCK_VARIANTS,
  ...SHADCNUI_SYSTEM_BLOCK_VARIANTS,
] as readonly ProviderRuntimeBlockVariant[]

export const hasProviderFieldValue = (value: unknown): boolean => {
  if (value == null) return false
  if (typeof value === "string") return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some(hasProviderFieldValue)
  }
  return true
}

export function validateProviderBlockCore(
  block: { blockType: string; designVariant?: string | null },
  options: { includeSystemBlockVariants?: boolean; validateSystemBlockSlots?: boolean } = {},
): { variant: ProviderRuntimeBlockVariant | null; issues: ProviderValidationCoreIssue[] } {
  const variantId = typeof block.designVariant === "string" && block.designVariant.length > 0
    ? block.designVariant
    : null
  if (!variantId) {
    return {
      variant: null,
      issues: [{ code: "missing_provider_variant", path: ["designVariant"] }],
    }
  }

  const variants = options.includeSystemBlockVariants ? allBlockVariants : contentVariants
  const variant = variants.find((candidate) =>
    candidate.id === variantId && candidate.blockType === block.blockType,
  ) ?? null
  if (!variant) {
    return {
      variant: null,
      issues: [{ code: "unresolved_provider_variant", path: ["designVariant"], variantId }],
    }
  }
  if (!contentVariants.includes(variant) && options.validateSystemBlockSlots !== true) {
    return { variant, issues: [] }
  }

  const record = block as Record<string, unknown>
  const issues: ProviderValidationCoreIssue[] = []
  for (const [field, slot] of Object.entries(variant.activeSlots)) {
    if (slot.status === "required" && !hasProviderFieldValue(record[field])) {
      issues.push({ code: "missing_required_slot", path: [field], variantId, field })
    }
  }
  for (const field of variant.forbiddenFields) {
    if (hasProviderFieldValue(record[field])) {
      issues.push({ code: "inactive_slot_value", path: [field], variantId, field })
    }
  }
  if (block.blockType === "logoCloud" && Array.isArray(record.logos)) {
    record.logos.forEach((logo, index) => {
      if (!logo || typeof logo !== "object" || !(logo as Record<string, unknown>).image) {
        issues.push({
          code: "missing_required_media",
          path: ["logos", index, "image"],
          variantId,
          index,
        })
      }
    })
  }
  return { variant, issues }
}
