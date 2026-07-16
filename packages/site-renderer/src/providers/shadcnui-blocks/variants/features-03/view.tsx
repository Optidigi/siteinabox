import * as React from "react"
import type { Block } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../../../../blocks/types"
import { ShadcnUiStaticFeaturesView } from "../../feature-views"
type VariantBlock = Extract<Block, { blockType: "featureList" }>
export default function View({ block, options }: { block: VariantBlock; options: BlockRenderOptions }) { return <ShadcnUiStaticFeaturesView block={block} options={options} variant="shadcnui-blocks.features-03" /> }
