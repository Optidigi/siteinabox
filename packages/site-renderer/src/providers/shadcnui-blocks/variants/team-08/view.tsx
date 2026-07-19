import * as React from "react"
import type { Block } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../../../../blocks/types"
import { providerBlockAttributes } from "../../runtime/block"
import type { TypedPilotId } from "../../typed/registry"
import { Team08 } from "./team"
type VariantBlock = Extract<Block, { blockType: "team" }>
const VARIANT: TypedPilotId = "shadcnui-blocks.team-08"
export default function View({ block, options }: { block: VariantBlock; options: BlockRenderOptions }) {
  return (<Team08 title={block.title} intro={block.intro} members={block.members ?? []} blockIndex={options.index} editSlots={options.editSlots} mediaResolver={options.mediaResolver} rootAttributes={providerBlockAttributes({ block, options }, VARIANT)} />)
}