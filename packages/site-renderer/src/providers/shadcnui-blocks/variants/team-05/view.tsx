import * as React from "react"
import type { Block } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../../../../blocks/types"
import Literal from "./team"
import { LiteralProviderVariantView } from "../../runtime/literal-view"
type VariantBlock = Extract<Block, { blockType: "team" }>
export default function View({ block, options }: { block: VariantBlock; options: BlockRenderOptions }) { return <LiteralProviderVariantView Literal={Literal} model={{ block, options }} variant="shadcnui-blocks.team-05" /> }
