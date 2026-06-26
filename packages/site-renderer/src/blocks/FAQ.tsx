import * as React from "react"
import type { FAQBlock } from "@siteinabox/contracts"
import { sectionAnalyticsAttrs } from "../analytics"
import { RichTextRenderer } from "../rich-text"
import type { BlockRenderOptions } from "./types"

export function FAQBlockRenderer({ block, options }: { block: FAQBlock; options: BlockRenderOptions }) {
  if (!block.items || block.items.length === 0) return null
  const sourceVariant = block.analytics?.sectionVariant === "mamba-faq-1" ? "cms-block--source-mamba-faq-1" : ""

  return (
    <section
      id={block.anchor || undefined}
      className={`cms-block cms-block--faq ${sourceVariant}`.trim()}
      data-source-variant={block.analytics?.sectionVariant || undefined}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "faq", options.index)}
    >
      {block.title && (
        <h2 className="cms-block__title" style={{ fontFamily: "var(--font-heading)" }}>
          <RichTextRenderer value={block.title} />
        </h2>
      )}
      <dl className="cms-block__faq-list">
        {block.items.map((item, i) => (
          <details key={i} className="cms-block__faq-item" style={{ borderRadius: "var(--radius-md)" }}>
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
