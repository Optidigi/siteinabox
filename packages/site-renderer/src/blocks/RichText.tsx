import * as React from "react"
import type { RichTextBlock } from "@siteinabox/contracts"
import { sectionAnalyticsAttrs } from "../analytics"
import { RichTextRenderer } from "../rich-text"
import { resolveBlockAnchor } from "./anchors"
import { cx, nativeBlockClassName } from "./native-classes"
import type { BlockRenderOptions } from "./types"
import { mergeRendererSectionProps } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function RichTextBlockRenderer({ block, options }: { block: RichTextBlock; options: BlockRenderOptions }) {
  const renderSlot = options.slots?.render
  if (!block.body && !renderSlot) return null
  const sourceVariant = rendererVariantClassName(block, options.variantContext)
  const sectionProps = mergeRendererSectionProps(
    {
      id: resolveBlockAnchor(block, { legacyTenant: options.variantContext?.legacyTenant, surface: options.surface }),
      className: cx("cms-block cms-block--richtext", sourceVariant, nativeBlockClassName(block, "section", options.variantContext)),
      "data-source-variant": runtimeVariantDataAttribute(block, options.variantContext),
      "data-block-index": options.index,
      ...sectionAnalyticsAttrs(block.analytics, "richText", options.index),
    },
    options.sectionProps,
  )
  const body = renderSlot
    ? renderSlot({
      kind: "richtext",
      value: block.body,
      path: { blockIndex: options.index, field: "body" },
      variant: "block",
      as: "div",
      className: cx("cms-block__richtext-body", nativeBlockClassName(block, "body", options.variantContext)),
      placeholder: "Body",
      style: { fontFamily: "var(--font-text)" },
    })
    : (
      <div className={cx("cms-block__richtext-body", nativeBlockClassName(block, "body", options.variantContext))} style={{ fontFamily: "var(--font-text)" }}>
        <RichTextRenderer value={block.body} />
      </div>
    )

  return (
    <section {...sectionProps}>
      {body}
    </section>
  )
}
