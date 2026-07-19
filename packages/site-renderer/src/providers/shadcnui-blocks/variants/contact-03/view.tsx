import * as React from "react"
import type { Block } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../../../../blocks/types"
import { providerBlockAttributes } from "../../runtime/block"
import type { TypedPilotId } from "../../typed/registry"
import { Contact03 } from "./contact"

type VariantBlock = Extract<Block, { blockType: "contactDetails" }>

const VARIANT: TypedPilotId = "shadcnui-blocks.contact-03"

export default function View({ block, options }: { block: VariantBlock; options: BlockRenderOptions }) {
  return (
    <Contact03
      title={block.title}
      description={block.description}
      items={block.items ?? []}

      blockIndex={options.index}
      editSlots={options.editSlots}
      rootAttributes={providerBlockAttributes({ block, options }, VARIANT)}
    />
  )
}
