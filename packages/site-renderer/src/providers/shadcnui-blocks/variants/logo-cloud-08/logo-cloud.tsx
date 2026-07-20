// Owned typed adaptation of upstream shadcnui-blocks logo-cloud-08 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import type { MediaResolver } from "../../../../media"
import {
  type LogoCloudLogoItem,
  renderLogoCloudIntro,
  renderLogoCloudLogo,
} from "../../typed/logo-cloud-fields"
import { logoCloud08Literal, logoCloudFamilyCmsLike } from "../../typed/fixtures/logo-cloud-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import { Logo01, Logo02, Logo03, Logo04, Logo05, Logo06, Logo07, Logo08 } from "../../runtime/logos"

const LOGO_CLASS = "h-7 sm:h-8"
const FALLBACK_LOGOS = [Logo01, Logo02, Logo03, Logo07, Logo05, Logo06, Logo04, Logo08] as const

export type LogoCloud08Props = TypedVariantBaseProps & {
  intro?: RtRoot | null
  logos: LogoCloudLogoItem[]
  mediaResolver?: MediaResolver
  literalPreview?: boolean
}

export function LogoCloud08({
  intro,
  logos,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
  literalPreview = false,
}: LogoCloud08Props) {
  const introContent = renderLogoCloudIntro(editSlots, intro, blockIndex)

  return (
    <section className="mx-auto max-w-5xl px-6 py-12" {...rootAttributes}>
      {introContent ? (
        <p className="text-balance text-center font-medium text-muted-foreground text-sm uppercase">{introContent}</p>
      ) : null}
      <div className="mt-10 grid grid-cols-2 place-items-center border-t border-l border-dashed grayscale-100 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 border-border">
        {literalPreview
          ? FALLBACK_LOGOS.map((Logo, itemIndex) => (
              <div
                className="flex w-full items-center justify-center border-r border-b border-dashed bg-card p-6 border-border"
                key={itemIndex}
              >
                <Logo className={LOGO_CLASS} />
              </div>
            ))
          : logos.map((logo, itemIndex) => (
              <div
                className="flex w-full items-center justify-center border-r border-b border-dashed bg-card p-6 border-border"
                key={itemIndex}
              >
                {renderLogoCloudLogo(logo, itemIndex, blockIndex, editSlots, mediaResolver, {
                  className: LOGO_CLASS,
                })}
              </div>
            ))}
      </div>
    </section>
  )
}

export default function LogoCloud08Literal() {
  return <LogoCloud08 intro={logoCloud08Literal.intro} logos={logoCloudFamilyCmsLike.logos} blockIndex={0} literalPreview />
}
