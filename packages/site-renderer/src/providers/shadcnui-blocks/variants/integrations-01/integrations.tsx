// Owned typed adaptation of upstream shadcnui-blocks integrations-01 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import type { MediaResolver } from "../../../../media"
import { ArrowUpRight } from "lucide-react"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { integrations01CmsLike } from "../../typed/fixtures/integrations-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import {
  renderIntegrationDescription,
  renderIntegrationLogo,
  renderIntegrationName,
  renderIntegrationsIntro,
  renderIntegrationsTitle,
  sliceIntegrationLogos,
  type IntegrationLogoItem,
} from "../../typed/integrations-fields"

const MAX_LOGOS = 12

export type Integrations01Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  logos: IntegrationLogoItem[]
  mediaResolver?: MediaResolver
}

export function Integrations01({
  title,
  intro,
  logos,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
}: Integrations01Props) {
  const titleContent = renderIntegrationsTitle(editSlots, title, blockIndex)
  const introContent = renderIntegrationsIntro(editSlots, intro, blockIndex)
  const displayLogos = sliceIntegrationLogos(logos, MAX_LOGOS)

  return (
    <div className="mx-auto flex max-w-7xl flex-col px-6 py-20" {...rootAttributes}>
      {titleContent ? (
        <h2 className="text-center font-medium text-4xl tracking-[-0.04em] sm:text-[2.75rem]">{titleContent}</h2>
      ) : null}
      {introContent ? (
        <p className="mt-3 text-pretty text-center text-muted-foreground text-xl -tracking-[0.01em] sm:text-2xl">
          {introContent}
        </p>
      ) : null}
      <div className="mt-12 grid grid-cols-1 gap-6 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
        {displayLogos.map((logo, itemIndex) => {
          const name = renderIntegrationName(editSlots, logo.name, blockIndex, itemIndex)
          const description = renderIntegrationDescription(editSlots, logo.description, blockIndex, itemIndex)
          if (!name && !description && !logo.image) return null
          return (
            <div className="flex flex-col items-start rounded-lg border bg-card p-6 shadow-xs/3" key={itemIndex}>
              <div className="grow">
                {renderIntegrationLogo(editSlots, mediaResolver, logo, blockIndex, itemIndex, {
                  className: "size-10 rounded",
                })}
                {name ? <h3 className="mt-5 font-medium text-xl">{name}</h3> : null}
                {description ? (
                  <p className="mt-1 text-pretty text-muted-foreground tracking-normal">{description}</p>
                ) : null}
              </div>
              <Button className="mt-6">
                Connect <ArrowUpRight />
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Integrations01Literal() {
  return (
    <Integrations01
      title={integrations01CmsLike.title}
      intro={integrations01CmsLike.intro}
      logos={integrations01CmsLike.logos}
      blockIndex={0}
    />
  )
}
