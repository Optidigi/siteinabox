// Owned typed adaptation of upstream shadcnui-blocks features-01 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import {
  Blocks,
  Bot,
  ChartPie,
  Film,
  MessageCircle,
  Settings2,
  type LucideIcon,
} from "lucide-react"
import {
  type FeatureItem,
  renderFeatureIntro,
  renderFeatureItemIcon,
  renderFeatureItemDescription,
  renderFeatureItemTitle,
  renderFeatureTitle,
} from "../../typed/feature-fields"
import { feature01Literal } from "../../typed/fixtures/feature-family"
import type { TypedVariantBaseProps } from "../../typed/props"

const ITEM_ICONS: LucideIcon[] = [Settings2, Blocks, Bot, Film, ChartPie, MessageCircle]

export type Features01Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  features: FeatureItem[]
}

export function Features01({ title, intro, features, blockIndex, editSlots, rootAttributes }: Features01Props) {
  const titleContent = renderFeatureTitle(editSlots, title, blockIndex)
  const introContent = renderFeatureIntro(editSlots, intro, blockIndex)

  return (
    <div className="px-6 py-20" {...rootAttributes}>
      {titleContent ? (
        <h2 className="mx-auto max-w-3xl text-center font-medium text-4xl tracking-[-0.045em] sm:text-[2.75rem]">
          {titleContent}
        </h2>
      ) : null}
      {introContent ? (
        <div className="mt-3 text-pretty text-center text-lg text-muted-foreground tracking-[-0.01em] sm:text-2xl">
          {introContent}
        </div>
      ) : null}
      <div className="mx-auto mt-10 grid max-w-(--breakpoint-lg) gap-6 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, itemIndex) => {
          const icon = renderFeatureItemIcon(editSlots, feature.icon, ITEM_ICONS, blockIndex, itemIndex, { className: "size-5" })
          return (
            <div className="flex flex-col rounded-xl border bg-card p-6 border-border" key={itemIndex}>
              {icon ? (
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  {icon}
                </div>
              ) : null}
              <span className="font-medium text-lg">
                {renderFeatureItemTitle(editSlots, feature.title, blockIndex, itemIndex)}
              </span>
              {feature.description ? (
                <div className="mt-1 text-[15px] text-foreground/80">
                  {renderFeatureItemDescription(editSlots, feature.description, blockIndex, itemIndex)}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Features01Literal() {
  return (
    <Features01
      title={feature01Literal.title}
      intro={feature01Literal.intro}
      features={feature01Literal.features}
      blockIndex={0}
    />
  )
}
