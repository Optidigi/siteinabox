// Owned typed adaptation of upstream shadcnui-blocks logo-cloud-06 (MIT, see ../../LICENSE).
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
import { logoCloud06Literal, logoCloudFamilyCmsLike } from "../../typed/fixtures/logo-cloud-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import { Logo01, Logo02, Logo03, Logo04, Logo05, Logo06, Logo07, Logo08 } from "../../runtime/logos"

const MAX_LOGOS = 8
const LOGO_CLASS = "h-14"
const FALLBACK_LOGOS = [Logo01, Logo02, Logo03, Logo04, Logo05, Logo06, Logo07, Logo08] as const

export type LogoCloud06Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  logos: LogoCloudLogoItem[]
  mediaResolver?: MediaResolver
  literalPreview?: boolean
}

export function LogoCloud06({
  title,
  logos,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
  literalPreview = false,
}: LogoCloud06Props) {
  const titleContent = renderLogoCloudTitle(editSlots, title, blockIndex)
  const displayLogos = sliceLogoCloudLogos(logos, MAX_LOGOS)

  return (
    <div className="flex min-h-screen items-center justify-center px-6" {...rootAttributes}>
      <div className="overflow-hidden">
        {titleContent ? (
          <p className="text-center font-medium text-foreground/80 text-xl tracking-[-0.01em]">{titleContent}</p>
        ) : null}
        <div className="mt-10 flex max-w-(--breakpoint-lg) items-center justify-center gap-x-14 gap-y-10 *:h-14">
          <Marquee className="mask-x-from-75% [--duration:20s] [&_svg]:mr-10" pauseOnHover>
            {literalPreview
              ? FALLBACK_LOGOS.map((Logo, itemIndex) => <Logo className={LOGO_CLASS} key={itemIndex} />)
              : displayLogos.map((logo, itemIndex) => (
                  <React.Fragment key={itemIndex}>
                    {renderLogoCloudLogo(logo, itemIndex, blockIndex, editSlots, mediaResolver, {
                      className: LOGO_CLASS,
                    })}
                  </React.Fragment>
                ))}
          </Marquee>
        </div>
      </div>
    </div>
  )
}

export default function LogoCloud06Literal() {
  return (
    <LogoCloud06
      title={logoCloud06Literal.title}
      logos={logoCloudFamilyCmsLike.logos}
      blockIndex={0}
      literalPreview
    />
  )
}
