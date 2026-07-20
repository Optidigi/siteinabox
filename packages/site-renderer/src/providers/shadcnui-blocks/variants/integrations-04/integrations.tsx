// Owned typed adaptation of upstream shadcnui-blocks integrations-04 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import type { MediaResolver } from "../../../../media"
import { integrations04CmsLike } from "../../typed/fixtures/integrations-family"
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

export type Integrations04Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  logos: IntegrationLogoItem[]
  mediaResolver?: MediaResolver
}

export function Integrations04({
  title,
  intro,
  logos,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
}: Integrations04Props) {
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
            <div className="relative flex flex-col items-start border bg-card p-8 border-border" key={itemIndex}>
              <div className="absolute inset-x-0 bottom-0 h-2 w-full border-t border-dashed bg-muted/75 border-border" />
              <div className="absolute inset-x-0 top-0 h-2 w-full border-b border-dashed bg-muted/75 border-border" />
              <div className="absolute inset-y-0 left-0 h-full w-2 border-e border-dashed bg-muted/75 border-border" />
              <div className="absolute inset-y-0 right-0 h-full w-2 border-s border-dashed bg-muted/75 border-border" />
              {renderIntegrationLogo(editSlots, mediaResolver, logo, blockIndex, itemIndex, {
                className: "size-10 rounded",
              })}
              {name ? <h3 className="mt-5 font-medium text-xl">{name}</h3> : null}
              {description ? (
                <p className="mt-1.5 text-pretty text-muted-foreground tracking-normal">{description}</p>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Integrations04Literal() {
  return (
    <Integrations04
      title={integrations04CmsLike.title}
      intro={integrations04CmsLike.intro}
      logos={integrations04CmsLike.logos}
      blockIndex={0}
    />
  )
}
