// Owned typed adaptation of upstream shadcnui-blocks logo-cloud-13 (MIT, see ../../LICENSE).
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
import { Marquee } from "./marquee"

const LOGO_CLASS = "h-6 sm:h-8"
const FALLBACK_LOGOS = [Logo01, Logo02, Logo03, Logo07, Logo05, Logo06, Logo04, Logo08] as const

export type LogoCloud13Props = TypedVariantBaseProps & {
  intro?: RtRoot | null
  logos: LogoCloudLogoItem[]
  mediaResolver?: MediaResolver
  literalPreview?: boolean
}

export function LogoCloud13({
  intro,
  logos,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
  literalPreview = false,
}: LogoCloud13Props) {
  const introContent = renderLogoCloudIntro(editSlots, intro, blockIndex)

  return (
    <section className="mx-auto max-w-5xl px-12 py-12" {...rootAttributes}>
      {introContent ? (
        <p className="text-balance text-center font-medium text-muted-foreground text-sm uppercase">{introContent}</p>
      ) : null}
      <div className="relative mt-14 flex flex-col grayscale-100">
        <div className="absolute inset-x-0 top-0 w-[calc(100%+4rem)] -translate-x-8 border-t border-border" />
        <div className="absolute inset-x-0 bottom-0 w-[calc(100%+4rem)] -translate-x-8 border-b border-border" />
        <div className="absolute inset-y-0 left-0 h-[calc(100%+4rem)] -translate-y-8 border-s border-border" />
        <div className="absolute inset-y-0 right-0 h-[calc(100%+4rem)] -translate-y-8 border-e border-border" />

        <div className="absolute inset-x-0 -top-1 w-[calc(100%+3rem)] -translate-x-6 border-t border-border" />
        <div className="absolute inset-x-0 -bottom-1 w-[calc(100%+3rem)] -translate-x-6 border-b border-border" />
        <div className="absolute inset-y-0 -left-1 h-[calc(100%+3rem)] -translate-y-6 border-s border-border" />
        <div className="absolute inset-y-0 -right-1 h-[calc(100%+3rem)] -translate-y-6 border-e border-border" />

        <div className="flex flex-col">
          <Marquee className="p-0 [--gap:0px]">
            {literalPreview
              ? FALLBACK_LOGOS.map((Logo, itemIndex) => (
                  <div
                    className="flex w-full items-center justify-center border-e px-10 py-6 even:bg-muted/60 dark:even:bg-muted/30 border-border"
                    key={itemIndex}
                  >
                    <Logo className={LOGO_CLASS} />
                  </div>
                ))
              : logos.map((logo, itemIndex) => (
                  <div
                    className="flex w-full items-center justify-center border-e px-10 py-6 even:bg-muted/60 dark:even:bg-muted/30 border-border"
                    key={itemIndex}
                  >
                    {renderLogoCloudLogo(logo, itemIndex, blockIndex, editSlots, mediaResolver, {
                      className: LOGO_CLASS,
                    })}
                  </div>
                ))}
          </Marquee>
        </div>
      </div>
    </section>
  )
}

export default function LogoCloud13Literal() {
  return <LogoCloud13 intro={logoCloudFamilyCmsLike.intro} logos={logoCloudFamilyCmsLike.logos} blockIndex={0} literalPreview />
}
