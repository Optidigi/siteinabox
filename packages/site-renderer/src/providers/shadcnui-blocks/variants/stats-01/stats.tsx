// Owned typed adaptation of upstream shadcnui-blocks stats-01 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import type { BlockEditSlots } from "../../../../blocks/types"
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

export type Stats01Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  items: StatItem[]
}

export function Stats01({ title, intro, items, blockIndex, editSlots, rootAttributes }: Stats01Props) {
  const titleContent = renderStatsTitle(editSlots, title, blockIndex)
  const introContent = renderStatsIntro(editSlots, intro, blockIndex)
  const displayItems = sliceStatItems(items, MAX_ITEMS)

  return (
    <div className="mx-auto max-w-(--breakpoint-lg) px-6 py-20 text-center" {...rootAttributes}>
      {titleContent ? (
        <h2 className="font-medium text-4xl tracking-[-0.04em] md:text-[2.75rem]">{titleContent}</h2>
      ) : null}
      {introContent ? <p className="mt-4 text-muted-foreground text-xl md:text-2xl">{introContent}</p> : null}

      <div className="mt-16 grid justify-center gap-x-12 gap-y-16 sm:mt-24 sm:grid-cols-2 lg:grid-cols-3">
        {displayItems.map((item, itemIndex) => {
          const valueContent = renderStatValue(editSlots, item.value, blockIndex, itemIndex)
          const labelContent = renderStatLabel(editSlots, item.label, blockIndex, itemIndex)
          if (!valueContent && !labelContent) return null
          return (
            <div key={itemIndex} className="max-w-3xs">
              {valueContent ? <span className="font-medium text-5xl">{valueContent}</span> : null}
              {labelContent ? <p className="mt-6 text-lg">{labelContent}</p> : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Stats01Literal() {
  return (
    <Stats01
      title={stats01Literal.title}
      intro={stats01Literal.intro}
      items={stats01Literal.items}
      blockIndex={0}
    />
  )
}
