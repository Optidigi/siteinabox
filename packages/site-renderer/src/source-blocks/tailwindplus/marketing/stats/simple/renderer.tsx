import * as React from "react"
import type { StatsBlock } from "@siteinabox/contracts"
import { sectionAnalyticsAttrs } from "../../../../../analytics"
import { mergeRendererSectionAttributes } from "../../../../../blocks/section-attributes"
import type { BlockRenderOptions } from "../../../../../blocks/types"

export function TailwindPlusMarketingStatsSimpleRenderer({
  block,
  options,
}: {
  block: StatsBlock
  options: BlockRenderOptions
}) {
  const slots = options.editSlots
  const sectionProps = mergeRendererSectionAttributes(
    {
      id: block.anchor || undefined,
      className: "bg-white py-24 sm:py-32 cms-block cms-block--stats cms-block--source-tailwindplus-stats-simple",
      "data-source-variant": "tailwindplus.marketing.stats.simple",
      "data-block-index": options.index,
      ...sectionAnalyticsAttrs(block.analytics, "stats", options.index),
    },
    options.sectionAttributes,
  )

  return (
    <section {...sectionProps}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <dl className="grid grid-cols-1 gap-x-8 gap-y-16 text-center lg:grid-cols-3">
          {block.items.slice(0, 3).map((item, index) => (
            <div key={index} className="mx-auto flex max-w-xs flex-col gap-y-4">
              <dt className="text-base/7 text-gray-600">
                {slots?.renderText
                  ? slots.renderText({
                    name: "stats.itemLabel",
                    value: item.label,
                    className: "contents",
                    placeholder: "Stat label",
                    elementPath: { blockIndex: options.index, field: "items", itemIndex: index, subField: "label" },
                  })
                  : item.label}
              </dt>
              <dd className="order-first text-3xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
                {slots?.renderText
                  ? slots.renderText({
                    name: "stats.itemValue",
                    value: item.value,
                    className: "contents",
                    placeholder: "Stat value",
                    elementPath: { blockIndex: options.index, field: "items", itemIndex: index, subField: "value" },
                  })
                  : item.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
