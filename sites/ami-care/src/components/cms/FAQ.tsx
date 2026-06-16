import RtNodeRenderer from "./RtNodeRenderer"
import { sectionAnalyticsAttrs } from "./analytics"
import type { AnalyticsBlockMetadata, RtField } from "../../lib/types"

export type FAQProps = {
  title?: RtField
  items: Array<{ question: RtField; answer: RtField }>
  anchor?: string | null
  dataBlockIndex?: number
  analytics?: AnalyticsBlockMetadata | null
}

export default function FAQ({ title, items, anchor, dataBlockIndex, analytics }: FAQProps) {
  if (!items || items.length === 0) return null
  return (
    <section
      id={anchor ?? undefined}
      class="cms-block cms-block--faq px-6 py-16 @min-[48rem]/site-frame:px-12 @min-[48rem]/site-frame:py-20 @min-[64rem]/site-frame:px-24"
      data-block-index={dataBlockIndex}
      {...sectionAnalyticsAttrs(analytics, "faq", dataBlockIndex)}
    >
      <div class="container mx-auto max-w-3xl">
        {title && (
          <h2
            class="mb-10 text-center font-serif text-[34px] leading-[1.1] tracking-[-0.01em] @min-[48rem]/site-frame:text-[44px]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <RtNodeRenderer node={title} />
          </h2>
        )}
        <dl class="space-y-4">
          {items.map((item, i) => (
            <details
              key={i}
              class="group rounded-lg border border-rule bg-card p-4"
            >
              <summary
                class="flex list-none cursor-pointer items-center justify-between font-medium text-ink"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                <span><RtNodeRenderer node={item.question} /></span>
                <span class="text-ink-muted transition-transform group-open:rotate-180" aria-hidden>
                  ▾
                </span>
              </summary>
              <div
                class="mt-3 text-sm leading-relaxed text-ink-muted"
                style={{ fontFamily: "var(--font-text)" }}
              >
                <RtNodeRenderer node={item.answer} />
              </div>
            </details>
          ))}
        </dl>
      </div>
    </section>
  )
}
