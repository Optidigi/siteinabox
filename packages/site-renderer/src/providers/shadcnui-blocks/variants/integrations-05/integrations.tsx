// Owned typed adaptation of upstream shadcnui-blocks integrations-05 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import type { MediaResolver } from "../../../../media"
import { integrations05CmsLike } from "../../typed/fixtures/integrations-family"
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

export type Integrations05Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  logos: IntegrationLogoItem[]
  mediaResolver?: MediaResolver
}

export function Integrations05({
  title,
  intro,
  logos,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
}: Integrations05Props) {
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
      <div className="mt-12 grid grid-cols-1 gap-6 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
        {displayLogos.map((logo, itemIndex) => {
          const name = renderIntegrationName(editSlots, logo.name, blockIndex, itemIndex)
          const description = renderIntegrationDescription(editSlots, logo.description, blockIndex, itemIndex)
          if (!name && !description && !logo.image) return null
          return (
            <div className="relative flex flex-col items-start overflow-hidden border bg-card border-border" key={itemIndex}>
              <div className="absolute inset-x-0 top-7 h-9.5 border-y border-dashed bg-muted/30 border-border" />
              <div className="absolute inset-y-0 left-7 w-9.5 border-x border-dashed bg-muted/30 border-border" />
              <div className="relative isolate flex items-start justify-between gap-5 p-6">
                <div className="w-fit shrink-0 rounded-3xl bg-transparent p-1">
                  <div className="relative border bg-background border-border">
                    {renderIntegrationLogo(editSlots, mediaResolver, logo, blockIndex, itemIndex, {
                      className: "size-9",
                    })}
                  </div>
                </div>
                <div>
                  {name ? <h3 className="py-2 font-medium text-xl">{name}</h3> : null}
                  {description ? (
                    <p className="mt-4 mb-2 text-pretty text-muted-foreground tracking-normal">{description}</p>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Integrations05Literal() {
  return (
    <Integrations05
      title={integrations05CmsLike.title}
      intro={integrations05CmsLike.intro}
      logos={integrations05CmsLike.logos}
      blockIndex={0}
    />
  )
}
