// Owned typed adaptation of upstream shadcnui-blocks stats-10 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import { ArrowUpRightIcon } from "lucide-react"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { previewInlineText } from "../../typed/fixtures"
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

export type Stats10Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  items: StatItem[]
  showDemoCta?: boolean
}

export function Stats10({
  title,
  intro,
  items,
  blockIndex,
  editSlots,
  rootAttributes,
  showDemoCta = false,
}: Stats10Props) {
  const titleContent = renderStatsTitle(editSlots, title, blockIndex)
  const introContent = renderStatsIntro(editSlots, intro, blockIndex)
  const displayItems = sliceStatItems(items, MAX_ITEMS)

  return (
    <div className="mx-auto flex max-w-5xl flex-col items-start gap-14 px-6 py-20 sm:gap-10 md:flex-row" {...rootAttributes}>
      <div className="max-w-md lg:max-w-lg">
        {titleContent ? (
          <h2 className="font-medium text-4xl tracking-[-0.04em] md:text-[2.75rem]">{titleContent}</h2>
        ) : null}
        {introContent ? (
          <p className="mt-3.5 text-muted-foreground text-xl tracking-[-0.01em] md:text-2xl/normal">{introContent}</p>
        ) : null}
        {showDemoCta ? (
          <Button className="mt-8 sm:mt-10" size="lg">
            View all stats <ArrowUpRightIcon />
          </Button>
        ) : null}
      </div>

      <div className="grow space-y-4 *:space-y-3 *:rounded-xl *:bg-muted *:p-6 dark:*:bg-muted/70">
        {displayItems.map((item, itemIndex) => {
          const valueContent = renderStatValue(editSlots, item.value, blockIndex, itemIndex)
          const labelContent = renderStatLabel(editSlots, item.label, blockIndex, itemIndex)
          if (!valueContent && !labelContent) return null
          return (
            <div key={itemIndex}>
              {valueContent ? <div className="font-medium text-5xl">{valueContent}</div> : null}
              {labelContent ? <p className="text-foreground/80 text-lg">{labelContent}</p> : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Stats10Literal() {
  return (
    <Stats10
      title={previewInlineText("Numbers that matter")}
      intro={previewInlineText(
        "Continuously improving with feedback from developers building modern applications.",
      )}
      items={stats01Literal.items}
      blockIndex={0}
      showDemoCta
    />
  )
}
