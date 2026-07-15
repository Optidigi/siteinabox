import * as React from "react"
import type { Block } from "@siteinabox/contracts"
import { getSourceBackedVariantRenderer, isProviderVariantIdentifier } from "../source-blocks/registry"
import type { BlockRegistry, BlockRenderOptions } from "./types"

export * from "./types"
export * from "./anchors"
export * from "./variants"

export function BlockRenderer({ block, index, registry, options }: {
  block: Block
  index: number
  registry?: BlockRegistry
  options?: Partial<Omit<BlockRenderOptions, "index">>
}) {
  const variant = block.designVariant?.trim()
  const sourceRenderer = getSourceBackedVariantRenderer(block)
  const explicitRenderer = registry?.[block.blockType]

  if (!variant && !explicitRenderer) {
    throw new Error(`Block type "${block.blockType}" requires an approved explicit provider variant.`)
  }
  if (variant && isProviderVariantIdentifier(variant) && !sourceRenderer) {
    throw new Error(`Unresolved provider block variant "${variant}" for block type "${block.blockType}".`)
  }
  const Renderer = sourceRenderer ?? explicitRenderer
  if (!Renderer) throw new Error(`Unsupported block variant "${variant ?? "missing"}" for block type "${block.blockType}".`)
  return <Renderer block={block} options={{ ...options, index }} />
}
