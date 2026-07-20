// Owned typed adaptation of upstream shadcnui-blocks features-06 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import {
  renderFeatureIntro,
  renderFeatureItemDescription,
  renderFeatureItemTitle,
  renderFeatureTitle,
  type FeatureItem,
} from "../../typed/feature-fields"
import { feature06Literal } from "../../typed/fixtures/feature-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import { Flower10, Moon12, Star1, Triangle14 } from "./shapes"

const GRID_MASK_STYLE: React.CSSProperties = {
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
          radial-gradient(ellipse 60% 60% at 50% 50%, #000 30%, transparent 70%)
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
          radial-gradient(ellipse 60% 60% at 50% 50%, #000 30%, transparent 70%)
      `,
  maskComposite: "intersect",
  WebkitMaskComposite: "source-in",
}

const SHAPE_ICONS = [Flower10, Star1, Moon12, Triangle14] as const

export type Features06Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  features: FeatureItem[]
  literalPreview?: boolean
}

export function Features06({ title, intro, features, blockIndex, editSlots, rootAttributes, literalPreview = false }: Features06Props) {
  const titleContent = renderFeatureTitle(editSlots, title, blockIndex)
  const introContent = renderFeatureIntro(editSlots, intro, blockIndex)

  return (
    <div className="px-6 py-20" {...rootAttributes}>
      <div className="mx-auto w-full max-w-(--breakpoint-lg)">
        {titleContent ? (
          <h2 className="text-pretty text-center font-medium text-4xl tracking-[-0.04em] md:text-[2.75rem]">
            {titleContent}
          </h2>
        ) : null}
        {introContent ? (
          <p className="mt-3 text-pretty text-center text-lg text-muted-foreground tracking-[-0.01em] md:text-2xl">
            {introContent}
          </p>
        ) : null}
        <div className="mx-auto mt-12 grid w-full gap-x-8 gap-y-12 md:mt-18 lg:grid-cols-2">
          {features.map((feature, itemIndex) => {
            const ShapeIcon = SHAPE_ICONS[itemIndex % SHAPE_ICONS.length]!
            return (
              <div className="flex flex-col items-center gap-x-12 gap-y-6" key={itemIndex}>
                <div className="relative aspect-video w-full rounded-xl bg-linear-to-r from-indigo-400 to-orange-300 p-2">
                  <div className="size-full rounded-lg bg-card" />
                  <div className="absolute inset-0 isolate z-0" style={GRID_MASK_STYLE} />
                  <ShapeIcon className="absolute inset-0 isolate m-auto size-20" />
                </div>
                <div className="flex flex-1 basis-1/2 flex-col items-start">
                  <h4 className="mt-1 mb-2 font-medium text-2xl tracking-[-0.02em]">
                    {renderFeatureItemTitle(editSlots, feature.title, blockIndex, itemIndex)}
                  </h4>
                  {feature.description ? (
                    <div className="mb-6 text-lg text-muted-foreground">
                      {renderFeatureItemDescription(editSlots, feature.description, blockIndex, itemIndex, { literalPreview })}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function Features06Literal() {
  return (
    <Features06
      title={feature06Literal.title}
      intro={feature06Literal.intro}
      features={feature06Literal.features}
      blockIndex={0}
      literalPreview
    />
  )
}
