// Owned typed adaptation of upstream shadcnui-blocks features-11 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import { ArrowUpRight, Cable, Code, Contrast, MonitorSmartphone, SquareDashedMousePointer, Zap, type LucideIcon } from "lucide-react"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import {
  renderFeatureItemIcon,
  renderFeatureIntro,
  renderFeatureItemCta,
  renderFeatureItemDescription,
  renderFeatureItemTitle,
  renderFeatureTitle,
  type FeatureItem,
} from "../../typed/feature-fields"
import { feature11Literal } from "../../typed/fixtures/feature-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import { isExternalHref } from "../../typed/links"

const ITEM_ICONS: LucideIcon[] = [Zap, SquareDashedMousePointer, Code, MonitorSmartphone, Contrast, Cable]

export type Features11Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  features: FeatureItem[]
  literalPreview?: boolean
}

export function Features11({
  title,
  intro,
  features,
  blockIndex,
  editSlots,
  rootAttributes,
  literalPreview = false,
}: Features11Props) {
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
      <div className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, itemIndex) => {
          const icon = renderFeatureItemIcon(editSlots, feature.icon, ITEM_ICONS, blockIndex, itemIndex, { className: "h-5 w-5" })
          const cta = feature.cta
          const href = cta?.href?.trim() || "#"
          const external = cta?.external ?? isExternalHref(href)
          return (
            <div
              className="rounded-xl border border-border/45 bg-muted/75 p-1 shadow-xs/3 dark:border-border/65"
              key={itemIndex}
            >
              <div className="flex h-full flex-col rounded-lg border border-border/75 bg-card px-6 py-7 shadow-xs/1 dark:border-foreground/13">
                <div className="flex items-center gap-3">
                  {icon ? (
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/7 text-primary dark:bg-primary/10">
                      {icon}
                    </div>
                  ) : null}
                  <h3 className="font-medium text-lg tracking-[-0.005em]">
                    {renderFeatureItemTitle(editSlots, feature.title, blockIndex, itemIndex)}
                  </h3>
                </div>
                {feature.description ? (
                  <div className="my-4 text-foreground/80">
                    {renderFeatureItemDescription(editSlots, feature.description, blockIndex, itemIndex, { literalPreview })}
                  </div>
                ) : null}
                {cta?.label && cta.href && !literalPreview ? (
                  <Button asChild className="me-auto mt-2" size="sm" variant="secondary">
                    {renderFeatureItemCta(editSlots, cta, blockIndex, itemIndex, { trailingIcon: <ArrowUpRight /> })}
                  </Button>
                ) : (
                  <Button asChild className="me-auto mt-2" size="sm" variant="secondary">
                    <a
                      href={literalPreview ? "#" : href}
                      target={literalPreview || external ? "_blank" : undefined}
                      rel={literalPreview || external ? "noreferrer" : undefined}
                    >
                      Learn more <ArrowUpRight />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Features11Literal() {
  return (
    <Features11
      title={feature11Literal.title}
      intro={feature11Literal.intro}
      features={feature11Literal.features}
      blockIndex={0}
      literalPreview
    />
  )
}
