import * as React from "react"
import type { Block } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../../../../blocks/types"
import { providerBlockAttributes } from "../../runtime/block"
import type { TypedPilotId } from "../../typed/registry"
import { Blog05 } from "./blog"

type VariantBlock = Extract<Block, { blockType: "blogCards" }>

const VARIANT: TypedPilotId = "shadcnui-blocks.blog-05"

export default function View({ block, options }: { block: VariantBlock; options: BlockRenderOptions }) {
  return (
    <Blog05
      title={block.title}
      intro={block.intro}
      posts={block.posts ?? []}
      cta={block.cta}
      secondary={block.secondary}

      blockIndex={options.index}
      editSlots={options.editSlots}
      mediaResolver={options.mediaResolver}
      rootAttributes={providerBlockAttributes({ block, options }, VARIANT)}
    />
  )
}
