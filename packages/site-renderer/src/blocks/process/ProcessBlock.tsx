import * as React from "react"
import type { ProcessBlock } from "@siteinabox/contracts"
import { PendingBlock } from "../shared"
import type { BlockRenderOptions } from "../types"

export function ProcessBlockView({ block, options }: { block: ProcessBlock; options: BlockRenderOptions }) {
  return <PendingBlock blockType={block.blockType} heading={block.heading} options={options} />
}
