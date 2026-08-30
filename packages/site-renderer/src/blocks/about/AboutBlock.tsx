import * as React from "react"
import type { AboutBlock } from "@siteinabox/contracts"
import { PendingBlock } from "../shared"
import type { BlockRenderOptions } from "../types"

export function AboutBlockView({ block, options }: { block: AboutBlock; options: BlockRenderOptions }) {
  return <PendingBlock blockType={block.blockType} heading={block.heading} options={options} />
}
