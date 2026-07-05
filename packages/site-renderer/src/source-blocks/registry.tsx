import type { Block } from "@siteinabox/contracts"
import type { BlockRendererComponent } from "../blocks/types"
import { tailwindPlusMarketingContactCenteredProviderBlock } from "./tailwindplus/marketing/contact/centered"
import { tailwindPlusMarketingCtaDarkPanelWithAppScreenshotProviderBlock } from "./tailwindplus/marketing/cta/dark-panel-with-app-screenshot"
import { tailwindPlusMarketingFeatureCentered2x2GridProviderBlock } from "./tailwindplus/marketing/feature/centered-2x2-grid"
import { tailwindPlusMarketingFeatureWithProductScreenshotProviderBlock } from "./tailwindplus/marketing/feature/with-product-screenshot"
import { tailwindPlusMarketingBlogThreeColumnProviderBlock } from "./tailwindplus/marketing/blog/three-column"
import { tailwindPlusMarketingHeroSimpleCenteredProviderBlock } from "./tailwindplus/marketing/hero/simple-centered"
import { tailwindPlusMarketingLogoCloudSimpleWithHeadingProviderBlock } from "./tailwindplus/marketing/logo-cloud/simple-with-heading"
import { tailwindPlusMarketingPricingTwoTiersWithEmphasizedRightTierProviderBlock } from "./tailwindplus/marketing/pricing/two-tiers-with-emphasized-right-tier"
import { tailwindPlusMarketingStatsSimpleProviderBlock } from "./tailwindplus/marketing/stats/simple"
import { tailwindPlusMarketingTeamWithSmallImagesProviderBlock } from "./tailwindplus/marketing/team/with-small-images"
import { tailwindPlusMarketingTestimonialSimpleCenteredProviderBlock } from "./tailwindplus/marketing/testimonial/simple-centered"

export type ProviderBlockSlotKind = "richtext" | "text" | "cta" | "image" | "repeater"
export type ProviderBlockSlotStatus = "required" | "optional" | "inactive"

export type ProviderBlockSlotManifestEntry = {
  kind: ProviderBlockSlotKind
  status: ProviderBlockSlotStatus
  exposed: boolean
  sourceField: string
  minItems?: number
  maxItems?: number
}

export type ProviderBlockSourceMetadata = {
  sourceName: string
  sourceUrl: string
  sourceComponent: string
  sourceHash: string
  capturedAt: string
  license: string
}

export type ProviderBlockDefinition<TBlock extends Block = Block> = {
  provider: "tailwindplus"
  namespace: string
  id: string
  blockType: TBlock["blockType"]
  legacyDesignVariant?: string
  rendererClassName?: string
  renderer?: BlockRendererComponent<TBlock>
  slots: Record<string, ProviderBlockSlotManifestEntry>
  source: ProviderBlockSourceMetadata
}

type SourceBackedVariantKey = `${Block["blockType"]}:${string}`

function sourceBackedVariantKey(blockType: Block["blockType"], variant: string): SourceBackedVariantKey {
  return `${blockType}:${variant}` as SourceBackedVariantKey
}

export function defineProviderBlock<TBlock extends Block>(definition: ProviderBlockDefinition<TBlock>) {
  return definition
}

export const providerBlockDefinitions = [
  tailwindPlusMarketingHeroSimpleCenteredProviderBlock,
  tailwindPlusMarketingFeatureWithProductScreenshotProviderBlock,
  tailwindPlusMarketingFeatureCentered2x2GridProviderBlock,
  tailwindPlusMarketingCtaDarkPanelWithAppScreenshotProviderBlock,
  tailwindPlusMarketingContactCenteredProviderBlock,
  tailwindPlusMarketingTestimonialSimpleCenteredProviderBlock,
  tailwindPlusMarketingStatsSimpleProviderBlock,
  tailwindPlusMarketingLogoCloudSimpleWithHeadingProviderBlock,
  tailwindPlusMarketingPricingTwoTiersWithEmphasizedRightTierProviderBlock,
  tailwindPlusMarketingTeamWithSmallImagesProviderBlock,
  tailwindPlusMarketingBlogThreeColumnProviderBlock,
] as const satisfies readonly ProviderBlockDefinition<any>[]

export type ProviderBlockId = typeof providerBlockDefinitions[number]["id"]
export type ProviderBlockNamespace = typeof providerBlockDefinitions[number]["namespace"]

const providerBlockDefinitionsByVariant: Partial<Record<SourceBackedVariantKey, ProviderBlockDefinition<any>>> = {}
const sourceBackedVariantRenderers: Partial<Record<SourceBackedVariantKey, BlockRendererComponent<any>>> = {}

for (const definition of providerBlockDefinitions) {
  providerBlockDefinitionsByVariant[sourceBackedVariantKey(definition.blockType, definition.id)] = definition
  if (definition.legacyDesignVariant) {
    providerBlockDefinitionsByVariant[sourceBackedVariantKey(definition.blockType, definition.legacyDesignVariant)] = definition
  }
  if (definition.renderer) {
    sourceBackedVariantRenderers[sourceBackedVariantKey(definition.blockType, definition.id)] = definition.renderer
    if (definition.legacyDesignVariant) {
      sourceBackedVariantRenderers[sourceBackedVariantKey(definition.blockType, definition.legacyDesignVariant)] =
        definition.renderer
    }
  }
}

export const sourceBackedVariantRegistry = sourceBackedVariantRenderers

