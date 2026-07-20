// Owned typed adaptation of upstream shadcnui-blocks stats-05 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import { FastForward, HeartHandshake, MonitorSmartphone } from "lucide-react"
import { statsFamilyCmsLike } from "../../typed/fixtures/stats-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import {
  renderStatLabel,
  renderStatsIntro,
  renderStatsTitle,
  renderStatValue,
  sliceStatItems,
  type StatItem,
} from "../../typed/stats-fields"

const MAX_ITEMS = 3
const ICONS = [MonitorSmartphone, FastForward, HeartHandshake] as const
const ICON_CLASS = [
  "mb-8 h-10 w-10 stroke-[1.75px] text-blue-500",
  "mb-8 h-10 w-10 stroke-[1.75px] text-green-600",
  "mb-8 h-10 w-10 stroke-[1.75px] text-red-500",
] as const

export type Stats05Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  items: StatItem[]
}

export function Stats05({ title, intro, items, blockIndex, editSlots, rootAttributes }: Stats05Props) {
  const titleContent = renderStatsTitle(editSlots, title, blockIndex)
  const introContent = renderStatsIntro(editSlots, intro, blockIndex)
  const displayItems = sliceStatItems(items, MAX_ITEMS)

  return (
    <div className="mx-auto max-w-5xl px-6 py-20" {...rootAttributes}>
      {titleContent ? (
        <h2 className="text-balance text-center font-medium text-4xl tracking-[-0.04em] md:text-[2.75rem]">
          {titleContent}
        </h2>
      ) : null}
      {introContent ? (
        <p className="mt-3.5 text-center text-muted-foreground text-xl tracking-[-0.015em] sm:text-lg md:text-2xl">
          {introContent}
        </p>
      ) : null}

      <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {displayItems.map((item, itemIndex) => {
          const Icon = ICONS[itemIndex]
          const valueContent = renderStatValue(editSlots, item.value, blockIndex, itemIndex)
          const labelContent = renderStatLabel(editSlots, item.label, blockIndex, itemIndex)
          if (!valueContent && !labelContent) return null
          return (
            <div key={itemIndex} className="rounded-xl border bg-muted p-6 py-7 border-border">
              {Icon ? <Icon className={ICON_CLASS[itemIndex]} /> : null}
              {valueContent ? (
                <span className="font-medium text-5xl tracking-[-0.01em]">{valueContent}</span>
              ) : null}
              {labelContent ? <p className="mt-4 text-foreground/80 text-xl">{labelContent}</p> : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Stats05Literal() {
  return (
    <Stats05
      title={statsFamilyCmsLike.title}
      intro={statsFamilyCmsLike.intro}
      items={statsFamilyCmsLike.items}
      blockIndex={0}
    />
  )
}
