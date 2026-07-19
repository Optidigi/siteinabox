// Owned typed adaptation of upstream shadcnui-blocks features-16 (MIT, see ../../LICENSE).
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
import { featureFamilyLiteral } from "../../typed/fixtures/feature-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import type { MediaResolver } from "../../../../media"

export type Features16Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  features: FeatureItem[]
  mediaResolver?: MediaResolver
}

export function Features16({
  title,
  intro,
  features,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
}: Features16Props) {
  const titleContent = renderFeatureTitle(editSlots, title, blockIndex)
  const introContent = renderFeatureIntro(editSlots, intro, blockIndex)

  return (
    <div className="mx-auto flex max-w-7xl flex-col px-6 py-20" {...rootAttributes}>
      {titleContent ? (
        <h2 className="text-pretty text-center font-medium text-4xl tracking-[-0.04em] sm:text-[2.75rem]">
          {titleContent}
        </h2>
      ) : null}
      {introContent ? (
        <p className="mt-3 text-pretty text-center text-muted-foreground text-xl -tracking-[0.01em] sm:text-2xl">
          {introContent}
        </p>
      ) : null}
      <div className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-6 sm:mt-20 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, itemIndex) => (
          <div className="relative rounded-lg border border-border/80" key={itemIndex}>
            <div className="mask-b-from-50% dark:mask-b-from-40% aspect-4/5 w-full rounded-t-lg">
              {renderFeatureItemImage(
                editSlots,
                mediaResolver,
                feature.image,
                feature.title,
                blockIndex,
                itemIndex,
                { className: "size-full rounded-t-lg object-cover" },
              )}
            </div>
            <div className="mask-t-from-50% absolute inset-x-0 bottom-0 rounded-b-lg bg-background/80 p-6 pt-20">
              <h3 className="font-medium text-xl tracking-[-0.005em]">
                {renderFeatureItemTitle(editSlots, feature.title, blockIndex, itemIndex)}
              </h3>
              {feature.description ? (
                <div className="mt-2 text-foreground/80 text-lg">
                  {renderFeatureItemDescription(editSlots, feature.description, blockIndex, itemIndex)}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Features16Literal() {
  return (
    <Features16
      title={featureFamilyLiteral.title}
      intro={featureFamilyLiteral.intro}
      features={featureFamilyLiteral.features}
      blockIndex={0}
    />
  )
}
