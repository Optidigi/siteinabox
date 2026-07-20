import * as React from "react"
import type { Block } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../../../../blocks/types"
import { providerBlockAttributes } from "../../runtime/block"
import type { TypedPilotId } from "../../typed/registry"
import { LogoCloud10 } from "./logo-cloud"

type VariantBlock = Extract<Block, { blockType: "logoCloud" }>

const VARIANT: TypedPilotId = "shadcnui-blocks.logo-cloud-10"

export default function View({ block, options }: { block: VariantBlock; options: BlockRenderOptions }) {
  return (
    <LogoCloud10
      title={block.title}
      logos={block.logos ?? []}
      blockIndex={options.index}
      editSlots={options.editSlots}
      mediaResolver={options.mediaResolver}
      rootAttributes={providerBlockAttributes({ block, options }, VARIANT)}
    />
  )
}
