// Owned typed adaptation of upstream shadcnui-blocks logo-cloud-12 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import type { MediaResolver } from "../../../../media"
import {
  type LogoCloudLogoItem,
  renderLogoCloudIntro,
  renderLogoCloudLogo,
  renderLogoCloudTitle,
} from "../../typed/logo-cloud-fields"
import { logoCloudFamilyCmsLike } from "../../typed/fixtures/logo-cloud-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import { Logo01, Logo02, Logo03, Logo04, Logo05, Logo06, Logo07, Logo08 } from "../../runtime/logos"

const LOGO_CLASS = "h-6 sm:h-8"
const FALLBACK_LOGOS = [Logo01, Logo02, Logo03, Logo07, Logo05, Logo06, Logo04, Logo08] as const

export type LogoCloud12Props = TypedVariantBaseProps & {
  intro?: RtRoot | null
  title?: RtRoot | null
  logos: LogoCloudLogoItem[]
  mediaResolver?: MediaResolver
  literalPreview?: boolean
}

export function LogoCloud12({
  intro,
  title,
  logos,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
  literalPreview = false,
}: LogoCloud12Props) {
  const introContent = renderLogoCloudIntro(editSlots, intro, blockIndex)
  const titleContent = renderLogoCloudTitle(editSlots, title, blockIndex)

  return (
    <section className="mx-auto max-w-5xl px-12 py-12" {...rootAttributes}>
      {introContent ? (
        <p className="text-balance text-center font-medium text-muted-foreground text-sm uppercase">{introContent}</p>
      ) : null}
      <div className="relative mt-14 grid grid-cols-2 place-items-center grayscale-100 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4">
        <div className="absolute inset-x-0 top-0 w-[calc(100%+4rem)] -translate-x-8 border-t border-border" />
        <div className="absolute inset-x-0 bottom-0 w-[calc(100%+4rem)] -translate-x-8 border-b border-border" />
        <div className="absolute inset-y-0 left-0 h-[calc(100%+4rem)] -translate-y-8 border-s border-border" />
        <div className="absolute inset-y-0 right-0 h-[calc(100%+4rem)] -translate-y-8 border-e border-border" />

        <div className="absolute inset-x-0 -top-1 w-[calc(100%+3rem)] -translate-x-6 border-t border-border" />
        <div className="absolute inset-x-0 -bottom-1 w-[calc(100%+3rem)] -translate-x-6 border-b border-border" />
        <div className="absolute inset-y-0 -left-1 h-[calc(100%+3rem)] -translate-y-6 border-s border-border" />
        <div className="absolute inset-y-0 -right-1 h-[calc(100%+3rem)] -translate-y-6 border-e border-border" />

        {literalPreview
          ? FALLBACK_LOGOS.map((Logo, itemIndex) => (
              <div className="flex w-full items-center justify-center border-r border-b p-6 border-border" key={itemIndex}>
                <Logo className={LOGO_CLASS} />
              </div>
            ))
          : logos.map((logo, itemIndex) => (
              <div className="flex w-full items-center justify-center border-r border-b p-6 border-border" key={itemIndex}>
                {renderLogoCloudLogo(logo, itemIndex, blockIndex, editSlots, mediaResolver, {
                  className: LOGO_CLASS,
                })}
              </div>
            ))}

        <div className="hidden w-full items-center justify-center border-r text-center sm:flex lg:hidden border-border">
          {titleContent}
        </div>
      </div>
    </section>
  )
}

export default function LogoCloud12Literal() {
  return (
    <LogoCloud12
      intro={logoCloudFamilyCmsLike.intro}
      title={logoCloudFamilyCmsLike.title}
      logos={logoCloudFamilyCmsLike.logos}
      blockIndex={0}
      literalPreview
    />
  )
}
