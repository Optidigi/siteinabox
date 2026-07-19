// Owned typed adaptation of upstream shadcnui-blocks hero-06 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { LinkRef, RtRoot } from "@siteinabox/contracts"
import { ArrowUpRight, CirclePlay } from "lucide-react"
import { Badge } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import {
  renderHeroEyebrow,
  renderHeroHeadline,
  renderHeroLink,
  renderHeroSubheadline,
} from "../../typed/hero-fields"
import { heroFamilyCmsLike } from "../../typed/fixtures/hero-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import { BackgroundPattern } from "./background-pattern"

export type Hero06Props = TypedVariantBaseProps & {
  eyebrow?: RtRoot | null
  headline: RtRoot
  subheadline?: RtRoot | null
  cta?: LinkRef | null
  secondary?: LinkRef | null
}

export function Hero06({
  eyebrow,
  headline,
  subheadline,
  cta,
  secondary,
  blockIndex,
  editSlots,
  rootAttributes,
  ...rest
}: Hero06Props & React.HTMLAttributes<HTMLDivElement>) {
  const primaryAction = renderHeroLink(editSlots, cta ?? {}, blockIndex, "cta", {
    trailingIcon: <ArrowUpRight className="h-5! w-5!" />,
  })
  const secondaryAction = renderHeroLink(editSlots, secondary ?? {}, blockIndex, "secondary", {
    leadingIcon: <CirclePlay className="h-5! w-5!" />,
  })
  const eyebrowContent = renderHeroEyebrow(editSlots, eyebrow, blockIndex)

  return (
    <div className="flex min-h-screen items-center justify-center px-6" {...rootAttributes} {...rest}>
      <BackgroundPattern />
      <div className="relative z-10 max-w-3xl text-center">
        {eyebrowContent ? (
          <Badge asChild className="rounded-full border-border py-1" variant="secondary">
            <span>
              {eyebrowContent}
              <ArrowUpRight className="ml-1 size-4" />
            </span>
          </Badge>
        ) : null}
        <h1 className="mx-auto mt-6 max-w-xl font-medium text-4xl tracking-[-0.04em] sm:text-[2.75rem] md:text-6xl/[1.2]">
          {renderHeroHeadline(editSlots, headline, blockIndex)}
        </h1>
        {subheadline ? (
          <p className="mx-auto mt-6 max-w-2xl text-muted-foreground text-xl md:text-2xl/normal">
            {renderHeroSubheadline(editSlots, subheadline, blockIndex)}
          </p>
        ) : null}
        {primaryAction || secondaryAction ? (
          <div className="mt-12 flex items-center justify-center gap-4">
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
    </div>
  )
}

export default function Hero06Literal() {
  return (
    <Hero06
      eyebrow={heroFamilyCmsLike.eyebrow}
      headline={heroFamilyCmsLike.headline}
      subheadline={heroFamilyCmsLike.subheadline}
      cta={heroFamilyCmsLike.cta}
      secondary={heroFamilyCmsLike.secondary}
      blockIndex={0}
    />
  )
}
