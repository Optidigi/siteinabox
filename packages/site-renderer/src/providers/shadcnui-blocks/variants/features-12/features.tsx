// Owned typed adaptation of upstream shadcnui-blocks features-12 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import {
  ArrowUpRight,
  Cable,
  Code,
  Contrast,
  MonitorSmartphone,
  Smile,
  SquareDashedMousePointer,
  Zap,
  type LucideIcon,
} from "lucide-react"
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
import { feature12Literal } from "../../typed/fixtures/feature-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import { isExternalHref } from "../../typed/links"

const ITEM_ICONS: LucideIcon[] = [Zap, SquareDashedMousePointer, Code, MonitorSmartphone, Contrast, Cable]

export type Features12Props = TypedVariantBaseProps & {
  eyebrow?: RtRoot | null
  title?: RtRoot | null
  intro?: RtRoot | null
  features: FeatureItem[]
}

export function Features12({ eyebrow, title, intro, features, blockIndex, editSlots, rootAttributes }: Features12Props) {
  const titleContent = renderFeatureTitle(editSlots, title, blockIndex)
  const introContent = renderFeatureIntro(editSlots, intro, blockIndex)
  const eyebrowContent = renderFeatureEyebrow(editSlots, eyebrow, blockIndex)

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
      <div className="mt-20 grid grid-cols-1 bg-card sm:grid-cols-2 lg:grid-cols-3">
        <div className="-mr-px flex h-16 items-center border px-6 font-medium text-lg sm:col-span-2 md:col-span-1">
          {eyebrowContent ? (
            eyebrowContent
          ) : (
            <>
              <Smile className="mr-4 text-primary" /> Features that make you happy
            </>
          )}
        </div>
        <div className="-mr-px hidden h-16 border bg-[repeating-linear-gradient(315deg,var(--muted)_0,var(--muted)_1px,transparent_0,transparent_50%)] bg-size-[10px_10px] bg-fixed md:block lg:col-span-2" />
        {features.map((feature, itemIndex) => {
          const Icon = featureItemIcon(feature.icon, ITEM_ICONS, itemIndex)
          const cta = feature.cta
          const href = cta?.href?.trim() || "#"
          const external = cta?.external ?? isExternalHref(href)
          return (
            <div className="-mt-px -mr-px border border-border/75 px-5 pt-7 pb-5" key={itemIndex}>
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
                <div className="mt-4 text-foreground/80">
                  {renderFeatureItemDescription(editSlots, feature.description, blockIndex, itemIndex)}
                </div>
              ) : null}
              <Button asChild className="mt-4 px-0!" variant="link">
                {cta?.label && cta.href ? (
                  renderFeatureItemCta(editSlots, cta, blockIndex, itemIndex, { trailingIcon: <ArrowUpRight /> })
                ) : (
                  <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
                    Learn more <ArrowUpRight />
                  </a>
                )}
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Features12Literal() {
  return (
    <Features12
      eyebrow={feature12Literal.eyebrow}
      title={feature12Literal.title}
      intro={feature12Literal.intro}
      features={feature12Literal.features}
      blockIndex={0}
    />
  )
}
