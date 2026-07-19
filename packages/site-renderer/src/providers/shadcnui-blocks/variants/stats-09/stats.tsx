// Owned typed adaptation of upstream shadcnui-blocks stats-09 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import { cn } from "@siteinabox/ui/lib/utils"
import { stats01Literal } from "../../typed/fixtures/stats-01"
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
  itemIndex === 2
    ? "max-sm:space-y-6 max-sm:px-6 max-sm:py-12 sm:col-span-2 sm:divide-y lg:col-span-1"
    : "max-sm:space-y-6 max-sm:px-6 max-sm:py-12 sm:divide-y"

export type Stats09Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  items: StatItem[]
}

export function Stats09({ title, intro, items, blockIndex, editSlots, rootAttributes }: Stats09Props) {
  const titleContent = renderStatsTitle(editSlots, title, blockIndex)
  const introContent = renderStatsIntro(editSlots, intro, blockIndex)
  const displayItems = sliceStatItems(items, MAX_ITEMS)

  return (
    <div className="flex min-h-screen items-center justify-center" {...rootAttributes}>
      <div className="mx-auto max-w-(--breakpoint-xl) py-12 text-center">
        {titleContent ? (
          <h2 className="font-medium text-4xl tracking-[-0.04em] md:text-[2.75rem]">{titleContent}</h2>
        ) : null}
        {introContent ? <p className="mt-3.5 text-muted-foreground text-xl md:text-2xl">{introContent}</p> : null}

        <div className="px-6">
          <div
            className={cn(
              "mt-16 grid max-w-5xl justify-center gap-y-8 border max-sm:divide-y sm:mt-24 sm:grid-cols-2 sm:gap-y-0 lg:grid-cols-3 lg:divide-x",
              "sm:*:last:border-t sm:*:first:border-e lg:*:last:border-t-0",
            )}
          >
            {displayItems.map((item, itemIndex) => {
              const valueContent = renderStatValue(editSlots, item.value, blockIndex, itemIndex)
              const labelContent = renderStatLabel(editSlots, item.label, blockIndex, itemIndex)
              if (!valueContent && !labelContent) return null
              return (
                <div key={itemIndex} className={itemClassName(itemIndex)}>
                  {valueContent ? (
                    <div className="font-medium text-5xl sm:px-6 sm:py-12">{valueContent}</div>
                  ) : null}
                  {labelContent ? <p className="text-lg sm:p-6">{labelContent}</p> : null}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Stats09Literal() {
  return (
    <Stats09
      title={stats01Literal.title}
      intro={stats01Literal.intro}
      items={stats01Literal.items}
      blockIndex={0}
    />
  )
}
