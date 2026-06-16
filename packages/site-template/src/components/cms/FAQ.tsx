import { RtNodeRenderer } from "./RtNodeRenderer"
import { BlockErrorBoundary } from "./BlockErrorBoundary"
import { sectionAnalyticsAttrs } from "./analytics"
import type { AnalyticsBlockMetadata, RtRoot } from "../../lib/types"

/**
 * FAQ block renderer (Preact). Structure-only.
 * Props mirror siab-payload/src/blocks/FAQ.ts.
 * title is optional RtRoot (inline variant). Each item's question + answer are RtRoot.
 */
export type FAQProps = {
  anchor?: string | null
  title?: RtRoot | null
  items: Array<{
    question: RtRoot
    answer: RtRoot
  }>
  dataBlockIndex?: number
  analytics?: AnalyticsBlockMetadata | null
}

export default function FAQ(props: FAQProps) {
  const { anchor, title, items, dataBlockIndex, analytics } = props
  if (!items || items.length === 0) return null
  return (
    <BlockErrorBoundary blockType="faq">
      <section
        id={anchor || undefined}
        class="cms-block cms-block--faq"
        data-block-index={dataBlockIndex}
        {...sectionAnalyticsAttrs(analytics, "faq", dataBlockIndex)}
      >
        {title && (
          <h2 class="cms-block__title" style={{ fontFamily: "var(--font-heading)" }}>
            <RtNodeRenderer node={title} />
          </h2>
        )}
        <dl class="cms-block__faq-list">
          {items.map((item, i) => (
            <details
              key={i}
              class="cms-block__faq-item"
              style={{ borderRadius: "var(--radius-md)" }}
            >
              <summary class="cms-block__faq-question" style={{ fontFamily: "var(--font-heading)" }}>
                <RtNodeRenderer node={item.question} />
              </summary>
              <div class="cms-block__faq-answer" style={{ fontFamily: "var(--font-text)" }}>
                <RtNodeRenderer node={item.answer} />
              </div>
            </details>
          ))}
        </dl>
      </section>
    </BlockErrorBoundary>
  )
}
