import * as React from "react"
import type { Block } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../../../../blocks/types"
import { providerBlockAttributes } from "../../runtime/block"
import type { TypedPilotId } from "../../typed/registry"
import { CarouselBlock02 } from "./carousel"

type VariantBlock = Extract<Block, { blockType: "gallery" }>

const VARIANT: TypedPilotId = "shadcnui-blocks.carousel-block-02"

export default function View({ block, options }: { block: VariantBlock; options: BlockRenderOptions }) {
  return (
    <CarouselBlock02
      title={block.title}
      intro={block.intro}
      images={block.images ?? []}

      blockIndex={options.index}
      editSlots={options.editSlots}
      mediaResolver={options.mediaResolver}
      rootAttributes={providerBlockAttributes({ block, options }, VARIANT)}
    />
  )
}
