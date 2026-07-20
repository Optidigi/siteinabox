import * as React from "react"
import type { Block } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../../../../blocks/types"
import { providerBlockAttributes } from "../../runtime/block"
import type { TypedPilotId } from "../../typed/registry"
import { Testimonials04 } from "./testimonials"

type VariantBlock = Extract<Block, { blockType: "testimonials" }>

const VARIANT: TypedPilotId = "shadcnui-blocks.testimonials-04"

export default function View({ block, options }: { block: VariantBlock; options: BlockRenderOptions }) {
  return (
    <Testimonials04
      title={block.title}
      intro={block.intro}
      items={block.items ?? []}
      blockIndex={options.index}
      editSlots={options.editSlots}
      mediaResolver={options.mediaResolver}
      rootAttributes={providerBlockAttributes({ block, options }, VARIANT)}
    />
  )
}
