import type { Block } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../../../../blocks/types"

export const variantId = "shadcnui-blocks.timeline-04" as const
export type VariantAdapterInput = { block: Extract<Block, { blockType: "contentSection" }>; options: BlockRenderOptions }
export function adaptVariant(input: VariantAdapterInput) {
  return { block: input.block, options: input.options }
}
