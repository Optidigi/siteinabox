// Owned typed adaptation of upstream shadcnui-blocks features-02 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import {
  renderFeatureIntro,
  renderFeatureItemDescription,
  renderFeatureItemImage,
  renderFeatureItemTitle,
  renderFeatureTitle,
  type FeatureItem,
} from "../../typed/feature-fields"
import { feature02Literal } from "../../typed/fixtures/feature-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import type { MediaResolver } from "../../../../media"

export type Features02Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  features: FeatureItem[]
  mediaResolver?: MediaResolver
}

export function Features02({
  title,
  intro,
  features,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
}: Features02Props) {
  const titleContent = renderFeatureTitle(editSlots, title, blockIndex)
  const introContent = renderFeatureIntro(editSlots, intro, blockIndex)

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-20" {...rootAttributes}>
      <div className="w-full grow sm:max-w-(--breakpoint-md) lg:max-w-(--breakpoint-lg)">
        {titleContent ? (
          <h2 className="mx-auto text-center font-medium text-4xl tracking-[-0.045em] sm:text-[2.75rem]/[1.2]">
            {titleContent}
          </h2>
        ) : null}
        {introContent ? (
          <p className="mt-3 text-pretty text-center text-lg text-muted-foreground tracking-[-0.01em] sm:text-2xl">
            {introContent}
          </p>
        ) : null}
        <div className="mt-18 grid w-full gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, itemIndex) => (
            <div className="flex w-full flex-col text-start" key={itemIndex}>
              <div className="relative mb-5 aspect-4/5 w-full overflow-hidden rounded-xl sm:mb-6">
                {renderFeatureItemImage(
                  editSlots,
                  mediaResolver,
                  feature.image,
                  feature.title,
                  blockIndex,
                  itemIndex,
                  {
                    className: "size-full bg-muted object-cover",
                  },
                )}
              </div>
              <div className="px-1">
                <span className="font-medium text-[22px] tracking-[-0.015em]">
                  {renderFeatureItemTitle(editSlots, feature.title, blockIndex, itemIndex)}
                </span>
                {feature.description ? (
                  <div className="mt-1 max-w-[25ch] text-[17px] text-muted-foreground">
                    {renderFeatureItemDescription(editSlots, feature.description, blockIndex, itemIndex)}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Features02Literal() {
  return (
    <Features02
      title={feature02Literal.title}
      intro={feature02Literal.intro}
      features={feature02Literal.features}
      blockIndex={0}
    />
  )
}
