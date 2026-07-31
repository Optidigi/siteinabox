import { SHADCNUI_BLOCK_VARIANTS, SHADCNUI_CHROME_VARIANTS, SHADCNUI_SYSTEM_BLOCK_VARIANTS } from "./generated/shadcnui-blocks"
import { validateProviderBlockCore } from "./provider-validation"
import type { Block } from "./site"

export type ProviderBlockValidationIssue = {
  code: "missing_provider_variant" | "unresolved_provider_variant" | "missing_required_slot" | "inactive_slot_value" | "slot_count_out_of_range" | "missing_required_media"
  message: string
  path: string[]
}

const blockVariants = new Map([...SHADCNUI_BLOCK_VARIANTS, ...SHADCNUI_SYSTEM_BLOCK_VARIANTS].map((variant) => [`${variant.blockType}:${variant.id}`, variant]))
const chromeVariants = new Map(SHADCNUI_CHROME_VARIANTS.map((variant) => [`${variant.area}:${variant.id}`, variant]))
const clean = (value: string | null | undefined) => value?.trim() || undefined

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
  const core = validateProviderBlockCore({ ...block, designVariant: id }, {
    includeSystemBlockVariants: true,
    validateSystemBlockSlots: true,
  })
  const coreIssues = core.issues.map((entry): ProviderBlockValidationIssue => {
    if (entry.code === "missing_provider_variant") return { code: entry.code, message: `Block type "${block.blockType}" requires an approved explicit provider variant.`, path: entry.path }
    if (entry.code === "unresolved_provider_variant") return { code: entry.code, message: `Unresolved provider block variant "${entry.variantId}" for block type "${block.blockType}".`, path: entry.path }
    if (entry.code === "missing_required_slot") return { code: entry.code, message: `Provider variant "${entry.variantId}" requires slot "${entry.field}".`, path: entry.path }
    if (entry.code === "inactive_slot_value") return { code: entry.code, message: `Provider variant "${entry.variantId}" does not expose slot "${entry.field}".`, path: entry.path }
    return { code: entry.code, message: `Provider variant "${entry.variantId}" requires an image for every logo.`, path: entry.path.map(String) }
  })
  if (!core.variant || !id) return coreIssues
  const record = block as unknown as Record<string, unknown>
  const issues = [...coreIssues]
  for (const [field, slot] of Object.entries(core.variant.activeSlots)) {
    const value = record[field]
    if (Array.isArray(value) && "minItems" in slot && typeof slot.minItems === "number" && value.length < slot.minItems) issues.push({ code: "slot_count_out_of_range", message: `Provider variant "${id}" requires at least ${slot.minItems} items in "${field}".`, path: [field] })
    if (Array.isArray(value) && "maxItems" in slot && typeof slot.maxItems === "number" && value.length > slot.maxItems) issues.push({ code: "slot_count_out_of_range", message: `Provider variant "${id}" allows at most ${slot.maxItems} items in "${field}".`, path: [field] })
  }
  return issues
}
