// Owned typed adaptation of upstream shadcnui-blocks stats-02 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import { stats02CmsLike } from "../../typed/fixtures/stats-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import {
  renderStatDescription,
  renderStatLabel,
  renderStatsIntro,
  renderStatsTitle,
  renderStatValue,
  sliceStatItems,
  type StatItem,
} from "../../typed/stats-fields"

const MAX_ITEMS = 4

export type Stats02Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  items: StatItem[]
}

const valueClassName = (itemIndex: number) =>
  itemIndex === 1 || itemIndex === 3
    ? "font-medium text-5xl text-muted-foreground tracking-tight md:text-6xl"
    : "font-medium text-5xl tracking-tight md:text-6xl"

export function Stats02({ title, intro, items, blockIndex, editSlots, rootAttributes }: Stats02Props) {
  const titleContent = renderStatsTitle(editSlots, title, blockIndex)
  const introContent = renderStatsIntro(editSlots, intro, blockIndex)
  const displayItems = sliceStatItems(items, MAX_ITEMS)

  return (
    <div className="py-20" {...rootAttributes}>
      <div className="mx-auto w-full max-w-(--breakpoint-xl) px-6 py-12 xl:px-0">
        {titleContent ? (
          <h2 className="font-medium text-4xl tracking-[-0.04em] md:text-[2.75rem]">{titleContent}</h2>
        ) : null}
        {introContent ? (
          <p className="mt-4.5 max-w-2xl text-lg text-muted-foreground md:text-xl">{introContent}</p>
        ) : null}

        <div className="mt-16 grid justify-center gap-x-10 gap-y-16 sm:mt-24 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {displayItems.map((item, itemIndex) => {
            const valueContent = renderStatValue(editSlots, item.value, blockIndex, itemIndex)
            const labelContent = renderStatLabel(editSlots, item.label, blockIndex, itemIndex)
            const descriptionContent = renderStatDescription(editSlots, item.description, blockIndex, itemIndex)
            if (!valueContent && !labelContent && !descriptionContent) return null
            return (
              <div key={itemIndex}>
                {valueContent ? <span className={valueClassName(itemIndex)}>{valueContent}</span> : null}
                {labelContent ? <p className="mt-6 font-medium text-xl">{labelContent}</p> : null}
                {descriptionContent ? <p className="mt-2 text-muted-foreground">{descriptionContent}</p> : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function Stats02Literal() {
  return (
    <Stats02
      title={stats02CmsLike.title}
      intro={stats02CmsLike.intro}
      items={stats02CmsLike.items}
      blockIndex={0}
    />
  )
}
