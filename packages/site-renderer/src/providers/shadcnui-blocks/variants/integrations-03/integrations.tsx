// Owned typed adaptation of upstream shadcnui-blocks integrations-03 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import type { MediaResolver } from "../../../../media"
import { ArrowUpRight } from "lucide-react"
import { Badge } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { integrations03CmsLike } from "../../typed/fixtures/integrations-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import {
  renderIntegrationLogo,
  renderIntegrationName,
  renderIntegrationsIntro,
  renderIntegrationsTitle,
  sliceIntegrationLogos,
  type IntegrationLogoItem,
} from "../../typed/integrations-fields"

const MAX_LOGOS = 12

export type Integrations03Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  logos: IntegrationLogoItem[]
  mediaResolver?: MediaResolver
}

export function Integrations03({
  title,
  intro,
  logos,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
}: Integrations03Props) {
  const titleContent = renderIntegrationsTitle(editSlots, title, blockIndex)
  const introContent = renderIntegrationsIntro(editSlots, intro, blockIndex)
  const displayLogos = sliceIntegrationLogos(logos, MAX_LOGOS)

  return (
    <div className="mx-auto flex max-w-7xl flex-col px-6 py-12 sm:py-14" {...rootAttributes}>
      {titleContent ? (
        <h2 className="text-center font-medium text-4xl tracking-[-0.04em] sm:text-[2.75rem]">{titleContent}</h2>
      ) : null}
      {introContent ? (
        <p className="mt-3 text-pretty text-center text-muted-foreground text-xl -tracking-[0.01em] sm:text-2xl">
          {introContent}
        </p>
      ) : null}
      <div className="mt-12 grid grid-cols-1 gap-5 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
        {displayLogos.map((logo, itemIndex) => {
          const name = renderIntegrationName(editSlots, logo.name, blockIndex, itemIndex)
          if (!name && !logo.image) return null
          return (
            <div
              className="flex items-center gap-4 rounded-lg border border-border/85 bg-card pe-4 shadow-xs/2"
              key={itemIndex}
            >
              <div className="border-e border-dashed p-4 border-border">
                {renderIntegrationLogo(editSlots, mediaResolver, logo, blockIndex, itemIndex, {
                  className: "size-8 rounded",
                })}
              </div>
              {name ? <h3 className="font-medium text-lg">{name}</h3> : null}
              {logo.status === "connected" ? (
                <Badge className="ms-auto h-7 min-w-26 rounded-lg bg-emerald-600/10 px-3 text-emerald-600 text-sm">
                  Connected
                </Badge>
              ) : (
                <Button className="ms-auto h-7.5" size="sm" variant="outline">
                  Connect <ArrowUpRight />
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Integrations03Literal() {
  return (
    <Integrations03
      title={integrations03CmsLike.title}
      intro={integrations03CmsLike.intro}
      logos={integrations03CmsLike.logos}
      blockIndex={0}
    />
  )
}
