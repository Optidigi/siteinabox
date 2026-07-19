// Owned typed adaptation of upstream shadcnui-blocks features-10 (MIT, see ../../LICENSE).
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
import {
  featureItemIcon,
  renderFeatureIntro,
  renderFeatureItemDescription,
  renderFeatureItemTitle,
  renderFeatureTitle,
  type FeatureItem,
} from "../../typed/feature-fields"
import { featureFamilyLiteral } from "../../typed/fixtures/feature-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import { StatsCard } from "./stats-card"

const ITEM_ICONS: LucideIcon[] = [Zap, SquareDashedMousePointer, Code, MonitorSmartphone, Contrast, Cable]

export type Features10Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  features: FeatureItem[]
  literalPreview?: boolean
}

export function Features10({ title, intro, features, blockIndex, editSlots, rootAttributes, literalPreview = false }: Features10Props) {
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
        <p className="mt-3 text-center text-muted-foreground text-xl -tracking-[0.01em] sm:text-2xl">
          {introContent}
        </p>
      ) : null}
      <div className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, itemIndex) => {
          const Icon = featureItemIcon(feature.icon, ITEM_ICONS, itemIndex)
          return (
            <div
              className="rounded-xl border border-border/80 bg-card px-5 pt-7 pb-0 shadow-xs/3"
              key={itemIndex}
            >
              <div className="flex items-center gap-3">
                {Icon ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/7 text-primary dark:bg-primary/10">
                    <Icon className="h-5 w-5" />
                  </div>
                ) : null}
                <h3 className="font-medium text-lg tracking-[-0.005em]">
                  {renderFeatureItemTitle(editSlots, feature.title, blockIndex, itemIndex)}
                </h3>
              </div>
              {feature.description ? (
                <div className="mt-4 text-base text-foreground/80">
                  {renderFeatureItemDescription(editSlots, feature.description, blockIndex, itemIndex)}
                </div>
              ) : null}
              <div className="mt-8 -mr-5">
                <StatsCard
                  className="rounded-br-lg"
                  value={feature.metricValue}
                  label={feature.metricLabel}
                  action={feature.cta}
                  literalPreview={literalPreview}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Features10Literal() {
  return (
    <Features10
      title={featureFamilyLiteral.title}
      intro={featureFamilyLiteral.intro}
      features={featureFamilyLiteral.features}
      blockIndex={0}
      literalPreview
    />
  )
}
