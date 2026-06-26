import * as React from "react"
import type { TestimonialsBlock } from "@siteinabox/contracts"
import { sectionAnalyticsAttrs } from "../analytics"
import { resolveMedia } from "../media"
import type { BlockRenderOptions } from "./types"

export function TestimonialsBlockRenderer({ block, options }: { block: TestimonialsBlock; options: BlockRenderOptions }) {
  if (!block.items || block.items.length === 0) return null
  const sourceVariant =
    block.analytics?.sectionVariant === "mamba-testimonial-1" ? "cms-block--source-mamba-testimonial-1" : ""

  return (
    <section
      id={block.anchor || undefined}
      className={`cms-block cms-block--testimonials ${sourceVariant}`.trim()}
      data-source-variant={block.analytics?.sectionVariant || undefined}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "testimonials", options.index)}
    >
      {block.title && (
        <h2 className="cms-block__title" style={{ fontFamily: "var(--font-heading)" }}>
          {block.title}
        </h2>
      )}
      <ul className="cms-block__testimonials-list">
        {block.items.map((item, i) => {
          const avatar = resolveMedia(item.avatar ?? null, options.mediaResolver)
          return (
            <li key={i} className="cms-block__testimonial" style={{ borderRadius: "var(--radius-lg)" }}>
              <blockquote className="cms-block__testimonial-quote" style={{ fontFamily: "var(--font-text)" }}>
                {item.quote}
              </blockquote>
              <figcaption className="cms-block__testimonial-attrib">
                {avatar && (
                  <span className="cms-block__testimonial-avatar" style={{ borderRadius: "var(--radius-lg)" }}>
                    <img src={avatar.src} alt={avatar.alt ?? item.author} loading="lazy" decoding="async" />
                  </span>
                )}
                <span className="cms-block__testimonial-author">{item.author}</span>
                {item.role && <span className="cms-block__testimonial-role">{item.role}</span>}
              </figcaption>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
