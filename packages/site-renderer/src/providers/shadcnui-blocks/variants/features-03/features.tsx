// Owned typed adaptation of upstream shadcnui-blocks features-03 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import { ArrowRightIcon, BlocksIcon, Settings2Icon } from "lucide-react"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { extractRichText } from "../../../../rich-text"
import {
  featureDescriptionLines,
  renderFeatureItemCta,
  renderFeatureItemImage,
  renderFeatureItemTitle,
  renderFeatureTitle,
  type FeatureItem,
} from "../../typed/feature-fields"
import { feature03Literal } from "../../typed/fixtures/feature-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import type { MediaResolver } from "../../../../media"

const CARD_ICONS = [Settings2Icon, BlocksIcon] as const

export type Features03Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  features: FeatureItem[]
  mediaResolver?: MediaResolver
  literalPreview?: boolean
}

export function Features03({
  title,
  features,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
  literalPreview = false,
}: Features03Props) {
  const titleContent = renderFeatureTitle(editSlots, title, blockIndex)
  const cards = features.slice(0, 2)

  return (
    <div className="mx-auto w-full max-w-(--breakpoint-lg) px-6 py-20" {...rootAttributes}>
      {titleContent ? (
        <h2 className="font-medium text-3xl leading-10 tracking-[-0.04em] sm:text-4xl md:text-[40px] md:leading-13">
          {titleContent}
        </h2>
      ) : null}
      <div className="mt-8 grid gap-6 sm:grid-cols-2 md:grid-cols-5 lg:grid-cols-3">
        {cards.flatMap((feature, index) => {
          const lines = featureDescriptionLines(feature.description)
          const card = (
            <div key={`card-${index}`} className="col-span-1 rounded-xl bg-muted p-6 md:col-span-2 lg:col-span-1">
              <div className="mb-6 aspect-video w-full overflow-hidden rounded-xl bg-background md:hidden">
                {renderFeatureItemImage(
                  editSlots,
                  mediaResolver,
                  feature.image,
                  feature.title,
                  blockIndex,
                  index,
                  { className: "h-full w-full object-cover" },
                )}
              </div>
              <span className="font-medium text-xl tracking-[-0.01em]">
                {renderFeatureItemTitle(editSlots, feature.title, blockIndex, index)}
              </span>
              {lines.length ? (
                <ul className="mt-6 space-y-5">
                  {lines.map((line, lineIndex) => {
                    const Icon = CARD_ICONS[lineIndex % CARD_ICONS.length]!
                    return (
                      <li key={lineIndex}>
                        <div className="flex items-start gap-3">
                          <Icon className="shrink-0" />
                          <p className="-mt-0.5">{line}</p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
              {feature.cta?.label && feature.cta.href ? (
                <Button className="mt-8 w-full" asChild>
                  {renderFeatureItemCta(editSlots, feature.cta, blockIndex, index, {
                    trailingIcon: <ArrowRightIcon />,
                  })}
                </Button>
              ) : literalPreview ? (
                <Button className="mt-8 w-full">
                  Build your strategy <ArrowRightIcon />
                </Button>
              ) : null}
            </div>
          )
          const desktopMedia = (
            <div
              key={`media-${index}`}
              className="col-span-1 hidden overflow-hidden rounded-xl bg-muted md:col-span-3 md:block lg:col-span-2"
            >
              {renderFeatureItemImage(
                editSlots,
                mediaResolver,
                feature.image,
                feature.title,
                blockIndex,
                index,
                { alt: extractRichText(feature.title), className: "h-full w-full object-cover" },
              )}
            </div>
          )
          return index % 2 === 0 ? [card, desktopMedia] : [desktopMedia, card]
        })}
      </div>
    </div>
  )
}

export default function Features03Literal() {
  return (
    <Features03
      title={feature03Literal.title}
      features={feature03Literal.features}
      blockIndex={0}
      literalPreview
    />
  )
}
