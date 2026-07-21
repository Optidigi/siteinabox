// Owned typed adaptation of upstream shadcnui-blocks cta-03 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { LinkRef, MediaRef, RtRoot } from "@siteinabox/contracts"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import type { MediaResolver } from "../../../../media"
import { ArrowUpRight } from "lucide-react"
import { renderCtaLink } from "../../typed/actions"
import { cta03Literal } from "../../typed/fixtures/cta-family"
import { renderBackgroundImage } from "../../typed/images"
import type { TypedVariantBaseProps } from "../../typed/props"
import { fieldInlineRichText } from "../../typed/rich-text"

const BLOCK_TYPE = "cta" as const
/** Packaged phone illustration for empty media / literal preview. */
const BACKGROUND_FALLBACK = "/images/cta-mobile.png"

export type Cta03Props = TypedVariantBaseProps & {
  headline: RtRoot
  description?: RtRoot | null
  primary?: LinkRef | null
  backgroundImage?: MediaRef | null
  mediaResolver?: MediaResolver
  literalPreview?: boolean
}

export function Cta03({
  headline,
  description,
  primary,
  backgroundImage,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
  literalPreview = false,
}: Cta03Props) {
  const primaryAction = renderCtaLink(editSlots, primary ?? {}, blockIndex, BLOCK_TYPE, "primary", {
    trailingIcon: <ArrowUpRight />,
  })

  return (
    <div className="px-0 py-16 sm:px-6" {...rootAttributes}>
      <div className="relative mx-auto flex max-w-5xl flex-col justify-between gap-0 overflow-hidden bg-linear-to-r from-muted px-10 ring-2 ring-border/60 sm:rounded-xl sm:shadow-lg/4 md:flex-row md:gap-8">
        <div className="pt-14 pb-0 md:pb-14">
          <h2 className="font-medium text-4xl tracking-[-0.04em] lg:text-[2.75rem]">
            {fieldInlineRichText(editSlots, BLOCK_TYPE, "headline", headline, blockIndex)}
          </h2>
          {description ? (
            <p className="mt-4 max-w-md text-muted-foreground text-xl/normal tracking-[-0.015em] lg:text-2xl/normal">
              {fieldInlineRichText(editSlots, BLOCK_TYPE, "description", description, blockIndex)}
            </p>
          ) : null}
          {primaryAction ? (
            <Button className="mt-10" size="lg" asChild>
              {primaryAction}
            </Button>
          ) : null}
        </div>
        {renderBackgroundImage(editSlots, mediaResolver, backgroundImage, blockIndex, BLOCK_TYPE, {
          alt: "",
          className:
            "mt-auto aspect-square w-full max-w-xs object-cover object-center md:h-72 md:w-auto md:max-w-none",
          fallbackSrc: BACKGROUND_FALLBACK,
          emptyFallback: true,
          literalPreview,
        })}
      </div>
    </div>
  )
}

export default function Cta03Literal() {
  return (
    <Cta03
      headline={cta03Literal.headline}
      description={cta03Literal.description}
      primary={cta03Literal.primary}
      blockIndex={0}
      literalPreview
    />
  )
}
