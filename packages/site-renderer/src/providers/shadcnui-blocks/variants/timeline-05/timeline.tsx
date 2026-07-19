// Owned typed adaptation of upstream shadcnui-blocks timeline-05 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import { timeline05Literal } from "../../typed/fixtures/timeline-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import {
  renderTimelineItemDescription,
  renderTimelineItemTitle,
  sliceTimelineItems,
  type TimelineItem,
} from "../../typed/timeline-fields"

const MAX_ITEMS = 12

export type Timeline05Props = TypedVariantBaseProps & { items: TimelineItem[] }

export function Timeline05({ items, blockIndex, editSlots, rootAttributes }: Timeline05Props) {
  const displayItems = sliceTimelineItems(items, MAX_ITEMS)

  return (
    <div className="mx-auto max-w-(--breakpoint-sm) px-6 py-12 md:py-20" {...rootAttributes}>
      <div className="relative ml-6">
        <div className="absolute inset-y-0 left-0 border-l" />
        {displayItems.map((item, itemIndex) => {
          const title = renderTimelineItemTitle(editSlots, item.title, blockIndex, itemIndex)
          const description = renderTimelineItemDescription(editSlots, item.description, blockIndex, itemIndex)
          if (!title && !description) return null
          return (
            <div className="relative pb-10 pl-10 last:pb-0" key={itemIndex}>
              <div className="absolute left-px flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-muted-foreground/40 bg-accent ring-8 ring-background">
                <span className="font-medium text-lg">{itemIndex + 1}</span>
              </div>
              <div className="space-y-1.5 pt-1">
                {title ? <h3 className="font-medium text-xl tracking-[-0.01em]">{title}</h3> : null}
                {description ? <p className="text-lg text-muted-foreground">{description}</p> : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Timeline05Literal() {
  return <Timeline05 items={timeline05Literal.items} blockIndex={0} />
}
