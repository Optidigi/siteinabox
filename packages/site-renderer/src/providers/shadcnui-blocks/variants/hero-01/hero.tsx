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
  // Upstream blob paths + linearGradients; CSS blur (not SVG gaussian filters)
  // so preview scroll does not eviction-flash GPU layers. Intentionally wider
  // than upstream and dual-tone via theme secondary accents.
  const reactId = React.useId().replace(/:/g, "")
  const paint0 = `hero01-paint0-${reactId}`
  const paint1 = `hero01-paint1-${reactId}`
  // stdDeviation 64 in a 1226-wide viewBox ≈ this blur at typical hero widths.
  // Extra horizontal scale spreads the dreamy wash without rewriting path data.
  const blobStyle: React.CSSProperties = {
    filter: "blur(64px)",
    transform: "translateZ(0) scale(1.58, 1.2)",
  }

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      {...rest}
    >
      <svg
        className="absolute inset-0 m-auto h-full w-full"
        fill="none"
        style={blobStyle}
        viewBox="0 0 1226 1065"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M291.402 416.77C291.402 346.77 244.735 285.603 221.402 263.77C111.902 141.27 448.902 207.27 636.402 359.77C823.902 512.27 618.902 613.27 448.902 740.27C278.902 867.27 291.402 504.27 291.402 416.77Z"
          fill={`url(#${paint0})`}
        />
        <defs>
          <linearGradient
            gradientUnits="userSpaceOnUse"
            id={paint0}
            x1="155.902"
            x2="592.902"
            y1="200.271"
            y2="696.271"
          >
            <stop stopColor="var(--provider-accent-600, #4b5563)" />
            <stop offset="1" stopColor="var(--provider-accent-300, #d1d5db)" />
          </linearGradient>
        </defs>
      </svg>
      <svg
        className="absolute inset-0 m-auto h-full w-full"
        fill="none"
        style={blobStyle}
        viewBox="0 0 1226 1065"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M811.933 441.279C881.694 435.492 938.793 383.929 958.623 358.87C1071.65 239.618 1033.74 580.921 897.259 780.386C760.781 979.851 643.18 783.902 502.561 624.983C361.942 466.063 724.733 448.512 811.933 441.279Z"
          fill={`url(#${paint1})`}
        />
        <defs>
          <linearGradient
            gradientUnits="userSpaceOnUse"
            id={paint1}
            x1="1016.49"
            x2="558.314"
            y1="288.346"
            y2="764.853"
          >
            <stop stopColor="var(--provider-accent-secondary-700, #4338ca)" />
            <stop offset="1" stopColor="var(--provider-accent-secondary-400, #818cf8)" />
          </linearGradient>
        </defs>
      </svg>
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
