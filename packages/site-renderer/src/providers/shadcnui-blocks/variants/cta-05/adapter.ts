import type { Block } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../../../../blocks/types"

export const variantId = "shadcnui-blocks.cta-05" as const
export type VariantAdapterInput = { block: Extract<Block, { blockType: "cta" }>; options: BlockRenderOptions }
export function adaptVariant(input: VariantAdapterInput) {
  return { block: input.block, options: input.options }
}
