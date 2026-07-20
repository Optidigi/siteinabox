import * as React from "react"
import type { Block } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../../../../blocks/types"
import { providerBlockAttributes } from "../../runtime/block"
import type { TypedPilotId } from "../../typed/registry"
import { Stats05 } from "./stats"

type VariantBlock = Extract<Block, { blockType: "stats" }>

const VARIANT: TypedPilotId = "shadcnui-blocks.stats-05"

export default function View({ block, options }: { block: VariantBlock; options: BlockRenderOptions }) {
  return (
    <Stats05
      title={block.title}
      intro={block.intro}
      items={block.items ?? []}
      blockIndex={options.index}
      editSlots={options.editSlots}
      rootAttributes={providerBlockAttributes({ block, options }, VARIANT)}
    />
  )
}
