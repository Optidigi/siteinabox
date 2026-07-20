// Owned typed adaptation of upstream shadcnui-blocks features-08 (MIT, see ../../LICENSE).
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
import { feature08Literal } from "../../typed/fixtures/feature-family"
import type { TypedVariantBaseProps } from "../../typed/props"

const ITEM_ICONS: LucideIcon[] = [Zap, SquareDashedMousePointer, Code, MonitorSmartphone, Contrast, Cable]

export type Features08Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  features: FeatureItem[]
  literalPreview?: boolean
}

export function Features08({ title, intro, features, blockIndex, editSlots, rootAttributes, literalPreview = false }: Features08Props) {
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
        <p className="mt-3.5 text-pretty text-center text-muted-foreground text-xl -tracking-[0.01em] sm:text-2xl">
          {introContent}
        </p>
      ) : null}
      <div className="mt-16 grid grid-cols-1 gap-6 sm:mt-20 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, itemIndex) => {
          const Icon = featureItemIcon(feature.icon, ITEM_ICONS, itemIndex)
          return (
            <div className="rounded-xl border bg-card px-6 py-7 border-border" key={itemIndex}>
              {Icon ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5 text-primary dark:bg-primary/15">
                  <Icon />
                </div>
              ) : null}
              <h3 className="mt-5 font-medium text-lg tracking-[-0.005em]">
                {renderFeatureItemTitle(editSlots, feature.title, blockIndex, itemIndex)}
              </h3>
              {feature.description ? (
                <div className="mt-2 text-base text-foreground/70">
                  {renderFeatureItemDescription(editSlots, feature.description, blockIndex, itemIndex, { literalPreview })}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Features08Literal() {
  return (
    <Features08
      title={feature08Literal.title}
      intro={feature08Literal.intro}
      features={feature08Literal.features}
      blockIndex={0}
      literalPreview
    />
  )
}
