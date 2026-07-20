// Owned typed adaptation of upstream shadcnui-blocks features-14 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import { ArrowUpRightIcon, BinocularsIcon, CogIcon, ShieldCheckIcon, type LucideIcon } from "lucide-react"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import {
  featureItemIcon,
  renderFeatureEyebrow,
  renderFeatureIntro,
  renderFeatureItemCta,
  renderFeatureItemDescription,
  renderFeatureItemTitle,
  renderFeatureTitle,
  type FeatureItem,
} from "../../typed/feature-fields"
import { feature14Literal } from "../../typed/fixtures/feature-family"
import type { TypedVariantBaseProps } from "../../typed/props"

const ITEM_ICONS: LucideIcon[] = [ShieldCheckIcon, CogIcon, BinocularsIcon]

const BackgroundPattern = () => (
  <div
    className="absolute inset-0 -top-px -left-px"
    style={{
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
            radial-gradient(ellipse 70% 60% at 50% 0%, #000 60%, transparent 100%)
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
            radial-gradient(ellipse 70% 60% at 50% 0%, #000 60%, transparent 100%)
      `,
      maskComposite: "intersect",
      WebkitMaskComposite: "source-in",
    }}
  />
)

export type Features14Props = TypedVariantBaseProps & {
  eyebrow?: RtRoot | null
  title?: RtRoot | null
  intro?: RtRoot | null
  features: FeatureItem[]
}

export function Features14({ eyebrow, title, intro, features, blockIndex, editSlots, rootAttributes }: Features14Props) {
  const eyebrowContent = renderFeatureEyebrow(editSlots, eyebrow, blockIndex)
  const titleContent = renderFeatureTitle(editSlots, title, blockIndex)
  const introContent = renderFeatureIntro(editSlots, intro, blockIndex)

  return (
    <div className="mx-auto max-w-(--breakpoint-xl) px-6 py-24 text-center" id="why-choose-us" {...rootAttributes}>
      {eyebrowContent ? (
        <strong className="font-medium text-muted-foreground text-sm uppercase tracking-wide">{eyebrowContent}</strong>
      ) : null}
      {titleContent ? (
        <h2 className="mx-auto mt-5 max-w-4xl text-balance font-medium text-4xl/tight tracking-[-0.04em] sm:text-[2.75rem]">
          {titleContent}
        </h2>
      ) : null}
      {introContent ? (
        <p className="mt-5 text-muted-foreground text-xl -tracking-[0.01em] sm:text-2xl">{introContent}</p>
      ) : null}
      <div className="mt-16 flex flex-wrap justify-center gap-4">
        {features.map((feature, itemIndex) => {
          const Icon = featureItemIcon(feature.icon, ITEM_ICONS, itemIndex)
          return (
            <div
              className="relative w-full overflow-hidden rounded-lg border bg-linear-to-b from-foreground/3 px-6 py-10 sm:max-w-xs border-border"
              key={itemIndex}
            >
              <BackgroundPattern />
              <div className="isolate flex flex-col items-center gap-2">
                {Icon ? <Icon className="size-14 stroke-[1.5px] text-foreground" /> : null}
                <h3 className="mt-8 font-medium text-xl tracking-[-0.005em]">
                  {renderFeatureItemTitle(editSlots, feature.title, blockIndex, itemIndex)}
                </h3>
                {feature.description ? (
                  <div className="text-balance text-base text-muted-foreground">
                    {renderFeatureItemDescription(editSlots, feature.description, blockIndex, itemIndex)}
                  </div>
                ) : null}
                <Button className="mt-6">
                  {feature.cta?.label && feature.cta.href ? (
                    renderFeatureItemCta(editSlots, feature.cta, blockIndex, itemIndex, {
                      trailingIcon: <ArrowUpRightIcon />,
                    })
                  ) : (
                    <>
                      Learn More <ArrowUpRightIcon />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Features14Literal() {
  return (
    <Features14
      eyebrow={feature14Literal.eyebrow}
      title={feature14Literal.title}
      intro={feature14Literal.intro}
      features={feature14Literal.features}
      blockIndex={0}
    />
  )
}
