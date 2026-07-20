import * as React from "react"
import type { Block } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../../../../blocks/types"
import { providerBlockAttributes } from "../../runtime/block"
import type { TypedPilotId } from "../../typed/registry"
import { Hero08 } from "./hero"

type VariantBlock = Extract<Block, { blockType: "hero" }>

const VARIANT: TypedPilotId = "shadcnui-blocks.hero-08"

export default function View({ block, options }: { block: VariantBlock; options: BlockRenderOptions }) {
  return (
    <Hero08
      headline={block.headline}
      subheadline={block.subheadline}
      cta={block.cta}
      secondary={block.secondary}
      trustLabel={block.trustLabel}
      logos={block.logos ?? []}
      blockIndex={options.index}
      editSlots={options.editSlots}
      mediaResolver={options.mediaResolver}
      rootAttributes={providerBlockAttributes({ block, options }, VARIANT)}
    />
  )
}
