import { BlockErrorBoundary } from "./BlockErrorBoundary"
import SmoothImage from "./SmoothImage"
import { sectionAnalyticsAttrs } from "./analytics"
import type { AnalyticsBlockMetadata } from "../../lib/types"

/**
 * Testimonials block renderer (Preact). Structure-only.
 * Props mirror siab-payload/src/blocks/Testimonials.ts.
 * title is plain text (NOT rich text). quote is plain textarea string.
 * avatar resolved to avatarUrl by the dispatcher.
 */
export type TestimonialsProps = {
  anchor?: string | null
  title?: string | null
  items: Array<{
    quote: string
    author: string
    role?: string | null
    avatarUrl?: string | null
  }>
  dataBlockIndex?: number
  analytics?: AnalyticsBlockMetadata | null
}

export default function Testimonials(props: TestimonialsProps) {
  const { anchor, title, items, dataBlockIndex, analytics } = props
  if (!items || items.length === 0) return null
  return (
    <BlockErrorBoundary blockType="testimonials">
      <section
        id={anchor || undefined}
        class="cms-block cms-block--testimonials"
        data-block-index={dataBlockIndex}
        {...sectionAnalyticsAttrs(analytics, "testimonials", dataBlockIndex)}
      >
        {title && (
          <h2 class="cms-block__title" style={{ fontFamily: "var(--font-heading)" }}>
            {title}
          </h2>
        )}
        <ul class="cms-block__testimonials-list">
          {items.map((t, i) => (
            <li
              key={i}
              class="cms-block__testimonial"
              style={{ borderRadius: "var(--radius-lg)" }}
            >
              <blockquote class="cms-block__testimonial-quote" style={{ fontFamily: "var(--font-text)" }}>
                {t.quote}
              </blockquote>
              <figcaption class="cms-block__testimonial-attrib">
                {t.avatarUrl && (
                  <span class="cms-block__testimonial-avatar" style={{ borderRadius: "var(--radius-lg)" }}>
                    <SmoothImage src={t.avatarUrl} alt={t.author} />
                  </span>
                )}
                <span class="cms-block__testimonial-author">{t.author}</span>
                {t.role && <span class="cms-block__testimonial-role">{t.role}</span>}
              </figcaption>
            </li>
          ))}
        </ul>
      </section>
    </BlockErrorBoundary>
  )
}
