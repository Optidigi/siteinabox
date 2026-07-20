// Owned typed adaptation of upstream shadcnui-blocks features-18 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import {
  ArrowUpRightIcon,
  BinocularsIcon,
  GlobeIcon,
  HouseIcon,
  LockIcon,
  ShieldCheckIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { cn } from "@siteinabox/ui/lib/utils"
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
import { feature18Literal } from "../../typed/fixtures/feature-family"
import type { TypedVariantBaseProps } from "../../typed/props"

const ITEM_ICONS: LucideIcon[] = [
  ShieldCheckIcon,
  ZapIcon,
  BinocularsIcon,
  HouseIcon,
  GlobeIcon,
  LockIcon,
]

export type Features18Props = TypedVariantBaseProps & {
  eyebrow?: RtRoot | null
  title?: RtRoot | null
  intro?: RtRoot | null
  features: FeatureItem[]
  literalPreview?: boolean
}

export function Features18({ eyebrow, title, intro, features, blockIndex, editSlots, rootAttributes, literalPreview = false }: Features18Props) {
  const eyebrowContent = renderFeatureEyebrow(editSlots, eyebrow, blockIndex)
  const titleContent = renderFeatureTitle(editSlots, title, blockIndex)
  const introContent = renderFeatureIntro(editSlots, intro, blockIndex)

  return (
    <div
      className="mx-auto max-w-(--breakpoint-xl) overflow-clip px-8 py-24 text-center"
      id="why-choose-us"
      {...rootAttributes}
    >
      {eyebrowContent ? (
        <strong className="font-medium text-muted-foreground text-sm uppercase tracking-wide">{eyebrowContent}</strong>
      ) : null}
      {titleContent ? (
        <h2 className="mx-auto mt-5 max-w-4xl text-balance font-medium text-4xl leading-[1.3] tracking-[-0.04em] sm:text-[2.75rem]">
          {titleContent}
        </h2>
      ) : null}
      {introContent ? (
        <p className="mt-4 text-pretty text-muted-foreground text-xl -tracking-[0.01em] sm:text-2xl">{introContent}</p>
      ) : null}
      <div className="relative mx-auto mt-16 grid max-w-5xl grid-cols-1 border nth-3:border sm:grid-cols-2 lg:grid-cols-3 border-border">
        <div className="mask-y-from-95% absolute -inset-y-14 left-0 -translate-x-px border-s border-dashed border-border" />
        <div className="mask-y-from-95% absolute -inset-y-14 right-0 translate-x-px border-s border-dashed border-border" />
        <div className="mask-x-from-95% absolute -inset-x-14 top-0 -translate-y-px border-t border-dashed border-border" />
        <div className="mask-x-from-95% absolute -inset-x-14 bottom-0 translate-y-px border-b border-dashed border-border" />
        {features.map((feature, itemIndex) => {
          const Icon = featureItemIcon(feature.icon, ITEM_ICONS, itemIndex)
          return (
            <div
              className={cn(
                "relative -mt-px flex w-full flex-col items-center gap-2 border-t p-6 pt-9 odd:bg-muted/40 border-border",
                "lg:not-[&:nth-child(3n+1)]:border-e",
                "max-sm:odd:border-e-0 max-lg:odd:border-e",
              )}
              key={itemIndex}
            >
              {Icon ? (
                <Icon className="size-12 fill-foreground/10 stroke-[1.5px] text-foreground" />
              ) : null}
              <h3 className="mt-6 font-medium text-lg tracking-[-0.005em]">
                {renderFeatureItemTitle(editSlots, feature.title, blockIndex, itemIndex)}
              </h3>
              {feature.description ? (
                <div className="mb-6 text-balance text-muted-foreground">
                  {renderFeatureItemDescription(editSlots, feature.description, blockIndex, itemIndex, { literalPreview })}
                </div>
              ) : null}
              <Button className="mt-auto font-medium" variant="link">
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
          )
        })}
      </div>
    </div>
  )
}

export default function Features18Literal() {
  return (
    <Features18
      eyebrow={feature18Literal.eyebrow}
      title={feature18Literal.title}
      intro={feature18Literal.intro}
      features={feature18Literal.features}
      blockIndex={0}
      literalPreview
    />
  )
}
