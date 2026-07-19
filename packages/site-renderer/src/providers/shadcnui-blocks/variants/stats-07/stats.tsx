// Owned typed adaptation of upstream shadcnui-blocks stats-07 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import { cn } from "@siteinabox/ui/lib/utils"
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
const itemClassName = (itemIndex: number) =>
  itemIndex === 2 ? "bg-background p-10 sm:col-span-2 md:col-span-1" : "bg-background p-10"

export type Stats07Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  items: StatItem[]
}

export function Stats07({ title, intro, items, blockIndex, editSlots, rootAttributes }: Stats07Props) {
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

      <div className="mt-14 rounded-2xl border bg-muted p-1">
        <div
          className={cn(
            "grid grid-cols-1 gap-1 overflow-hidden rounded-xl sm:grid-cols-2 md:grid-cols-3",
            "*:rounded *:border *:first:rounded-t-xl *:last:rounded-b-xl sm:*:nth-2:rounded-tr-xl sm:*:first:rounded-tl-xl sm:*:first:rounded-tr md:*:nth-2:rounded-tr md:*:last:rounded-e-xl md:*:last:rounded-bl md:*:first:rounded-s-xl dark:*:border-foreground/20",
          )}
        >
          {displayItems.map((item, itemIndex) => {
            const valueContent = renderStatValue(editSlots, item.value, blockIndex, itemIndex)
            const labelContent = renderStatLabel(editSlots, item.label, blockIndex, itemIndex)
            if (!valueContent && !labelContent) return null
            return (
              <div key={itemIndex} className={itemClassName(itemIndex)}>
                {valueContent ? <span className="font-medium text-5xl">{valueContent}</span> : null}
                {labelContent ? <p className="mt-4 text-foreground/80 text-xl">{labelContent}</p> : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function Stats07Literal() {
  return (
    <Stats07
      title={statsFamilyCmsLike.title}
      intro={statsFamilyCmsLike.intro}
      items={statsFamilyCmsLike.items}
      blockIndex={0}
    />
  )
}
