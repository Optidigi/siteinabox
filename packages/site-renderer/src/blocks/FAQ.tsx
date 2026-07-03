import * as React from "react"
import type { FAQBlock } from "@siteinabox/contracts"
import { sectionAnalyticsAttrs } from "../analytics"
import { RichTextRenderer } from "../rich-text"
import { cx, nativeBlockClassName } from "./native-classes"
import type { BlockRenderOptions } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function FAQBlockRenderer({ block, options }: { block: FAQBlock; options: BlockRenderOptions }) {
  if (!block.items || block.items.length === 0) return null
  const sourceVariant = rendererVariantClassName(block)

  return (
    <section
      id={block.anchor || undefined}
      className={cx("cms-block cms-block--faq", sourceVariant, nativeBlockClassName(block, "section"))}
      data-source-variant={runtimeVariantDataAttribute(block)}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "faq", options.index)}
    >
      {block.title && (
        <h2 className={cx("cms-block__title", nativeBlockClassName(block, "title"))} style={{ fontFamily: "var(--font-heading)" }}>
          <RichTextRenderer value={block.title} />
        </h2>
      )}
      <dl className={cx("cms-block__faq-list", nativeBlockClassName(block, "list"))}>
        {block.items.map((item, i) => (
          <details key={i} className={cx("cms-block__faq-item", nativeBlockClassName(block, "item"))} style={{ borderRadius: "var(--radius-md)" }}>
            <summary className="cms-block__faq-question" style={{ fontFamily: "var(--font-heading)" }}>
              <RichTextRenderer value={item.question} />
            </summary>
            <div className="cms-block__faq-answer" style={{ fontFamily: "var(--font-text)" }}>
              <RichTextRenderer value={item.answer} />
            </div>
          </details>
        ))}
      </dl>
    </section>
  )
}
