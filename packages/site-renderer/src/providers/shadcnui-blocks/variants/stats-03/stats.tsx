// Owned typed adaptation of upstream shadcnui-blocks stats-03 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import type { BlockEditSlots } from "../../../../blocks/types"
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

export type Stats03Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  items: StatItem[]
}

export function Stats03({ title, intro, items, blockIndex, editSlots, rootAttributes }: Stats03Props) {
  const titleContent = renderStatsTitle(editSlots, title, blockIndex)
  const introContent = renderStatsIntro(editSlots, intro, blockIndex)
  const displayItems = sliceStatItems(items, MAX_ITEMS)

  return (
    <div className="mx-auto max-w-5xl px-6 py-20" {...rootAttributes}>
      {titleContent ? (
        <h2 className="text-balance text-center font-medium text-3xl tracking-[-0.04em] sm:text-4xl md:text-[2.75rem]">
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
          const valueContent = renderStatValue(editSlots, item.value, blockIndex, itemIndex)
          const labelContent = renderStatLabel(editSlots, item.label, blockIndex, itemIndex)
          if (!valueContent && !labelContent) return null
          return (
            <div key={itemIndex} className="rounded-xl border px-8 py-10">
              {valueContent ? <span className="font-medium text-5xl">{valueContent}</span> : null}
              {labelContent ? <p className="mt-4 text-foreground/80 text-xl">{labelContent}</p> : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Stats03Literal() {
  return (
    <Stats03
      title={statsFamilyCmsLike.title}
      intro={statsFamilyCmsLike.intro}
      items={statsFamilyCmsLike.items}
      blockIndex={0}
    />
  )
}
