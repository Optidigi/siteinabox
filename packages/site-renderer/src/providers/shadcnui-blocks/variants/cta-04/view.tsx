import * as React from "react"
import type { Block } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../../../../blocks/types"
import { providerBlockAttributes } from "../../runtime/block"
import type { TypedPilotId } from "../../typed/registry"
import { Cta04 } from "./cta"

type VariantBlock = Extract<Block, { blockType: "cta" }>

const VARIANT: TypedPilotId = "shadcnui-blocks.cta-04"

export default function View({ block, options }: { block: VariantBlock; options: BlockRenderOptions }) {
  return (
    <Cta04
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
