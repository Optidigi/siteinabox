import * as React from "react"
import type { Block } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../../../../blocks/types"
import { ShadcnUiContactView } from "../../contact-views"
type VariantBlock = Extract<Block, { blockType: "contactSection" }>
export default function View({ block, options }: { block: VariantBlock; options: BlockRenderOptions }) { return <ShadcnUiContactView block={block} options={options} variant="shadcnui-blocks.contact-02" /> }
