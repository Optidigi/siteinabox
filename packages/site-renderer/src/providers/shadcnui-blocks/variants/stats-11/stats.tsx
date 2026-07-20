// Owned typed adaptation of upstream shadcnui-blocks stats-11 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import { stats11CmsLike } from "../../typed/fixtures/stats-family"
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

export type Stats11Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  items: StatItem[]
}

export function Stats11({ title, intro, items, blockIndex, editSlots, rootAttributes }: Stats11Props) {
  const titleContent = renderStatsTitle(editSlots, title, blockIndex)
  const introContent = renderStatsIntro(editSlots, intro, blockIndex)
  const displayItems = sliceStatItems(items, MAX_ITEMS)

  return (
    <div className="w-full px-6" {...rootAttributes}>
      <div className="relative mx-auto my-20 max-w-5xl overflow-hidden rounded-2xl bg-muted px-6 py-16">
        {titleContent ? (
          <h2 className="text-balance text-center font-medium text-3xl tracking-[-0.04em] sm:text-4xl md:text-[2.75rem]">
            {titleContent}
          </h2>
        ) : null}
        {introContent ? (
          <p className="mt-4 text-center text-muted-foreground text-xl tracking-[-0.01em] sm:text-lg md:text-2xl">
            {introContent}
          </p>
        ) : null}

        <div className="mt-20 grid grid-cols-1 gap-4 gap-y-16 text-center sm:grid-cols-2 md:grid-cols-3">
          {displayItems.map((item, itemIndex) => {
            const valueContent = renderStatValue(editSlots, item.value, blockIndex, itemIndex)
            const labelContent = renderStatLabel(editSlots, item.label, blockIndex, itemIndex)
            if (!valueContent && !labelContent) return null
            return (
              <div key={itemIndex}>
                {valueContent ? (
                  <span className="font-medium text-5xl text-foreground">{valueContent}</span>
                ) : null}
                {labelContent ? <p className="mt-4 text-foreground/80 text-xl">{labelContent}</p> : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function Stats11Literal() {
  return (
    <Stats11
      title={stats11CmsLike.title}
      intro={stats11CmsLike.intro}
      items={stats11CmsLike.items}
      blockIndex={0}
    />
  )
}
