// Owned typed adaptation of upstream shadcnui-blocks timeline-07 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import { timeline07Literal } from "../../typed/fixtures/timeline-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import {
  renderTimelineItemDate,
  renderTimelineItemDescription,
  renderTimelineItemLabel,
  renderTimelineItemTitle,
  sliceTimelineItems,
  type TimelineItem,
} from "../../typed/timeline-fields"

const MAX_ITEMS = 12

export type Timeline07Props = TypedVariantBaseProps & { items: TimelineItem[] }

export function Timeline07({ items, blockIndex, editSlots, rootAttributes }: Timeline07Props) {
  const displayItems = sliceTimelineItems(items, MAX_ITEMS)

  return (
    <div className="max-w-(--breakpoint-sm) px-6 py-12 md:mx-auto md:py-20" {...rootAttributes}>
      <div className="relative">
        {displayItems.map((item, itemIndex) => {
          const title = renderTimelineItemTitle(editSlots, item.title, blockIndex, itemIndex)
          const description = renderTimelineItemDescription(editSlots, item.description, blockIndex, itemIndex)
          const version = renderTimelineItemLabel(editSlots, item.label, blockIndex, itemIndex)
          const date = renderTimelineItemDate(editSlots, item.date, blockIndex, itemIndex)
          if (!title && !description && !version && !date) return null
          return (
            <div className="group relative" key={itemIndex}>
              <div className="flex items-start">
                <div className="mt-3 mr-5 flex w-[75px] shrink-0 flex-col gap-2 text-end sm:w-[90px]">
                  {version ? <h6 className="font-semibold text-primary text-sm">v{version}</h6> : null}
                  {date ? <span className="text-muted-foreground text-xs sm:text-sm">{date}</span> : null}
                </div>
                <div className="relative space-y-1 border-l pb-10 pl-6 group-last:pb-4 sm:pl-8 border-border">
                  <div className="absolute top-4 -left-px h-3 w-3 -translate-x-1/2 rounded-full border-2 border-primary bg-background" />
                  {title ? <h3 className="mt-2 font-medium text-lg tracking-[-0.01em]">{title}</h3> : null}
                  {description ? (
                    <p className="text-muted-foreground text-sm sm:text-base">{description}</p>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Timeline07Literal() {
  return <Timeline07 items={timeline07Literal.items} blockIndex={0} />
}
