import * as React from "react"
import type { FAQBlock } from "@siteinabox/contracts"
import { sectionAnalyticsAttrs } from "../analytics"
import { RichTextRenderer } from "../rich-text"
import { cx, nativeBlockClassName } from "./native-classes"
import type { BlockRenderOptions } from "./types"
import { mergeRendererSectionProps } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function FAQBlockRenderer({ block, options }: { block: FAQBlock; options: BlockRenderOptions }) {
  const renderSlot = options.slots?.render
  const isEditable = Boolean(renderSlot)
  if ((!block.items || block.items.length === 0) && !isEditable) return null
  const sourceVariant = rendererVariantClassName(block, options.variantContext)
  const items: FAQBlock["items"] = block.items && block.items.length > 0
    ? block.items
    : [{ question: undefined as any, answer: undefined as any }]
  const title = renderSlot
    ? renderSlot({
      kind: "richtext",
      value: block.title,
      path: { blockIndex: options.index, field: "title" },
      variant: "inline",
      as: "h2",
      className: cx("cms-block__title", nativeBlockClassName(block, "title", options.variantContext)),
      placeholder: "Section title",
      blockMode: "inline",
      style: { fontFamily: "var(--font-heading)" },
    })
    : block.title ? (
      <h2 className={cx("cms-block__title", nativeBlockClassName(block, "title", options.variantContext))} style={{ fontFamily: "var(--font-heading)" }}>
        <RichTextRenderer value={block.title} />
      </h2>
    ) : null
  const sectionProps = mergeRendererSectionProps(
    {
      id: block.anchor || undefined,
      className: cx("cms-block cms-block--faq", sourceVariant, nativeBlockClassName(block, "section", options.variantContext)),
      "data-source-variant": runtimeVariantDataAttribute(block, options.variantContext),
      "data-block-index": options.index,
      ...sectionAnalyticsAttrs(block.analytics, "faq", options.index),
    },
    options.sectionProps,
  )

  return (
    <section {...sectionProps}>
      {title}
      <dl className={cx("cms-block__faq-list", nativeBlockClassName(block, "list", options.variantContext))}>
        {items.map((item, i) => (
          <details key={i} className={cx("cms-block__faq-item", nativeBlockClassName(block, "item", options.variantContext))} style={{ borderRadius: "var(--radius-md)" }}>
            <summary className="cms-block__faq-question" style={{ fontFamily: "var(--font-heading)" }}>
              {renderSlot
                ? renderSlot({
                  kind: "richtext",
                  value: item.question,
                  path: { blockIndex: options.index, field: "items", itemIndex: i, subField: "question" },
                  variant: "inline",
                  as: "span",
                  placeholder: "Question",
                  blockMode: "inline",
                })
                : <RichTextRenderer value={item.question} />}
            </summary>
            <div className="cms-block__faq-answer" style={{ fontFamily: "var(--font-text)" }}>
              {renderSlot
                ? renderSlot({
                  kind: "richtext",
                  value: item.answer,
                  path: { blockIndex: options.index, field: "items", itemIndex: i, subField: "answer" },
                  variant: "block",
                  as: "div",
                  placeholder: "Answer",
                })
                : <RichTextRenderer value={item.answer} />}
            </div>
          </details>
        ))}
      </dl>
    </section>
  )
}
