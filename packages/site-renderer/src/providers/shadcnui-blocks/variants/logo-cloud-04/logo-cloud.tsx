// Owned typed adaptation of upstream shadcnui-blocks logo-cloud-04 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import type { MediaResolver } from "../../../../media"
import {
  type LogoCloudLogoItem,
  renderLogoCloudIntro,
  renderLogoCloudLogo,
} from "../../typed/logo-cloud-fields"
import { logoCloudFamilyCmsLike } from "../../typed/fixtures/logo-cloud-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import { Logo01, Logo02, Logo03, Logo04, Logo05, Logo06, Logo07, Logo08 } from "../../runtime/logos"

const LOGO_CLASS = "h-8 sm:h-10"
const FALLBACK_LOGOS = [Logo01, Logo02, Logo03, Logo04, Logo05, Logo06, Logo07, Logo08] as const

export type LogoCloud04Props = TypedVariantBaseProps & {
  intro?: RtRoot | null
  logos: LogoCloudLogoItem[]
  mediaResolver?: MediaResolver
  literalPreview?: boolean
}

export function LogoCloud04({
  intro,
  logos,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
  literalPreview = false,
}: LogoCloud04Props) {
  const introContent = renderLogoCloudIntro(editSlots, intro, blockIndex)

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16" {...rootAttributes}>
      <div>
        {introContent ? (
          <p className="text-center font-medium text-foreground/80 text-xl tracking-[-0.01em]">{introContent}</p>
        ) : null}
        <div className="mt-16 grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {literalPreview
            ? FALLBACK_LOGOS.map((Logo, itemIndex) => (
                <div
                  className="flex items-center justify-center rounded border border-dashed py-6 *:h-8 sm:px-10 sm:py-8 sm:*:h-10"
                  key={itemIndex}
                >
                  <Logo className={LOGO_CLASS} />
                </div>
              ))
            : logos.map((logo, itemIndex) => (
                <div
                  className="flex items-center justify-center rounded border border-dashed py-6 *:h-8 sm:px-10 sm:py-8 sm:*:h-10"
                  key={itemIndex}
                >
                  {renderLogoCloudLogo(logo, itemIndex, blockIndex, editSlots, mediaResolver, {
                    className: LOGO_CLASS,
                  })}
                </div>
              ))}
        </div>
      </div>
    </div>
  )
}

export default function LogoCloud04Literal() {
  return <LogoCloud04 intro={logoCloudFamilyCmsLike.intro} logos={logoCloudFamilyCmsLike.logos} blockIndex={0} literalPreview />
}
