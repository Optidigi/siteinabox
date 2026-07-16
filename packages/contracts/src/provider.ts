import { SHADCNUI_BLOCK_VARIANTS, SHADCNUI_CHROME_VARIANTS, SHADCNUI_SYSTEM_BLOCK_VARIANTS } from "./generated/shadcnui-blocks"
import type { Block } from "./site"

export type ProviderBlockValidationIssue = {
  code: "missing_provider_variant" | "unresolved_provider_variant" | "missing_required_slot" | "inactive_slot_value" | "slot_count_out_of_range" | "missing_required_media"
  message: string
  path: string[]
}

const blockVariants = new Map([...SHADCNUI_BLOCK_VARIANTS, ...SHADCNUI_SYSTEM_BLOCK_VARIANTS].map((variant) => [`${variant.blockType}:${variant.id}`, variant]))
const chromeVariants = new Map(SHADCNUI_CHROME_VARIANTS.map((variant) => [`${variant.area}:${variant.id}`, variant]))
const clean = (value: string | null | undefined) => value?.trim() || undefined
const hasValue = (value: unknown): boolean => {
  if (value == null) return false
  if (typeof value === "string") return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).some(hasValue)
  return true
}

export const isProviderVariantIdentifier = (value: string | null | undefined) => clean(value)?.startsWith("shadcnui-blocks.") ?? false
export const getProviderBlockVariant = (block: Pick<Block, "blockType" | "designVariant">) => {
  const id = clean(block.designVariant)
  return id ? blockVariants.get(`${block.blockType}:${id}`) ?? null : null
}
export const getProviderChromeVariant = (area: "header" | "footer" | "banner", id: string | null | undefined) => {
  const value = clean(id)
  return value ? chromeVariants.get(`${area}:${value}`) ?? null : null
}

export function validateProviderBlockInstance(block: Block): ProviderBlockValidationIssue[] {
  const id = clean(block.designVariant)
  if (!id) return [{ code: "missing_provider_variant", message: `Block type "${block.blockType}" requires an approved explicit provider variant.`, path: ["designVariant"] }]
  const variant = getProviderBlockVariant(block)
  if (!variant) return [{ code: "unresolved_provider_variant", message: `Unresolved provider block variant "${id}" for block type "${block.blockType}".`, path: ["designVariant"] }]
  const record = block as unknown as Record<string, unknown>
  const issues: ProviderBlockValidationIssue[] = []
  for (const [field, slot] of Object.entries(variant.slots)) {
    const value = record[field]
    if (slot.status === "required" && !hasValue(value)) issues.push({ code: "missing_required_slot", message: `Provider variant "${id}" requires slot "${field}".`, path: [field] })
    if (slot.status === "inactive" && hasValue(value)) issues.push({ code: "inactive_slot_value", message: `Provider variant "${id}" does not expose slot "${field}".`, path: [field] })
    if (Array.isArray(value) && "minItems" in slot && typeof slot.minItems === "number" && value.length < slot.minItems) issues.push({ code: "slot_count_out_of_range", message: `Provider variant "${id}" requires at least ${slot.minItems} items in "${field}".`, path: [field] })
    if (Array.isArray(value) && "maxItems" in slot && typeof slot.maxItems === "number" && value.length > slot.maxItems) issues.push({ code: "slot_count_out_of_range", message: `Provider variant "${id}" allows at most ${slot.maxItems} items in "${field}".`, path: [field] })
  }
  if (block.blockType === "logoCloud") {
    block.logos.forEach((logo, index) => {
      if (!logo.image) issues.push({ code: "missing_required_media", message: `Provider variant "${id}" requires an image for every logo.`, path: ["logos", String(index), "image"] })
    })
  }
  return issues
}