function cleanVariant(value: string | null | undefined) {
  const variant = value?.trim()
  return variant ? variant : undefined
}

export function getProviderBlockDefinition(block: Block) {
  const variant = cleanVariant(block.designVariant)
  if (!variant) return null
  return providerBlockDefinitionsByVariant[sourceBackedVariantKey(block.blockType, variant)] ?? null
}

export function isProviderBlockVariant(block: Block) {
  return Boolean(getProviderBlockDefinition(block))
}

export function isProviderVariantIdentifier(value: string | null | undefined) {
  const variant = cleanVariant(value)
  if (!variant) return false
  return (
    variant.startsWith("tailwindplus.") ||
    variant.startsWith("tailwindPlus") ||
    variant.startsWith("preline.") ||
    variant.startsWith("preline") ||
    variant.startsWith("tailblocks.") ||
    variant.startsWith("tailblocks")
  )
}

export function getSourceBackedVariantRenderer(block: Block) {
  const variant = cleanVariant(block.designVariant)
  if (!variant) return null
  return sourceBackedVariantRenderers[sourceBackedVariantKey(block.blockType, variant)] ?? null
}

export function isSourceBackedVariant(block: Block) {
  return isProviderBlockVariant(block)
}

export function assertProviderBlockRenderer(block: Block) {
  const variant = cleanVariant(block.designVariant)
  if (!variant || !isProviderVariantIdentifier(variant)) return
  const definition = getProviderBlockDefinition(block)
  if (!definition) {
    throw new Error(`Unresolved provider block variant "${variant}" for block type "${block.blockType}".`)
  }
  if (!getSourceBackedVariantRenderer(block)) {
    throw new Error(`Provider block variant "${variant}" for block type "${block.blockType}" has no renderer.`)
  }
}

export type ProviderBlockValidationIssue = {
  code:
    | "unresolved_provider_variant"
    | "missing_provider_renderer"
    | "missing_required_slot"
    | "inactive_slot_value"
    | "slot_count_out_of_range"
  message: string
  path: string[]
}

function hasSlotValue(value: unknown) {
  if (value == null) return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === "string") return value.trim().length > 0
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0
  return true
}

function getSlotValues(record: Record<string, unknown>, sourceField: string): Array<{ value: unknown; path: string[] }> {
  const [field, subField] = sourceField.split(".")
  if (!field) return [{ value: undefined, path: [sourceField] }]
  const value = record[field]
  if (!subField) return [{ value, path: [field] }]
  if (!Array.isArray(value)) return [{ value: undefined, path: [field, subField] }]
  return value.map((item, index) => ({
    value: item && typeof item === "object" ? (item as Record<string, unknown>)[subField] : undefined,
    path: [field, String(index), subField],
  }))
}

export function validateProviderBlockInstance(block: Block): ProviderBlockValidationIssue[] {
  const variant = cleanVariant(block.designVariant)
  if (!variant || !isProviderVariantIdentifier(variant)) return []

  const definition = getProviderBlockDefinition(block)
  if (!definition) {
    return [{
      code: "unresolved_provider_variant",
      message: `Unresolved provider block variant "${variant}" for block type "${block.blockType}".`,
      path: ["designVariant"],
    }]
  }

  const issues: ProviderBlockValidationIssue[] = []
  if (!getSourceBackedVariantRenderer(block)) {
    issues.push({
      code: "missing_provider_renderer",
      message: `Provider block variant "${variant}" for block type "${block.blockType}" has no renderer.`,
      path: ["designVariant"],
    })
  }

  const record = block as Record<string, unknown>
  for (const [slotName, slot] of Object.entries(definition.slots)) {
    const field = slot.sourceField || slotName
    const slotValues = getSlotValues(record, field)
    const hasValue = slotValues.some((entry) => hasSlotValue(entry.value))
    if (slot.status === "required" && !hasValue) {
      issues.push({
        code: "missing_required_slot",
        message: `Provider block variant "${variant}" requires slot "${field}".`,
        path: [field],
      })
    }
    if (slot.status === "required" && field.includes(".") && hasValue) {
      for (const entry of slotValues.filter((candidate) => !hasSlotValue(candidate.value))) {
        issues.push({
          code: "missing_required_slot",
          message: `Provider block variant "${variant}" requires slot "${field}" for every item.`,
          path: entry.path,
        })
      }
    }
    if (slot.status === "inactive" && hasValue) {
      for (const entry of slotValues.filter((candidate) => hasSlotValue(candidate.value))) {
        issues.push({
          code: "inactive_slot_value",
          message: `Provider block variant "${variant}" does not expose slot "${field}".`,
          path: entry.path,
        })
      }
    }
    if (slot.kind === "repeater" && hasValue) {
      const [repeaterField] = field.split(".")
      if (!repeaterField) continue
      const repeaterValue = record[repeaterField]
      if (Array.isArray(repeaterValue)) {
        const count = repeaterValue.length
        if (slot.minItems != null && count < slot.minItems) {
          issues.push({
            code: "slot_count_out_of_range",
            message: `Provider block variant "${variant}" requires at least ${slot.minItems} "${repeaterField}" items.`,
            path: [repeaterField],
          })
        }
        if (slot.maxItems != null && count > slot.maxItems) {
          issues.push({
            code: "slot_count_out_of_range",
            message: `Provider block variant "${variant}" allows at most ${slot.maxItems} "${repeaterField}" items.`,
            path: [repeaterField],
          })
        }
      }
    }
  }

  return issues
}
