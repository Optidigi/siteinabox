// Owned typed adaptation of upstream shadcnui-blocks features-17 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import {
  Cable,
  Code,
  Contrast,
  MonitorSmartphone,
  SquareDashedMousePointer,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { Badge } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import {
  featureItemIcon,
  renderFeatureIntro,
  renderFeatureItemDescription,
  renderFeatureItemTitle,
  renderFeatureTitle,
  type FeatureItem,
} from "../../typed/feature-fields"
import { featureFamilyCmsLike } from "../../typed/fixtures/feature-family"
import type { TypedVariantBaseProps } from "../../typed/props"

const ITEM_ICONS: LucideIcon[] = [Zap, SquareDashedMousePointer, Code, MonitorSmartphone, Contrast, Cable]

export type Features17Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  features: FeatureItem[]
}

export function Features17({ title, intro, features, blockIndex, editSlots, rootAttributes }: Features17Props) {
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
        <p className="-tracking[0.01em] mt-3 text-pretty text-center text-muted-foreground text-xl sm:text-2xl">
          {introContent}
        </p>
      ) : null}
      <div className="mt-16 grid grid-cols-1 gap-1.5 border bg-muted p-1.5 sm:mt-20 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, itemIndex) => {
          const Icon = featureItemIcon(feature.icon, ITEM_ICONS, itemIndex)
          return (
            <div className="relative -m-px border bg-card px-5 py-7" key={itemIndex}>
              {Icon ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5 text-primary dark:bg-primary/10">
                  <Icon />
                </div>
              ) : null}
              <h3 className="mt-5 font-medium text-lg tracking-[-0.005em]">
                {renderFeatureItemTitle(editSlots, feature.title, blockIndex, itemIndex)}
              </h3>
              {feature.description ? (
                <p className="mt-2 text-foreground/80">
                  {renderFeatureItemDescription(editSlots, feature.description, blockIndex, itemIndex)}
                </p>
              ) : null}
              <Badge
                className="absolute top-0 right-0 rounded-none border-t-0 border-r-0 bg-muted/30 font-mono dark:border-foreground/15 dark:bg-background"
                variant="outline"
              >
                {(itemIndex + 1).toString().padStart(2, "0")}
              </Badge>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Features17Literal() {
  return (
    <Features17
      title={featureFamilyCmsLike.title}
      intro={featureFamilyCmsLike.intro}
      features={featureFamilyCmsLike.features}
      blockIndex={0}
    />
  )
}
