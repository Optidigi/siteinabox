import * as React from "react"
import type { RichTextBlock } from "@siteinabox/contracts"
import { sectionAnalyticsAttrs } from "../analytics"
import { RichTextRenderer } from "../rich-text"
import type { BlockRenderOptions } from "./types"

export function RichTextBlockRenderer({ block, options }: { block: RichTextBlock; options: BlockRenderOptions }) {
  if (!block.body) return null
  const sourceVariant = block.analytics?.sectionVariant === "tailblocks-content-a" ? "cms-block--source-tailblocks-content-a" : ""

  return (
    <section
      id={block.anchor || undefined}
      className={`cms-block cms-block--richtext ${sourceVariant}`.trim()}
      data-source-variant={block.analytics?.sectionVariant || undefined}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "richText", options.index)}
    >
      <div className="cms-block__richtext-body" style={{ fontFamily: "var(--font-text)" }}>
        <RichTextRenderer value={block.body} />
      </div>
    </section>
  )
}
