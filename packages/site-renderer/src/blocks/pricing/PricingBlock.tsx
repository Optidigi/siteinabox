import * as React from "react"
import type { PricingBlock } from "@siteinabox/contracts"
import { PendingBlock } from "../shared"
import type { BlockRenderOptions } from "../types"

export function PricingBlockView({ block, options }: { block: PricingBlock; options: BlockRenderOptions }) {
  return <PendingBlock blockType={block.blockType} heading={block.heading} options={options} />
}
