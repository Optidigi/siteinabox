import * as React from "react"
import type { ContactBlock } from "@siteinabox/contracts"
import { PendingBlock } from "../shared"
import type { BlockRenderOptions } from "../types"

export function ContactBlockView({ block, options }: { block: ContactBlock; options: BlockRenderOptions }) {
  return <PendingBlock blockType={block.blockType} heading={block.heading} options={options} />
}
