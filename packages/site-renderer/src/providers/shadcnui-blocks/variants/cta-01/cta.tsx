// Owned typed adaptation of upstream shadcnui-blocks cta-01 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { LinkRef, RtRoot } from "@siteinabox/contracts"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import type { BlockEditSlots } from "../../../../blocks/types"
import { renderCtaLink } from "../../typed/actions"
import { cta01Literal } from "../../typed/fixtures/cta-01"
import type { TypedVariantBaseProps } from "../../typed/props"
import { fieldInlineRichText } from "../../typed/rich-text"

const BLOCK_TYPE = "cta" as const

export type Cta01Props = TypedVariantBaseProps & {
  headline: RtRoot
  description?: RtRoot | null
  primary?: LinkRef | null
}

export function Cta01({ headline, description, primary, blockIndex, editSlots, rootAttributes }: Cta01Props) {
  const primaryAction = renderCtaLink(editSlots, primary ?? {}, blockIndex, BLOCK_TYPE, "primary")

  return (
    <div className="px-0 py-20 sm:px-6" {...rootAttributes}>
      <div className="relative flex w-full flex-col items-center justify-center py-16">
        <h2 className="font-medium text-5xl tracking-tighter">
          {fieldInlineRichText(editSlots, BLOCK_TYPE, "headline", headline, blockIndex)}
        </h2>
        {description ? (
          <p className="mx-auto mt-6 max-w-xl text-center text-muted-foreground text-xl/normal">
            {fieldInlineRichText(editSlots, BLOCK_TYPE, "description", description, blockIndex)}
          </p>
        ) : null}
        {primaryAction ? (
          <Button className="mt-8" asChild>
            {primaryAction}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export default function Cta01Literal() {
  return (
    <Cta01
      headline={cta01Literal.headline}
      description={cta01Literal.description}
      primary={cta01Literal.primary}
      blockIndex={0}
    />
  )
}
