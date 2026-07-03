import * as React from "react"
import type { RichTextBlock } from "@siteinabox/contracts"
import { sectionAnalyticsAttrs } from "../analytics"
import { RichTextRenderer } from "../rich-text"
import { cx, nativeBlockClassName } from "./native-classes"
import type { BlockRenderOptions } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function RichTextBlockRenderer({ block, options }: { block: RichTextBlock; options: BlockRenderOptions }) {
  if (!block.body) return null
  const sourceVariant = rendererVariantClassName(block)

  return (
    <section
      id={block.anchor || undefined}
      className={cx("cms-block cms-block--richtext", sourceVariant, nativeBlockClassName(block, "section"))}
      data-source-variant={runtimeVariantDataAttribute(block)}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "richText", options.index)}
    >
      <div className={cx("cms-block__richtext-body", nativeBlockClassName(block, "body"))} style={{ fontFamily: "var(--font-text)" }}>
        <RichTextRenderer value={block.body} />
      </div>
    </section>
  )
}
