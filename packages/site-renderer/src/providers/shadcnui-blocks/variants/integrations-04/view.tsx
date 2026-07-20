import * as React from "react"
import type { Block } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../../../../blocks/types"
import { providerBlockAttributes } from "../../runtime/block"
import type { TypedPilotId } from "../../typed/registry"
import { Integrations04 } from "./integrations"

type VariantBlock = Extract<Block, { blockType: "logoCloud" }>

const VARIANT: TypedPilotId = "shadcnui-blocks.integrations-04"

export default function View({ block, options }: { block: VariantBlock; options: BlockRenderOptions }) {
  return (
    <Integrations04
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
