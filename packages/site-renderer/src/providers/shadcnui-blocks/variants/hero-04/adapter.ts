import type { Block } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../../../../blocks/types"

export const variantId = "shadcnui-blocks.hero-04" as const
export type VariantAdapterInput = { block: Extract<Block, { blockType: "hero" }>; options: BlockRenderOptions }
export function adaptVariant(input: VariantAdapterInput) {
  return { block: input.block, options: input.options }
}
