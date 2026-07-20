import * as React from "react"
import type { Block } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../../../../blocks/types"
import { providerBlockAttributes } from "../../runtime/block"
import type { TypedPilotId } from "../../typed/registry"
import { Faq14 } from "./faq"

type VariantBlock = Extract<Block, { blockType: "faq" }>

const VARIANT: TypedPilotId = "shadcnui-blocks.faq-14"

export default function View({ block, options }: { block: VariantBlock; options: BlockRenderOptions }) {
  return (
    <Faq14
      title={block.title}
      items={block.items ?? []}
      intro={block.intro}
      blockIndex={options.index}
      editSlots={options.editSlots}
      rootAttributes={providerBlockAttributes({ block, options }, VARIANT)}
    />
  )
}
