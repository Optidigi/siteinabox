// Owned typed adaptation of upstream shadcnui-blocks logo-cloud-09 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import type { MediaResolver } from "../../../../media"
import {
  type LogoCloudLogoItem,
  renderLogoCloudLogo,
  renderLogoCloudTitle,
  sliceLogoCloudLogos,
} from "../../typed/logo-cloud-fields"
import { logoCloudFamilyCmsLike } from "../../typed/fixtures/logo-cloud-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import { Logo01, Logo02, Logo03, Logo04, Logo05, Logo06, Logo07, Logo08 } from "../../runtime/logos"

const MAX_LOGOS = 8
const LOGO_CLASS = "h-7 sm:h-8"
const FALLBACK_LOGOS = [Logo01, Logo02, Logo03, Logo04, Logo05, Logo06, Logo07, Logo08] as const

export type LogoCloud09Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  logos: LogoCloudLogoItem[]
  mediaResolver?: MediaResolver
  literalPreview?: boolean
}

export function LogoCloud09({
  title,
  logos,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
  literalPreview = false,
}: LogoCloud09Props) {
  const titleContent = renderLogoCloudTitle(editSlots, title, blockIndex)
  const displayLogos = sliceLogoCloudLogos(logos, MAX_LOGOS)

  return (
    <div className="px-6 py-12" {...rootAttributes}>
      {titleContent ? (
        <p className="text-balance text-center font-medium text-foreground/80 text-lg">{titleContent}</p>
      ) : null}
      <div className="mx-auto mt-10 grid max-w-5xl grid-cols-2 place-items-center gap-x-4 gap-y-4 grayscale-100 sm:grid-cols-3 md:grid-cols-4">
        {Array.from({ length: MAX_LOGOS }, (_, itemIndex) => {
          const logo = displayLogos[itemIndex]
          const Fallback = FALLBACK_LOGOS[itemIndex]!
          return (
            <div className="flex w-full items-center justify-center rounded-xl bg-muted px-3 py-7" key={itemIndex}>
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
    </div>
  )
}

export default function LogoCloud09Literal() {
  return (
    <LogoCloud09
      title={logoCloudFamilyCmsLike.title}
      logos={logoCloudFamilyCmsLike.logos}
      blockIndex={0}
      literalPreview
    />
  )
}
