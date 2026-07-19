// Owned typed adaptation of upstream shadcnui-blocks timeline-03 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import { Bot, Bug, Building2, Calendar, Database, type LucideIcon } from "lucide-react"
import { Badge } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { timeline01Literal } from "../../typed/fixtures/timeline-01"
import type { TypedVariantBaseProps } from "../../typed/props"
import {
  renderTimelineItemDate,
  renderTimelineItemDescription,
  renderTimelineItemLabel,
  renderTimelineItemTag,
  renderTimelineItemTitle,
  sliceTimelineItems,
  type TimelineItem,
} from "../../typed/timeline-fields"

const MAX_ITEMS = 12
const STEP_ICONS: LucideIcon[] = [Bot, Database, Bug]

export type Timeline03Props = TypedVariantBaseProps & { items: TimelineItem[] }

export function Timeline03({ items, blockIndex, editSlots, rootAttributes }: Timeline03Props) {
  const displayItems = sliceTimelineItems(items, MAX_ITEMS)

  return (
    <div className="mx-auto max-w-(--breakpoint-sm) px-6 py-12 md:py-20" {...rootAttributes}>
      <div className="relative ml-3">
        <div className="absolute inset-y-0 left-0 border-l-2" />
        {displayItems.map((item, itemIndex) => {
          const company = renderTimelineItemLabel(editSlots, item.label, blockIndex, itemIndex)
          const title = renderTimelineItemTitle(editSlots, item.title, blockIndex, itemIndex)
          const period = renderTimelineItemDate(editSlots, item.date, blockIndex, itemIndex)
          const description = renderTimelineItemDescription(editSlots, item.description, blockIndex, itemIndex)
          const tags = item.tags ?? []
          const StepIcon = STEP_ICONS[itemIndex % STEP_ICONS.length] ?? Building2
          if (!company && !title && !period && !description && tags.length === 0) return null
          return (
            <div className="relative pb-12 pl-10 last:pb-0" key={itemIndex}>
              <div className="absolute left-px flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full bg-background">
                <StepIcon className="h-5 w-5" />
              </div>
              <div className="space-y-3">
                {company ? (
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <span className="font-medium text-base">{company}</span>
                  </div>
                ) : null}
                <div>
                  {title ? <h3 className="font-medium text-xl tracking-[-0.01em]">{title}</h3> : null}
                  {period ? (
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4" />
                      <span>{period}</span>
                    </div>
                  ) : null}
                </div>
                {description ? (
                  <p className="text-pretty text-muted-foreground text-sm sm:text-base">{description}</p>
                ) : null}
                {tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag, tagIndex) => {
                      const tagContent = renderTimelineItemTag(editSlots, tag.value, blockIndex, itemIndex, tagIndex)
                      return tagContent ? (
                        <Badge className="rounded-full" key={tagIndex} variant="secondary">
                          {tagContent}
                        </Badge>
                      ) : null
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Timeline03Literal() {
  return <Timeline03 items={timeline01Literal.items} blockIndex={0} />
}
