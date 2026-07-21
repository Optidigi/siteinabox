// Owned typed adaptation of upstream shadcnui-blocks cta-04 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { LinkRef, MediaRef, RtRoot } from "@siteinabox/contracts"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import type { MediaResolver } from "../../../../media"
import { ArrowUpRight } from "lucide-react"
import { renderCtaLink } from "../../typed/actions"
import { cta04Literal } from "../../typed/fixtures/cta-family"
import { providerCircuitBoardStyle } from "../../typed/grid-pattern"
import { renderBackgroundImage } from "../../typed/images"
import type { TypedVariantBaseProps } from "../../typed/props"
import { fieldInlineRichText } from "../../typed/rich-text"

const BLOCK_TYPE = "cta" as const
/** Packaged phone illustration for empty media / literal preview. */
const BACKGROUND_FALLBACK = "/images/cta-mobile.png"

export type Cta04Props = TypedVariantBaseProps & {
  headline: RtRoot
  description?: RtRoot | null
  primary?: LinkRef | null
  backgroundImage?: MediaRef | null
  mediaResolver?: MediaResolver
  literalPreview?: boolean
}

export function Cta04({
  headline,
  description,
  primary,
  backgroundImage,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
  literalPreview = false,
}: Cta04Props) {
  const primaryAction = renderCtaLink(editSlots, primary ?? {}, blockIndex, BLOCK_TYPE, "primary", {
    trailingIcon: <ArrowUpRight />,
  })

  return (
    <div className="px-0 py-16 sm:px-6" {...rootAttributes}>
      <div className="mx-auto max-w-5xl border-y bg-muted/50 p-1 sm:rounded-xl sm:border-x border-border">
        <div className="sm:shadow/5 relative flex flex-col justify-between gap-0 overflow-hidden border bg-background px-10 sm:rounded-lg md:flex-row md:gap-8 border-border">
          <div
            className="max-sm:mask-b-from-75% pointer-events-none absolute inset-0 -top-0.5 -left-1 z-0 not-dark:opacity-60"
            style={providerCircuitBoardStyle}
          />
          <div className="relative isolate pt-12 pb-0 md:pb-12">
            <h2 className="font-medium text-4xl tracking-[-0.04em] lg:text-5xl/[1.2]">
              {fieldInlineRichText(editSlots, BLOCK_TYPE, "headline", headline, blockIndex)}
            </h2>
            {description ? (
              <p className="mt-2 text-muted-foreground text-xl tracking-[-0.015em] sm:mt-4 lg:text-2xl">
                {fieldInlineRichText(editSlots, BLOCK_TYPE, "description", description, blockIndex)}
              </p>
            ) : null}
            {primaryAction ? (
              <Button className="mt-5 sm:mt-10" size="lg" asChild>
                {primaryAction}
              </Button>
            ) : null}
          </div>
          {renderBackgroundImage(editSlots, mediaResolver, backgroundImage, blockIndex, BLOCK_TYPE, {
            alt: "",
            className:
              "mask-b-from-75% relative isolate mt-auto aspect-square w-full max-w-xs object-cover object-center md:h-76 md:w-auto md:max-w-none",
            fallbackSrc: BACKGROUND_FALLBACK,
            emptyFallback: true,
            literalPreview,
          })}
        </div>
      </div>
    </div>
  )
}

export default function Cta04Literal() {
  return (
    <Cta04
      headline={cta04Literal.headline}
      description={cta04Literal.description}
      primary={cta04Literal.primary}
      blockIndex={0}
      literalPreview
    />
  )
}
