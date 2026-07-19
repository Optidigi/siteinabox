// Owned typed adaptation of upstream shadcnui-blocks hero-03 (MIT, see ../../LICENSE).
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
import Navbar from "./navbar"

export type Hero03Props = TypedVariantBaseProps & {
  eyebrow?: RtRoot | null
  headline: RtRoot
  subheadline?: RtRoot | null
  cta?: LinkRef | null
  secondary?: LinkRef | null
  image?: MediaRef | null
  mediaResolver?: MediaResolver
  literalPreview?: boolean
}

export function Hero03({
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
}: Hero03Props & React.HTMLAttributes<HTMLDivElement>) {
  const primaryAction = renderHeroLink(editSlots, cta ?? {}, blockIndex, "cta", {
    trailingIcon: <ArrowUpRight className="h-5! w-5!" />,
  })
  const secondaryAction = renderHeroLink(editSlots, secondary ?? {}, blockIndex, "secondary", {
    leadingIcon: <CirclePlay className="h-5! w-5!" />,
  })
  const eyebrowContent = renderHeroEyebrow(editSlots, eyebrow, blockIndex)

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center px-6 pt-8 pb-16" {...rootAttributes} {...rest}>
      {literalPreview ? <Navbar /> : null}

      <div className="mt-16 max-w-3xl text-center">
        {eyebrowContent ? (
          <Badge asChild className="rounded-full border-border py-1" variant="secondary">
            <span>
              {eyebrowContent}
              <ArrowUpRight className="ml-1 size-4" />
            </span>
          </Badge>
        ) : null}
        <h1 className="mx-auto mt-6 max-w-xl font-medium text-4xl tracking-[-0.045em] sm:text-[2.75rem] md:text-6xl/[1.2]">
          {renderHeroHeadline(editSlots, headline, blockIndex)}
        </h1>
        {subheadline ? (
          <p className="mx-auto mt-6 max-w-2xl text-muted-foreground text-xl tracking-[-0.01em] md:text-2xl/normal">
            {renderHeroSubheadline(editSlots, subheadline, blockIndex)}
          </p>
        ) : null}
        {primaryAction || secondaryAction ? (
          <div className="mt-10 flex items-center justify-center gap-4">
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
      <div className="relative mx-auto mt-20 aspect-video w-full max-w-(--breakpoint-xl) rounded-xl bg-linear-to-br from-indigo-400/90 via-indigo-300 to-sky-400/80 p-2">
        {renderHeroImage(editSlots, mediaResolver, image, blockIndex, {
          className: "size-full rounded-lg bg-background",
          literalPreview,
        })}
        <div
          className="absolute inset-0 isolate z-0"
          style={{
            backgroundImage: `
        linear-gradient(to right, var(--border) 1px, transparent 1px),
        linear-gradient(to bottom, var(--border) 1px, transparent 1px)
      `,
            backgroundSize: "20px 20px",
            backgroundPosition: "0 0, 0 0",
            maskImage: `
       repeating-linear-gradient(
              to right,
              black 0px,
              black 3px,
              transparent 3px,
              transparent 8px
            ),
            repeating-linear-gradient(
              to bottom,
              black 0px,
              black 3px,
              transparent 3px,
              transparent 8px
            ),
          radial-gradient(ellipse 60% 60% at 50% 50%, #000 30%, transparent 70%)
      `,
            WebkitMaskImage: `
 repeating-linear-gradient(
              to right,
              black 0px,
              black 3px,
              transparent 3px,
              transparent 8px
            ),
            repeating-linear-gradient(
              to bottom,
              black 0px,
              black 3px,
              transparent 3px,
              transparent 8px
            ),
          radial-gradient(ellipse 60% 60% at 50% 50%, #000 30%, transparent 70%)
      `,
            maskComposite: "intersect",
            WebkitMaskComposite: "source-in",
          }}
        />
      </div>

      <div
        className="fixed inset-0 isolate -z-1 h-screen [--color-hero-bg:var(--color-indigo-600)] dark:[--color-hero-bg:var(--color-indigo-500)]"
        style={{
          background:
            "radial-gradient(125% 125% at 50% 10%, var(--color-background) 40%, var(--color-hero-bg) 100%)",
        }}
      />
    </div>
  )
}

export default function Hero03Literal() {
  return (
    <Hero03
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
