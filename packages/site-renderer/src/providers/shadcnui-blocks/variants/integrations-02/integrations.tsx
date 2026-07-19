// Owned typed adaptation of upstream shadcnui-blocks integrations-02 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import type { MediaResolver } from "../../../../media"
import { ArrowUpRight } from "lucide-react"
import { Badge } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { integrations02CmsLike } from "../../typed/fixtures/integrations-family"
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

export type Integrations02Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  logos: IntegrationLogoItem[]
  mediaResolver?: MediaResolver
}

export function Integrations02({
  title,
  intro,
  logos,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
}: Integrations02Props) {
  const titleContent = renderIntegrationsTitle(editSlots, title, blockIndex)
  const introContent = renderIntegrationsIntro(editSlots, intro, blockIndex)
  const displayLogos = sliceIntegrationLogos(logos, MAX_LOGOS)

  return (
    <div className="my-12 px-6 sm:my-14" {...rootAttributes}>
      <div className="mx-auto flex w-full max-w-md flex-col rounded-lg border bg-muted p-1 shadow-lg/2">
        <div className="rounded-md border bg-card p-6">
          {titleContent ? <h2 className="font-medium text-2xl tracking-tight">{titleContent}</h2> : null}
          {introContent ? <p className="mt-1.5 text-pretty text-muted-foreground">{introContent}</p> : null}
          <div className="mx-auto mt-8 flex w-full flex-col gap-3">
            {displayLogos.map((logo, itemIndex) => {
              const name = renderIntegrationName(editSlots, logo.name, blockIndex, itemIndex)
              if (!name && !logo.image) return null
              return (
                <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-3" key={itemIndex}>
                  {renderIntegrationLogo(editSlots, mediaResolver, logo, blockIndex, itemIndex, {
                    className: "size-8 rounded",
                  })}
                  {name ? <h3 className="font-medium">{name}</h3> : null}
                  {logo.status === "connected" ? (
                    <Badge className="ms-auto h-7 min-w-26 rounded-lg bg-emerald-600/10 px-3 text-emerald-600 text-sm">
                      Connected
                    </Badge>
                  ) : (
                    <Button className="ms-auto h-7 min-w-26" size="sm" variant="outline">
                      Connect <ArrowUpRight />
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Integrations02Literal() {
  return (
    <Integrations02
      title={integrations02CmsLike.title}
      intro={integrations02CmsLike.intro}
      logos={integrations02CmsLike.logos}
      blockIndex={0}
    />
  )
}
