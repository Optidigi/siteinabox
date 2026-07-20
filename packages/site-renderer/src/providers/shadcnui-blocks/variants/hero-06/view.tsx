import * as React from "react"
import type { Block } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../../../../blocks/types"
import { providerBlockAttributes } from "../../runtime/block"
import type { TypedPilotId } from "../../typed/registry"
import { Hero06 } from "./hero"

type VariantBlock = Extract<Block, { blockType: "hero" }>

const VARIANT: TypedPilotId = "shadcnui-blocks.hero-06"

export default function View({ block, options }: { block: VariantBlock; options: BlockRenderOptions }) {
  return (
    <Hero06
      eyebrow={block.eyebrow}
      headline={block.headline}
      subheadline={block.subheadline}
      cta={block.cta}
      secondary={block.secondary}
      blockIndex={options.index}
      editSlots={options.editSlots}
      rootAttributes={providerBlockAttributes({ block, options }, VARIANT)}
    />
  )
}
