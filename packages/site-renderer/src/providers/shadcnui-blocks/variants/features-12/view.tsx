import * as React from "react"
import type { Block } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../../../../blocks/types"
import { providerBlockAttributes } from "../../runtime/block"
import type { TypedPilotId } from "../../typed/registry"
import { Features12 } from "./features"

type VariantBlock = Extract<Block, { blockType: "featureList" }>
const VARIANT: TypedPilotId = "shadcnui-blocks.features-12"

export default function View({ block, options }: { block: VariantBlock; options: BlockRenderOptions }) {
  return (
    <Features12
      eyebrow={block.eyebrow}
      title={block.title}
      intro={block.intro}
      features={block.features ?? []}
      blockIndex={options.index}
      editSlots={options.editSlots}
      rootAttributes={providerBlockAttributes({ block, options }, VARIANT)}
    />
  )
}
