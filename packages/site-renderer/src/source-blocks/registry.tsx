import type { Block } from "@siteinabox/contracts"
import type { BlockRendererComponent } from "../blocks/types"

type SourceBackedVariantKey = `${Block["blockType"]}:${string}`

export const sourceBackedVariantRegistry = {} satisfies Partial<Record<SourceBackedVariantKey, BlockRendererComponent<any>>>

const sourceBackedVariantRenderers: Partial<Record<SourceBackedVariantKey, BlockRendererComponent<any>>> =
  sourceBackedVariantRegistry

export function getSourceBackedVariantRenderer(block: Block) {
  const variant = block.designVariant?.trim()
  if (!variant) return null
  return sourceBackedVariantRenderers[`${block.blockType}:${variant}` as SourceBackedVariantKey] ?? null
}

export function isSourceBackedVariant(block: Block) {
  return Boolean(getSourceBackedVariantRenderer(block))
}
