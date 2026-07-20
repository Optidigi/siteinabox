// Owned typed adaptation of upstream shadcnui-blocks logo-cloud-14 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { LinkRef, RtRoot } from "@siteinabox/contracts"
import { ArrowUpRight } from "lucide-react"
import { SharedButton as Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import type { MediaResolver } from "../../../../media"
import {
  type LogoCloudLogoItem,
  renderLogoCloudLink,
  renderLogoCloudLogo,
  renderLogoCloudTitle,
} from "../../typed/logo-cloud-fields"
import { logoCloud14Literal, logoCloudFamilyCmsLike } from "../../typed/fixtures/logo-cloud-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import { Logo01, Logo02, Logo03, Logo04, Logo05, Logo06, Logo07, Logo08 } from "../../runtime/logos"

const LOGO_CLASS = "h-7 sm:h-8"
const FALLBACK_LOGOS = [Logo01, Logo02, Logo03, Logo04, Logo05, Logo06, Logo07, Logo08, Logo01] as const

export type LogoCloud14Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  cta?: LinkRef | null
  logos: LogoCloudLogoItem[]
  mediaResolver?: MediaResolver
  literalPreview?: boolean
}

export function LogoCloud14({
  title,
  cta,
  logos,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
  literalPreview = false,
}: LogoCloud14Props) {
  const titleContent = renderLogoCloudTitle(editSlots, title, blockIndex)
  const ctaAction = renderLogoCloudLink(editSlots, cta ?? {}, blockIndex, {
    trailingIcon: <ArrowUpRight />,
  })

  return (
    <div className="px-6 py-12" {...rootAttributes}>
      <div className="mx-auto mt-10 grid max-w-5xl grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        <div className="flex flex-col rounded-xl bg-muted p-5 max-sm:col-span-full sm:row-span-3">
          {titleContent ? (
            <p className="mb-8 max-w-[20ch] text-balance font-medium text-2xl tracking-tight sm:text-xl lg:text-2xl">
              {titleContent}
            </p>
          ) : null}
          {ctaAction ? (
            <Button className="mt-auto max-sm:me-auto" size="lg" asChild>
              {ctaAction}
            </Button>
          ) : null}
        </div>
        {literalPreview
          ? FALLBACK_LOGOS.map((Logo, itemIndex) => (
              <div className="flex w-full items-center justify-center rounded-xl bg-muted px-3 py-7" key={itemIndex}>
                <Logo className={LOGO_CLASS} />
              </div>
            ))
          : logos.map((logo, itemIndex) => (
              <div className="flex w-full items-center justify-center rounded-xl bg-muted px-3 py-7" key={itemIndex}>
                {renderLogoCloudLogo(logo, itemIndex, blockIndex, editSlots, mediaResolver, {
                  className: LOGO_CLASS,
                })}
              </div>
            ))}
      </div>
    </div>
  )
}

export default function LogoCloud14Literal() {
  return (
    <LogoCloud14
      title={logoCloud14Literal.title}
      cta={logoCloud14Literal.cta}
      logos={logoCloudFamilyCmsLike.logos}
      blockIndex={0}
      literalPreview
    />
  )
}
