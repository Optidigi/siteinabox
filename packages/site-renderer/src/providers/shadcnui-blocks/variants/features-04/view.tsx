import * as React from "react"
import type { Block } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../../../../blocks/types"
import { providerBlockAttributes } from "../../runtime/block"
import type { TypedPilotId } from "../../typed/registry"
import { Features04 } from "./features"

type VariantBlock = Extract<Block, { blockType: "featureList" }>

const VARIANT: TypedPilotId = "shadcnui-blocks.features-04"

export default function View({ block, options }: { block: VariantBlock; options: BlockRenderOptions }) {
  return (
    <Features04
      title={block.title}
      features={block.features ?? []}
      blockIndex={options.index}
      editSlots={options.editSlots}
      mediaResolver={options.mediaResolver}
      rootAttributes={providerBlockAttributes({ block, options }, VARIANT)}
    />
  )
}
