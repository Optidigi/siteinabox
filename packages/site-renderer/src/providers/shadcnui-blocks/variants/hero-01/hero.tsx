// Owned typed adaptation of upstream shadcnui-blocks hero-01 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { LinkRef, RtRoot } from "@siteinabox/contracts"
import { ArrowUpRight, CirclePlay } from "lucide-react"
import { Badge } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { cn } from "@siteinabox/ui/lib/utils"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import {
  renderHeroEyebrow,
  renderHeroHeadline,
  renderHeroLink,
  renderHeroSubheadline,
} from "../../typed/hero-fields"
import { heroFamilyCmsLike } from "../../typed/fixtures/hero-family"
import type { TypedVariantBaseProps } from "../../typed/props"

export type Hero01Props = TypedVariantBaseProps & {
  eyebrow?: RtRoot | null
  headline: RtRoot
  subheadline?: RtRoot | null
  cta?: LinkRef | null
  secondary?: LinkRef | null
}

export function Hero01({
  eyebrow,
  headline,
  subheadline,
  cta,
  secondary,
  blockIndex,
  editSlots,
  rootAttributes,
  ...rest
}: Hero01Props & React.HTMLAttributes<HTMLDivElement>) {
  const eyebrowContent = renderHeroEyebrow(editSlots, eyebrow, blockIndex)
  const primaryAction = renderHeroLink(editSlots, cta ?? {}, blockIndex, "cta", {
    trailingIcon: <ArrowUpRight className="size-5" />,
  })
  const secondaryAction = renderHeroLink(editSlots, secondary ?? {}, blockIndex, "secondary", {
    leadingIcon: <CirclePlay className="size-5" />,
  })

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6" {...rootAttributes} {...rest}>
      <DreamyBackground className="absolute inset-0 m-auto" />
      <div className="relative isolate max-w-3xl text-center">
        {eyebrowContent ? (
          <Badge asChild className="rounded-full bg-background/30 py-1 backdrop-blur-lg" variant="secondary">
            <span>
              {eyebrowContent}
              <ArrowUpRight className="ml-1 size-4" />
            </span>
          </Badge>
        ) : null}
        <h1 className="mx-auto mt-6 max-w-xl font-medium text-4xl tracking-tighter sm:text-[2.75rem] md:text-6xl/[1.2]">
          {renderHeroHeadline(editSlots, headline, blockIndex)}
        </h1>
        {subheadline ? (
          <p className="mx-auto mt-6 max-w-2xl text-foreground/70 text-xl md:text-2xl/normal">
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

function DreamyBackground({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      {...rest}
    >
      <div className="absolute left-[5%] top-[10%] h-[85%] w-[70%] bg-[radial-gradient(ellipse_at_35%_45%,var(--provider-accent-600,#5E8778)_0%,var(--provider-accent-300,#78FF86)_42%,transparent_68%)]" />
      <div className="absolute right-[-5%] top-[15%] h-[80%] w-[65%] bg-[radial-gradient(ellipse_at_60%_50%,var(--provider-accent-700,#575EFF)_0%,var(--provider-accent-400,#E478FF)_48%,transparent_70%)]" />
    </div>
  )
}

export default function Hero01Literal() {
  return (
    <Hero01
      eyebrow={heroFamilyCmsLike.eyebrow}
      headline={heroFamilyCmsLike.headline}
      subheadline={heroFamilyCmsLike.subheadline}
      cta={heroFamilyCmsLike.cta}
      secondary={heroFamilyCmsLike.secondary}
      blockIndex={0}
    />
  )
}
