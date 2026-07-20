// Owned typed adaptation of upstream shadcnui-blocks logo-cloud-10 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import { cn } from "@siteinabox/ui/lib/utils"
import type { MediaResolver } from "../../../../media"
import {
  type LogoCloudLogoItem,
  renderLogoCloudLogo,
  renderLogoCloudTitle,
  sliceLogoCloudLogos,
} from "../../typed/logo-cloud-fields"
import { logoCloud10Literal, logoCloudFamilyCmsLike } from "../../typed/fixtures/logo-cloud-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import { Logo01, Logo02, Logo03, Logo04, Logo05, Logo06 } from "../../runtime/logos"

const MAX_LOGOS = 6
const LOGO_CLASS = "h-7 sm:h-8"
const FALLBACK_LOGOS = [Logo01, Logo02, Logo03, Logo04, Logo05, Logo06] as const

export type LogoCloud10Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  logos: LogoCloudLogoItem[]
  mediaResolver?: MediaResolver
  literalPreview?: boolean
}

export function LogoCloud10({
  title,
  logos,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
  literalPreview = false,
}: LogoCloud10Props) {
  const titleContent = renderLogoCloudTitle(editSlots, title, blockIndex)
  const displayLogos = sliceLogoCloudLogos(logos, MAX_LOGOS)

  return (
    <div className="px-6 py-12 sm:px-12" {...rootAttributes}>
      {titleContent ? (
        <p className="text-balance text-center font-medium text-foreground/80 text-lg">{titleContent}</p>
      ) : null}
      <div className="relative mx-auto mt-10 max-w-4xl">
        <div
          className={cn(
            "grid grid-cols-2 place-items-center border shadow-xs/1 sm:grid-cols-3 border-border",
            "*:border-e *:border-b *:nth-last-[2]:border-b-0 *:last:border-b-0 *:odd:bg-muted/60 max-sm:*:nth-[2n]:border-e-0 sm:*:nth-[3n]:border-e-0 sm:*:nth-last-[3]:border-b-0 border-border",
          )}
        >
          {Array.from({ length: MAX_LOGOS }, (_, itemIndex) => {
            const logo = displayLogos[itemIndex]
            const Fallback = FALLBACK_LOGOS[itemIndex]!
            return (
              <div className="flex w-full items-center justify-center px-3 py-7" key={itemIndex}>
                {literalPreview ? (
                  <Fallback className={LOGO_CLASS} />
                ) : logo ? (
                  renderLogoCloudLogo(logo, itemIndex, blockIndex, editSlots, mediaResolver, {
                    className: LOGO_CLASS,
                  })
                ) : null}
              </div>
            )
          })}
        </div>

        <div className="mask-l-from-0 absolute top-0 left-0 w-6 -translate-x-full border-b border-dashed sm:w-12 border-border" />
        <div className="mask-r-from-0 absolute top-0 right-0 w-6 translate-x-full border-b border-dashed sm:w-12 border-border" />
        <div className="mask-l-from-0 absolute bottom-0 left-0 w-6 -translate-x-full border-b border-dashed sm:w-12 border-border" />
        <div className="mask-r-from-0 absolute right-0 bottom-0 w-6 translate-x-full border-b border-dashed sm:w-12 border-border" />
        <div className="mask-t-from-0 absolute top-0 left-0 h-6 -translate-y-full border-s border-dashed sm:h-12 border-border" />
        <div className="mask-t-from-0 absolute top-0 right-0 h-6 -translate-y-full border-s border-dashed sm:h-12 border-border" />
        <div className="mask-b-from-0 absolute bottom-0 left-0 h-6 translate-y-full border-s border-dashed sm:h-12 border-border" />
        <div className="mask-b-from-0 absolute right-0 bottom-0 h-6 translate-y-full border-s border-dashed sm:h-12 border-border" />
      </div>
    </div>
  )
}

export default function LogoCloud10Literal() {
  return (
    <LogoCloud10
      title={logoCloud10Literal.title}
      logos={logoCloudFamilyCmsLike.logos}
      blockIndex={0}
      literalPreview
    />
  )
}
