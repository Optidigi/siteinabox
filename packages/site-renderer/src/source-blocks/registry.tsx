import * as React from "react"
import { SHADCNUI_BLOCK_VARIANTS } from "@siteinabox/contracts"
import type { Block } from "@siteinabox/contracts"
import type { BlockRendererComponent } from "../blocks/types"
import { ShadcnUiBlockView } from "../providers/shadcnui-blocks/views"

export type ProviderBlockSlotKind = "richtext" | "text" | "cta" | "image" | "repeater" | "runtime" | "inactive"
export type ProviderBlockSlotStatus = "required" | "optional" | "inactive"
export type ProviderBlockSlotManifestEntry = { kind: ProviderBlockSlotKind; status: ProviderBlockSlotStatus; exposed: boolean; sourceField: string; repeated: boolean; minItems?: number; maxItems?: number }
export type ProviderBlockSourceMetadata = {
  sourceName: string; sourceUrl: string; sourceComponent: string; sourceHash: string; capturedAt: string; license: string
  sourceAvailability: "free-public"; licenseCompatibility: "compatible"; approvalStatus: "approved"; implementation: "exact-source" | "adapted-exact-style"; visualExactnessStatus: "reviewed-exact-source" | "needs-browser-comparison"
}
export type ProviderBlockDefinition<TBlock extends Block = Block> = {
  provider: "shadcnui-blocks"; namespace: string; id: string; blockType: TBlock["blockType"]
  rendererClassName: string; renderer: BlockRendererComponent<TBlock>; slots: Record<string, ProviderBlockSlotManifestEntry>
  composition: { embedsNavigation: boolean; suppressesChromeAreas: readonly string[] }
  legacyDesignVariant?: string
  source: ProviderBlockSourceMetadata
}
export type ProviderBlockValidationIssue = { code: "missing_provider_variant" | "unresolved_provider_variant" | "missing_required_slot" | "inactive_slot_value" | "slot_count_out_of_range"; message: string; path: string[] }

const definitions = SHADCNUI_BLOCK_VARIANTS.map((variant): ProviderBlockDefinition => ({
  provider: "shadcnui-blocks", namespace: `shadcnui-blocks.${variant.upstreamName.replace(/-\d+$/, "")}`, id: variant.id,
  blockType: variant.blockType, rendererClassName: `cms-block--source-shadcnui-blocks-${variant.upstreamName}`,
  renderer: ({ block, options }) => <ShadcnUiBlockView block={block} options={options} variant={variant.id} />,
  slots: Object.fromEntries(Object.entries(variant.slots).map(([field, slot]) => [field, { ...slot, exposed: slot.status !== "inactive", sourceField: field }])),
  composition: variant.composition,
  source: { sourceName: "akash3444/shadcn-ui-blocks", sourceUrl: "https://github.com/akash3444/shadcn-ui-blocks", sourceComponent: variant.upstreamName,
    sourceHash: variant.sourceHash, capturedAt: "2026-07-15", license: "MIT", sourceAvailability: "free-public", licenseCompatibility: "compatible",
    approvalStatus: "approved", implementation: "adapted-exact-style", visualExactnessStatus: "needs-browser-comparison" },
}))
export const providerBlockDefinitions = definitions
export const selfServeProviderBlockDefinitions = definitions
export type ProviderBlockId = (typeof SHADCNUI_BLOCK_VARIANTS)[number]["id"]
export type ProviderBlockNamespace = string
export const defineProviderBlock = <TBlock extends Block>(definition: ProviderBlockDefinition<TBlock>) => definition

const byKey = new Map(definitions.map((definition) => [`${definition.blockType}:${definition.id}`, definition]))
const clean = (value: string | null | undefined) => value?.trim() || undefined
export const isProviderVariantIdentifier = (value: string | null | undefined) => clean(value)?.startsWith("shadcnui-blocks.") ?? false
export const getProviderBlockDefinition = (block: Block) => {
  const variant = clean(block.designVariant)
  return variant ? byKey.get(`${block.blockType}:${variant}`) ?? null : null
}
export const isProviderBlockVariant = (block: Block) => Boolean(getProviderBlockDefinition(block))
export const isSourceBackedVariant = isProviderBlockVariant
export const getSourceBackedVariantRenderer = (block: Block) => getProviderBlockDefinition(block)?.renderer ?? null
export const sourceBackedVariantRegistry = Object.fromEntries(definitions.map((definition) => [`${definition.blockType}:${definition.id}`, definition.renderer]))

export function assertProviderBlockRenderer(block: Block) {
  const variant = clean(block.designVariant)
  if (!variant) throw new Error(`Block type "${block.blockType}" requires an approved explicit provider variant.`)
  if (!isProviderVariantIdentifier(variant) || !getProviderBlockDefinition(block)) throw new Error(`Unresolved provider block variant "${variant}" for block type "${block.blockType}".`)
}
const hasValue = (value: unknown): boolean => value != null && (typeof value !== "string" || value.trim().length > 0) && (!Array.isArray(value) || value.length > 0)
export function validateProviderBlockInstance(block: Block): ProviderBlockValidationIssue[] {
  const variant = clean(block.designVariant)
  if (!variant) return [{ code: "missing_provider_variant", message: `Block type "${block.blockType}" requires an approved explicit provider variant.`, path: ["designVariant"] }]
  const definition = getProviderBlockDefinition(block)
  if (!definition) return [{ code: "unresolved_provider_variant", message: `Unresolved provider block variant "${variant}" for block type "${block.blockType}".`, path: ["designVariant"] }]
  const record = block as Record<string, unknown>
  const issues: ProviderBlockValidationIssue[] = []
  for (const [field, slot] of Object.entries(definition.slots)) {
    const value = record[field]
    if (slot.status === "required" && !hasValue(value)) issues.push({ code: "missing_required_slot", message: `Provider variant "${variant}" requires slot "${field}".`, path: [field] })
    if (slot.status === "inactive" && hasValue(value)) issues.push({ code: "inactive_slot_value", message: `Provider variant "${variant}" does not expose slot "${field}".`, path: [field] })
    if (Array.isArray(value) && slot.minItems != null && value.length < slot.minItems) issues.push({ code: "slot_count_out_of_range", message: `Provider variant "${variant}" requires at least ${slot.minItems} items in "${field}".`, path: [field] })
    if (Array.isArray(value) && slot.maxItems != null && value.length > slot.maxItems) issues.push({ code: "slot_count_out_of_range", message: `Provider variant "${variant}" allows at most ${slot.maxItems} items in "${field}".`, path: [field] })
  }
  return issues
}
