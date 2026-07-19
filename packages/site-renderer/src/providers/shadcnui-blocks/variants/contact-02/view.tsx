import * as React from "react"
import type { Block } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "../../../../blocks/types"
import { providerBlockAttributes } from "../../runtime/block"
import type { TypedPilotId } from "../../typed/registry"
import { Contact02 } from "./contact"

type VariantBlock = Extract<Block, { blockType: "contactSection" }>

const VARIANT: TypedPilotId = "shadcnui-blocks.contact-02"

export default function View({ block, options }: { block: VariantBlock; options: BlockRenderOptions }) {
  return (
    <Contact02
      title={block.title}
      description={block.description}
      formName={block.formName}
      submitLabel={block.submitLabel}
      fields={block.fields}
      formAction={options.formAction}
      siteSettings={options.siteSettings}
      blockIndex={options.index}
      editSlots={options.editSlots}
      rootAttributes={providerBlockAttributes({ block, options }, VARIANT)}
    />
  )
}
