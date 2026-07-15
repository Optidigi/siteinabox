import type { Block } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../../../../blocks/types"

export const variantId = "shadcnui-blocks.carousel-block-02" as const
export type VariantAdapterInput = { block: Extract<Block, { blockType: "gallery" }>; options: BlockRenderOptions }
export function adaptVariant(input: VariantAdapterInput) {
  return { block: input.block, options: input.options }
}
