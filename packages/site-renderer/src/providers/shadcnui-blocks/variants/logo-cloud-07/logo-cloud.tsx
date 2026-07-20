// Owned typed adaptation of upstream shadcnui-blocks logo-cloud-07 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import { Marquee } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import type { MediaResolver } from "../../../../media"
import {
  type LogoCloudLogoItem,
  renderLogoCloudLogo,
  renderLogoCloudTitle,
  sliceLogoCloudLogos,
} from "../../typed/logo-cloud-fields"
import { logoCloud07Literal, logoCloudFamilyCmsLike } from "../../typed/fixtures/logo-cloud-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import { Logo01, Logo02, Logo03, Logo04, Logo05, Logo06, Logo07, Logo08 } from "../../runtime/logos"

const MAX_LOGOS = 8
const LOGO_CLASS = "h-10"
const FALLBACK_LOGOS = [Logo01, Logo02, Logo03, Logo04, Logo05, Logo06, Logo07, Logo08] as const

const renderMarqueeLogos = (
  logos: LogoCloudLogoItem[],
  blockIndex: number,
  editSlots: LogoCloud07Props["editSlots"],
  mediaResolver: MediaResolver | undefined,
  literalPreview: boolean,
  reverse = false,
) => {
  const displayLogos = sliceLogoCloudLogos(logos, MAX_LOGOS)
  const ordered = reverse ? [...displayLogos].reverse() : displayLogos
  const orderedFallback = reverse ? [...FALLBACK_LOGOS].reverse() : FALLBACK_LOGOS

  return (
    <Marquee
      className="mask-x-from-75% [--duration:40s] *:h-10 [&_svg]:mr-10"
      pauseOnHover
      reverse={reverse}
    >
      {literalPreview
        ? orderedFallback.map((Logo, itemIndex) => <Logo className={LOGO_CLASS} key={itemIndex} />)
        : ordered.map((logo, itemIndex) => {
            const sourceIndex = reverse ? displayLogos.length - 1 - itemIndex : itemIndex
            return (
              <React.Fragment key={itemIndex}>
                {renderLogoCloudLogo(logo, sourceIndex, blockIndex, editSlots, mediaResolver, {
                  className: LOGO_CLASS,
                })}
              </React.Fragment>
            )
          })}
    </Marquee>
  )
}

export type LogoCloud07Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  logos: LogoCloudLogoItem[]
  mediaResolver?: MediaResolver
  literalPreview?: boolean
}

export function LogoCloud07({
  title,
  logos,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
  literalPreview = false,
}: LogoCloud07Props) {
  const titleContent = renderLogoCloudTitle(editSlots, title, blockIndex)

  return (
    <div className="flex min-h-screen items-center justify-center px-6" {...rootAttributes}>
      <div className="overflow-hidden">
        {titleContent ? (
          <p className="text-center font-medium text-foreground/80 text-xl">{titleContent}</p>
        ) : null}
        <div className="mt-14 max-w-(--breakpoint-lg) space-y-8">
          {renderMarqueeLogos(logos, blockIndex, editSlots, mediaResolver, literalPreview)}
          {renderMarqueeLogos(logos, blockIndex, editSlots, mediaResolver, literalPreview, true)}
        </div>
      </div>
    </div>
  )
}

export default function LogoCloud07Literal() {
  return (
    <LogoCloud07
      title={logoCloud07Literal.title}
      logos={logoCloudFamilyCmsLike.logos}
      blockIndex={0}
      literalPreview
    />
  )
}
