import * as React from "react"
import type { Block } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../../../../blocks/types"
import Literal from "./pricing"
import { LiteralProviderVariantView } from "../../runtime/literal-view"
type VariantBlock = Extract<Block, { blockType: "pricing" }>
export default function View({ block, options }: { block: VariantBlock; options: BlockRenderOptions }) { return <LiteralProviderVariantView Literal={Literal} model={{ block, options }} variant="shadcnui-blocks.pricing-02" /> }
