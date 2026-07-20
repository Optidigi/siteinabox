import * as React from "react"
import type { Block } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../../../../blocks/types"
import { providerBlockAttributes } from "../../runtime/block"
import type { TypedPilotId } from "../../typed/registry"
import { Integrations05 } from "./integrations"

type VariantBlock = Extract<Block, { blockType: "logoCloud" }>

const VARIANT: TypedPilotId = "shadcnui-blocks.integrations-05"

export default function View({ block, options }: { block: VariantBlock; options: BlockRenderOptions }) {
  return (
    <Integrations05
      title={block.title}
      intro={block.intro}
      logos={block.logos ?? []}
      blockIndex={options.index}
      editSlots={options.editSlots}
      mediaResolver={options.mediaResolver}
      rootAttributes={providerBlockAttributes({ block, options }, VARIANT)}
    />
  )
}
