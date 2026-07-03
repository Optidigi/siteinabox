import * as React from "react"
import type { TestimonialsBlock } from "@siteinabox/contracts"
import { sectionAnalyticsAttrs } from "../analytics"
import { resolveMedia } from "../media"
import { cx, nativeBlockClassName } from "./native-classes"
import type { BlockRenderOptions } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function TestimonialsBlockRenderer({ block, options }: { block: TestimonialsBlock; options: BlockRenderOptions }) {
  if (!block.items || block.items.length === 0) return null
  const sourceVariant = rendererVariantClassName(block)

  return (
    <section
      id={block.anchor || undefined}
      className={cx("cms-block cms-block--testimonials", sourceVariant, nativeBlockClassName(block, "section"))}
      data-source-variant={runtimeVariantDataAttribute(block)}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "testimonials", options.index)}
    >
      {block.title && (
        <h2 className={cx("cms-block__title", nativeBlockClassName(block, "title"))} style={{ fontFamily: "var(--font-heading)" }}>
          {block.title}
        </h2>
      )}
      <ul className={cx("cms-block__testimonials-list", nativeBlockClassName(block, "list"))}>
        {block.items.map((item, i) => {
          const avatar = resolveMedia(item.avatar ?? null, options.mediaResolver)
          return (
            <li key={i} className={cx("cms-block__testimonial", nativeBlockClassName(block, "item"))} style={{ borderRadius: "var(--radius-lg)" }}>
              <blockquote className="cms-block__testimonial-quote" style={{ fontFamily: "var(--font-text)" }}>
                {item.quote}
              </blockquote>
              <figcaption className="cms-block__testimonial-attrib">
                {avatar && (
                  <span className={cx("cms-block__testimonial-avatar", nativeBlockClassName(block, "avatar"))} style={{ borderRadius: "var(--radius-lg)" }}>
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
