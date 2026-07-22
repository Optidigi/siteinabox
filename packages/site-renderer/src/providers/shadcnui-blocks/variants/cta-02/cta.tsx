// Owned typed adaptation of upstream shadcnui-blocks cta-02 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { LinkRef, MediaRef, RtRoot } from "@siteinabox/contracts"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import type { MediaResolver } from "../../../../media"
import { ArrowUpRight } from "lucide-react"
import { renderCtaLink } from "../../typed/actions"
import { cta02Literal } from "../../typed/fixtures/cta-family"
import { renderBackgroundImage } from "../../typed/images"
import type { TypedVariantBaseProps } from "../../typed/props"
import { fieldInlineRichText } from "../../typed/rich-text"

const BLOCK_TYPE = "cta" as const
const BACKGROUND_FALLBACK = "/images/ascii-art.png"

export type Cta02Props = TypedVariantBaseProps & {
  headline: RtRoot
  description?: RtRoot | null
  primary?: LinkRef | null
  backgroundImage?: MediaRef | null
  mediaResolver?: MediaResolver
  literalPreview?: boolean
}

export function Cta02({
  headline,
  description,
  primary,
  backgroundImage,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
  literalPreview = false,
}: Cta02Props) {
  const primaryAction = renderCtaLink(editSlots, primary ?? {}, blockIndex, BLOCK_TYPE, "primary", {
    trailingIcon: <ArrowUpRight />,
  })

  return (
    <div className="px-0 py-20 sm:px-6" {...rootAttributes}>
      <div className="relative mx-auto max-w-5xl overflow-hidden sm:rounded-xl sm:shadow-lg dark:border dark:border-border/80">
        {renderBackgroundImage(editSlots, mediaResolver, backgroundImage, blockIndex, BLOCK_TYPE, {
          alt: "",
          className: "absolute inset-0 size-full object-cover",
          fallbackSrc: BACKGROUND_FALLBACK,
          literalPreview,
        })}
        <div className="pointer-events-none relative isolate bg-linear-to-r from-black to-black/50 px-10 py-14">
          <h2 className="pointer-events-auto font-medium text-4xl text-white tracking-[-0.04em] sm:text-[2.85rem]">
            {fieldInlineRichText(editSlots, BLOCK_TYPE, "headline", headline, blockIndex)}
          </h2>
          {description ? (
            <p className="pointer-events-auto mt-4 max-w-md text-lg text-white/85 md:text-xl/normal">
              {fieldInlineRichText(editSlots, BLOCK_TYPE, "description", description, blockIndex)}
            </p>
          ) : null}
          {primaryAction ? (
            <Button
              className="pointer-events-auto mt-10 bg-white text-black ring-4 ring-white/30 hover:bg-white/90"
              size="lg"
              asChild
            >
              {primaryAction}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function Cta02Literal() {
  return (
    <Cta02
      headline={cta02Literal.headline}
      description={cta02Literal.description}
      primary={cta02Literal.primary}
      blockIndex={0}
      literalPreview
    />
  )
}
