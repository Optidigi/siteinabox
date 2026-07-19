// Owned typed adaptation of upstream shadcnui-blocks features-13 (MIT, see ../../LICENSE).
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

const ITEM_ICONS: LucideIcon[] = [Zap, SquareDashedMousePointer, Code, MonitorSmartphone, Contrast, Cable]

const GRID_OVERLAY_STYLE: React.CSSProperties = {
  backgroundImage: `
        linear-gradient(to right, var(--border) 1px, transparent 1px),
        linear-gradient(to bottom, var(--border) 1px, transparent 1px)
      `,
  backgroundSize: "20px 20px",
  backgroundPosition: "0 0, 0 0",
  maskImage: `
          repeating-linear-gradient(
              to right,
              black 0px,
              black 3px,
              transparent 3px,
              transparent 8px
            ),
            repeating-linear-gradient(
              to bottom,
              black 0px,
              black 3px,
              transparent 3px,
              transparent 8px
            ),
            radial-gradient(ellipse 100% 80% at 100% 0%, #000 50%, transparent 100%)
      `,
  WebkitMaskImage: `
    repeating-linear-gradient(
              to right,
              black 0px,
              black 3px,
              transparent 3px,
              transparent 8px
            ),
            repeating-linear-gradient(
              to bottom,
              black 0px,
              black 3px,
              transparent 3px,
              transparent 8px
            ),
            radial-gradient(ellipse 80% 80% at 100% 0%, #000 50%, transparent 90%)
      `,
  maskComposite: "intersect",
  WebkitMaskComposite: "source-in",
}

export type Features13Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  features: FeatureItem[]
}

export function Features13({ title, intro, features, blockIndex, editSlots, rootAttributes }: Features13Props) {
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
      <div className="mt-20 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, itemIndex) => {
          const Icon = featureItemIcon(feature.icon, ITEM_ICONS, itemIndex)
          return (
            <div
              className="relative overflow-hidden rounded-xl border bg-card p-6 dark:border-card-foreground/7"
              key={itemIndex}
            >
              {Icon ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5 text-primary dark:bg-primary/10">
                  <Icon />
                </div>
              ) : null}
              <h3 className="mt-5 font-medium text-lg tracking-[-0.005em]">
                {renderFeatureItemTitle(editSlots, feature.title, blockIndex, itemIndex)}
              </h3>
              {feature.description ? (
                <div className="mt-2 text-foreground/80">
                  {renderFeatureItemDescription(editSlots, feature.description, blockIndex, itemIndex)}
                </div>
              ) : null}
              <div className="absolute inset-0 -top-px z-0" style={GRID_OVERLAY_STYLE} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Features13Literal() {
  return (
    <Features13
      title={featureFamilyLiteral.title}
      intro={featureFamilyLiteral.intro}
      features={featureFamilyLiteral.features}
      blockIndex={0}
    />
  )
}
