// Owned typed adaptation of upstream shadcnui-blocks hero-08 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { LinkRef, RtRoot } from "@siteinabox/contracts"
import { ArrowUpRight } from "lucide-react"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import type { MediaResolver } from "../../../../media"
import {
  type HeroLogoItem,
  renderHeroHeadline,
  renderHeroLink,
  renderHeroLogo,
  renderHeroSubheadline,
  renderHeroTrustLabel,
} from "../../typed/hero-fields"
import { hero08FamilyCmsLike } from "../../typed/fixtures/hero-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import { Logo01, Logo02, Logo03, Logo04 } from "./logos"
import Navbar from "./navbar"

const LOGO_CLASS = "h-7 sm:h-8"
const FALLBACK_LOGOS = [Logo01, Logo02, Logo03, Logo04] as const
const MAX_LOGOS = 4

export type Hero08Props = TypedVariantBaseProps & {
  headline: RtRoot
  subheadline?: RtRoot | null
  cta?: LinkRef | null
  secondary?: LinkRef | null
  trustLabel?: string | null
  logos?: HeroLogoItem[] | null
  mediaResolver?: MediaResolver
  literalPreview?: boolean
}

export function Hero08({
  headline,
  subheadline,
  cta,
  secondary,
  trustLabel,
  logos,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
  literalPreview = false,
  ...rest
}: Hero08Props & React.HTMLAttributes<HTMLDivElement>) {
  const primaryAction = renderHeroLink(editSlots, cta ?? {}, blockIndex, "cta", {
    trailingIcon: <ArrowUpRight />,
  })
  const secondaryAction = renderHeroLink(editSlots, secondary ?? {}, blockIndex, "secondary")
  const trustLabelContent = renderHeroTrustLabel(editSlots, trustLabel, blockIndex)
  const displayLogos = (logos ?? []).slice(0, MAX_LOGOS)

  return (
    <div {...rootAttributes} {...rest}>
      {literalPreview ? <Navbar /> : null}

      <div className="mx-auto flex max-w-5xl flex-col items-center px-6 py-12 text-center">
        <h2 className="text-balance font-medium text-4xl leading-[1.4] tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
          {renderHeroHeadline(editSlots, headline, blockIndex)}
        </h2>
        {subheadline ? (
          <p className="mt-6 text-balance text-center text-muted-foreground text-xl tracking-[-0.01em] sm:text-2xl sm:leading-normal md:text-3xl">
            {renderHeroSubheadline(editSlots, subheadline, blockIndex)}
          </p>
        ) : null}
        {primaryAction || secondaryAction ? (
          <div className="mx-auto mt-10 flex w-full max-w-xs flex-col items-center justify-center gap-4 sm:flex-row">
            {primaryAction ? (
              <Button className="w-full sm:w-auto" size="lg" asChild>
                {primaryAction}
              </Button>
            ) : null}
            {secondaryAction ? (
              <Button className="w-full sm:w-auto" size="lg" variant="outline" asChild>
                {secondaryAction}
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="mt-24 flex flex-col items-center gap-4">
          {trustLabelContent ? (
            <p className="font-medium text-muted-foreground text-sm uppercase">{trustLabelContent}</p>
          ) : null}
          <div className="mx-auto mt-4 grid max-w-5xl grid-cols-2 place-items-center gap-6 text-foreground/70 sm:grid-cols-3 sm:gap-x-10 sm:gap-y-12 md:grid-cols-4">
            {literalPreview
              ? FALLBACK_LOGOS.map((Logo, itemIndex) => (
                  <Logo className={LOGO_CLASS} key={itemIndex} />
                ))
              : displayLogos.map((logo, itemIndex) => (
                  <React.Fragment key={itemIndex}>
                    {renderHeroLogo(logo, itemIndex, blockIndex, editSlots, mediaResolver, {
                      className: LOGO_CLASS,
                      fallback: null,
                    })}
                  </React.Fragment>
                ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Hero08Literal() {
  return (
    <Hero08
      headline={hero08FamilyCmsLike.headline}
      subheadline={hero08FamilyCmsLike.subheadline}
      cta={hero08FamilyCmsLike.cta}
      secondary={hero08FamilyCmsLike.secondary}
      trustLabel={hero08FamilyCmsLike.trustLabel}
      logos={hero08FamilyCmsLike.logos}
      blockIndex={0}
      literalPreview
    />
  )
}
