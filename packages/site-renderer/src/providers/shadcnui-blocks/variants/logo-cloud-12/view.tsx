import * as React from "react"
import type { Block } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../../../../blocks/types"
import Literal from "./logo-cloud"
import { LiteralProviderVariantView } from "../../runtime/literal-view"
type VariantBlock = Extract<Block, { blockType: "logoCloud" }>
export default function View({ block, options }: { block: VariantBlock; options: BlockRenderOptions }) { return <LiteralProviderVariantView Literal={Literal} model={{ block, options }} variant="shadcnui-blocks.logo-cloud-12" /> }
