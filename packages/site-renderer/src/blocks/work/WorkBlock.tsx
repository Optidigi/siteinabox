import * as React from "react"
import type { WorkBlock } from "@siteinabox/contracts"
import { PendingBlock } from "../shared"
import type { BlockRenderOptions } from "../types"

export function WorkBlockView({ block, options }: { block: WorkBlock; options: BlockRenderOptions }) {
  return <PendingBlock blockType={block.blockType} heading={block.heading} options={options} />
}
