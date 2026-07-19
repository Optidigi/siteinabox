import * as React from "react"
import type { Block } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../../../../blocks/types"
import { providerBlockAttributes } from "../../runtime/block"
import type { TypedPilotId } from "../../typed/registry"
import { Pricing06 } from "./pricing"

type VariantBlock = Extract<Block, { blockType: "pricing" }>

const VARIANT: TypedPilotId = "shadcnui-blocks.pricing-06"

export default function View({ block, options }: { block: VariantBlock; options: BlockRenderOptions }) {
  return (
    <Pricing06
      title={block.title}
      intro={block.intro}
      plans={block.plans ?? []}
      blockIndex={options.index}
      editSlots={options.editSlots}
      rootAttributes={providerBlockAttributes({ block, options }, VARIANT)}
    />
  )
}
