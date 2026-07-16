import * as React from "react"
import { getProviderBlockVariant, isProviderVariantIdentifier, type Block } from "@siteinabox/contracts"
import { ShadcnUiBlockView } from "../providers/shadcnui-blocks/views"
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
  const explicitRenderer = registry?.[block.blockType]

  if (!variant && !explicitRenderer) {
    throw new Error(`Block type "${block.blockType}" requires an approved explicit provider variant.`)
  }
  const providerVariant = variant && isProviderVariantIdentifier(variant) ? getProviderBlockVariant(block) : null
  if (variant && isProviderVariantIdentifier(variant) && !providerVariant) {
    throw new Error(`Unresolved provider block variant "${variant}" for block type "${block.blockType}".`)
  }
  if (providerVariant) return <ShadcnUiBlockView block={block} options={{ ...options, index }} variant={providerVariant.id} />
  const Renderer = explicitRenderer
  if (!Renderer) throw new Error(`Unsupported block variant "${variant ?? "missing"}" for block type "${block.blockType}".`)
  return <Renderer block={block} options={{ ...options, index }} />
}
