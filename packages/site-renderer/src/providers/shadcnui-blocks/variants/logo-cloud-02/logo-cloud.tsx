// Owned typed adaptation of upstream shadcnui-blocks logo-cloud-02 (MIT, see ../../LICENSE).
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
const LOGO_CLASS = "h-10"
const FALLBACK_LOGOS = [Logo01, Logo02, Logo03, Logo04, Logo05, Logo06, Logo07, Logo08] as const

export type LogoCloud02Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  logos: LogoCloudLogoItem[]
  mediaResolver?: MediaResolver
  literalPreview?: boolean
}

export function LogoCloud02({
  title,
  logos,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
  literalPreview = false,
}: LogoCloud02Props) {
  const titleContent = renderLogoCloudTitle(editSlots, title, blockIndex)
  const displayLogos = sliceLogoCloudLogos(logos, MAX_LOGOS)

  return (
    <div className="flex min-h-screen items-center justify-center px-6" {...rootAttributes}>
      <div>
        {titleContent ? <p className="text-center text-xl">{titleContent}</p> : null}
        <div className="mt-20 flex max-w-(--breakpoint-lg) flex-wrap items-center justify-center gap-x-14 gap-y-12 *:h-10">
          {literalPreview
            ? FALLBACK_LOGOS.map((Logo, itemIndex) => <Logo className={LOGO_CLASS} key={itemIndex} />)
            : displayLogos.map((logo, itemIndex) => (
                <React.Fragment key={itemIndex}>
                  {renderLogoCloudLogo(logo, itemIndex, blockIndex, editSlots, mediaResolver, {
                    className: LOGO_CLASS,
                  })}
                </React.Fragment>
              ))}
        </div>
      </div>
    </div>
  )
}

export default function LogoCloud02Literal() {
  return (
    <LogoCloud02
      title={logoCloudFamilyCmsLike.title}
      logos={logoCloudFamilyCmsLike.logos}
      blockIndex={0}
      literalPreview
    />
  )
}
