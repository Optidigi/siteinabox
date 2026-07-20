// Owned typed adaptation of upstream shadcnui-blocks timeline-06 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@siteinabox/ui/lib/utils"
import { timeline06Literal } from "../../typed/fixtures/timeline-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import {
  isTimelineItemCompleted,
  renderTimelineItemDescription,
  renderTimelineItemTitle,
  sliceTimelineItems,
  type TimelineItem,
} from "../../typed/timeline-fields"

const MAX_ITEMS = 12

export type Timeline06Props = TypedVariantBaseProps & { items: TimelineItem[] }

export function Timeline06({ items, blockIndex, editSlots, rootAttributes }: Timeline06Props) {
  const displayItems = sliceTimelineItems(items, MAX_ITEMS)

  return (
    <div className="mx-auto max-w-(--breakpoint-sm) px-6 py-12 md:py-20" {...rootAttributes}>
      <div className="relative ml-6">
        <div className="absolute inset-y-0 left-0 border-l border-border" />
        {displayItems.map((item, itemIndex) => {
          const title = renderTimelineItemTitle(editSlots, item.title, blockIndex, itemIndex)
          const description = renderTimelineItemDescription(editSlots, item.description, blockIndex, itemIndex)
          const completed = isTimelineItemCompleted(item)
          if (!title && !description) return null
          return (
            <div className="relative pb-10 pl-10 last:pb-0" key={itemIndex}>
              <div
                className={cn(
                  "absolute left-px flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-muted-foreground/40 bg-accent ring-8 ring-background border-border",
                  completed ? "border-primary bg-primary text-primary-foreground" : undefined,
                )}
              >
                <span className="font-medium text-lg">
                  {completed ? <Check className="h-5 w-5" /> : itemIndex + 1}
                </span>
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

export default function Timeline06Literal() {
  return <Timeline06 items={timeline06Literal.items} blockIndex={0} />
}
