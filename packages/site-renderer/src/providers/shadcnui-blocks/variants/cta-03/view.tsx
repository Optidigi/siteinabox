import * as React from "react"
import type { Block } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../../../../blocks/types"
import { providerBlockAttributes } from "../../runtime/block"
import type { TypedPilotId } from "../../typed/registry"
import { Cta03 } from "./cta"

type VariantBlock = Extract<Block, { blockType: "cta" }>

const VARIANT: TypedPilotId = "shadcnui-blocks.cta-03"

export default function View({ block, options }: { block: VariantBlock; options: BlockRenderOptions }) {
  return (
    <Cta03
      headline={block.headline}
      description={block.description}
      primary={block.primary}
      backgroundImage={block.backgroundImage}
      blockIndex={options.index}
      editSlots={options.editSlots}
      mediaResolver={options.mediaResolver}
      rootAttributes={providerBlockAttributes({ block, options }, VARIANT)}
    />
  )
}
