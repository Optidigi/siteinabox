// Owned typed adaptation of upstream shadcnui-blocks hero-05 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { LinkRef, MediaRef, RtRoot } from "@siteinabox/contracts"
import { ArrowUpRight, CirclePlay } from "lucide-react"
import { Badge } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import type { MediaResolver } from "../../../../media"
import {
  renderHeroEyebrow,
  renderHeroHeadline,
  renderHeroImage,
  renderHeroLink,
  renderHeroSubheadline,
} from "../../typed/hero-fields"
import { heroFamilyWithImage } from "../../typed/fixtures/hero-family"
import type { TypedVariantBaseProps } from "../../typed/props"

export type Hero05Props = TypedVariantBaseProps & {
  eyebrow?: RtRoot | null
  headline: RtRoot
  subheadline?: RtRoot | null
  cta?: LinkRef | null
  secondary?: LinkRef | null
  image?: MediaRef | null
  mediaResolver?: MediaResolver
  literalPreview?: boolean
}

export function Hero05({
  eyebrow,
  headline,
  subheadline,
  cta,
  secondary,
  image,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
  literalPreview = false,
  ...rest
}: Hero05Props & React.HTMLAttributes<HTMLDivElement>) {
  const primaryAction = renderHeroLink(editSlots, cta ?? {}, blockIndex, "cta", {
    trailingIcon: <ArrowUpRight className="h-5! w-5!" />,
  })
  const secondaryAction = renderHeroLink(editSlots, secondary ?? {}, blockIndex, "secondary", {
    leadingIcon: <CirclePlay className="h-5! w-5!" />,
  })
  const eyebrowContent = renderHeroEyebrow(editSlots, eyebrow, blockIndex)

  return (
    <div className="flex min-h-screen items-center justify-center overflow-hidden" {...rootAttributes} {...rest}>
      <div className="mx-auto grid w-full max-w-(--breakpoint-xl) gap-12 px-6 py-12 lg:grid-cols-2 lg:py-0">
        <div className="my-auto">
          {eyebrowContent ? (
            <Badge asChild className="rounded-full border-border py-1" variant="secondary">
              <span>
                {eyebrowContent}
                <ArrowUpRight className="ml-1 size-4" />
              </span>
            </Badge>
          ) : null}
          <h1 className="mt-6 max-w-[17ch] font-medium text-4xl leading-[1.2]! tracking-[-0.04em] md:text-5xl lg:text-[2.75rem] xl:text-[3.25rem]">
            {renderHeroHeadline(editSlots, headline, blockIndex)}
          </h1>
          {subheadline ? (
            <p className="mt-4 max-w-[60ch] text-foreground/60 text-lg sm:mt-6 sm:text-xl/normal">
              {renderHeroSubheadline(editSlots, subheadline, blockIndex)}
            </p>
          ) : null}
          {primaryAction || secondaryAction ? (
            <div className="mt-8 flex items-center gap-4 sm:mt-12">
              {primaryAction ? (
                <Button className="rounded-full" size="lg" asChild>
                  {primaryAction}
                </Button>
              ) : null}
              {secondaryAction ? (
                <Button className="rounded-full shadow-none" size="lg" variant="outline" asChild>
                  {secondaryAction}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        {renderHeroImage(editSlots, mediaResolver, image, blockIndex, {
          className: "aspect-video w-full rounded-xl bg-accent lg:aspect-auto lg:h-screen lg:w-[1000px] lg:rounded-none",
          literalPreview,
        })}
      </div>
    </div>
  )
}

export default function Hero05Literal() {
  return (
    <Hero05
      eyebrow={heroFamilyWithImage.eyebrow}
      headline={heroFamilyWithImage.headline}
      subheadline={heroFamilyWithImage.subheadline}
      cta={heroFamilyWithImage.cta}
      secondary={heroFamilyWithImage.secondary}
      blockIndex={0}
      literalPreview
    />
  )
}
