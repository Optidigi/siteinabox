import * as React from "react"
import type { RichTextBlock } from "@siteinabox/contracts"
import { sectionAnalyticsAttrs } from "../analytics"
import { RichTextRenderer } from "../rich-text"
import { cx, nativeBlockClassName } from "./native-classes"
import { mergeRendererSectionAttributes } from "./section-attributes"
import type { BlockRenderOptions } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function RichTextBlockRenderer({ block, options }: { block: RichTextBlock; options: BlockRenderOptions }) {
  if (!block.body && !options.editSlots) return null
  const sourceVariant = rendererVariantClassName(block)
  const slots = options.editSlots
  const sectionProps = mergeRendererSectionAttributes(
    {
      id: block.anchor || undefined,
      className: cx("cms-block cms-block--richtext", sourceVariant, nativeBlockClassName(block, "section")),
      "data-source-variant": runtimeVariantDataAttribute(block),
      "data-block-index": options.index,
      ...sectionAnalyticsAttrs(block.analytics, "richText", options.index),
    },
    options.sectionAttributes,
  )

  return (
    <section {...sectionProps}>
      <div className={cx("cms-block__richtext-body", nativeBlockClassName(block, "body"))} style={{ fontFamily: "var(--font-text)" }}>
        {slots?.renderRichText
          ? slots.renderRichText({
            name: "richText.body",
            value: block.body,
            variant: "block",
            elementPath: { blockIndex: options.index, field: "body" },
            allowFontFamily: true,
          })
          : <RichTextRenderer value={block.body} />}
      </div>
    </section>
  )
}
