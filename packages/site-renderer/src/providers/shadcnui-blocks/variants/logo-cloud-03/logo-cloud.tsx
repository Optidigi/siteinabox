// Owned typed adaptation of upstream shadcnui-blocks logo-cloud-03 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { LinkRef, RtRoot } from "@siteinabox/contracts"
import { ArrowUpRight } from "lucide-react"
import { SharedButton as Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import type { MediaResolver } from "../../../../media"
import {
  type LogoCloudLogoItem,
  renderLogoCloudIntro,
  renderLogoCloudLink,
  renderLogoCloudLogo,
  renderLogoCloudTitle,
  sliceLogoCloudLogos,
} from "../../typed/logo-cloud-fields"
import { logoCloud03Literal, logoCloudFamilyCmsLike } from "../../typed/fixtures/logo-cloud-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import { Logo01, Logo02, Logo03, Logo04, Logo05 } from "../../runtime/logos"

const MAX_LOGOS = 5
const LOGO_CLASS = "h-8 md:h-8 lg:h-10"
const GRID_ORDER = [0, 2, 1, 3, 4] as const
const FALLBACK_LOGOS = [Logo01, Logo03, Logo02, Logo04, Logo05] as const

export type LogoCloud03Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  cta?: LinkRef | null
  logos: LogoCloudLogoItem[]
  mediaResolver?: MediaResolver
  literalPreview?: boolean
}

export function LogoCloud03({
  title,
  intro,
  cta,
  logos,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
  literalPreview = false,
}: LogoCloud03Props) {
  const titleContent = renderLogoCloudTitle(editSlots, title, blockIndex)
  const introContent = renderLogoCloudIntro(editSlots, intro, blockIndex)
  const ctaAction = renderLogoCloudLink(editSlots, cta ?? {}, blockIndex, {
    trailingIcon: <ArrowUpRight />,
  })
  const displayLogos = sliceLogoCloudLogos(logos, MAX_LOGOS)

  return (
    <div className="flex min-h-screen flex-col" {...rootAttributes}>
      <div className="shrink-0 grow basis-1/2 bg-muted" />
      <div className="relative grow">
        <div className="inset-x-0 top-0 mx-auto flex w-full flex-col justify-between gap-10 rounded-lg border border-border/70 bg-background px-10 py-14 shadow-foreground/4 sm:absolute sm:-translate-y-1/2 sm:shadow-lg md:max-w-(--breakpoint-md) lg:max-w-(--breakpoint-lg) lg:flex-row lg:items-center xl:max-w-(--breakpoint-xl) dark:border-border/70 dark:shadow-foreground/3">
          <div className="shrink-0">
            {titleContent ? (
              <h3 className="font-medium text-3xl tracking-[-0.045em]">{titleContent}</h3>
            ) : null}
            {introContent ? (
              <p className="mt-3 max-w-xl text-foreground/80 text-lg lg:max-w-md xl:max-w-xl">{introContent}</p>
            ) : null}
            {ctaAction ? (
              <Button className="mt-7" size="lg" asChild>
                {ctaAction}
              </Button>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-x-6 gap-y-8 *:h-8 md:grid-cols-4 md:*:h-8 lg:grid-cols-2 lg:justify-end lg:gap-10 xl:grid-cols-3 xl:*:h-10">
            {literalPreview
              ? FALLBACK_LOGOS.map((Logo, itemIndex) => <Logo className={LOGO_CLASS} key={itemIndex} />)
              : GRID_ORDER.map((sourceIndex, itemIndex) => {
                  const logo = displayLogos[sourceIndex]
                  if (!logo) return null
                  return (
                    <React.Fragment key={itemIndex}>
                      {renderLogoCloudLogo(logo, sourceIndex, blockIndex, editSlots, mediaResolver, {
                        className: LOGO_CLASS,
                      })}
                    </React.Fragment>
                  )
                })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LogoCloud03Literal() {
  return (
    <LogoCloud03
      title={logoCloud03Literal.title}
      intro={logoCloud03Literal.intro}
      cta={logoCloud03Literal.cta}
      logos={logoCloudFamilyCmsLike.logos}
      blockIndex={0}
      literalPreview
    />
  )
}
