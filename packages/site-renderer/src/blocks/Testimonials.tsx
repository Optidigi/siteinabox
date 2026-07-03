import * as React from "react"
import type { TestimonialsBlock } from "@siteinabox/contracts"
import { sectionAnalyticsAttrs } from "../analytics"
import { resolveMedia } from "../media"
import { resolveBlockAnchor } from "./anchors"
import { cx, nativeBlockClassName } from "./native-classes"
import type { BlockRenderOptions } from "./types"
import { mergeRendererSectionProps } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function TestimonialsBlockRenderer({ block, options }: { block: TestimonialsBlock; options: BlockRenderOptions }) {
  const renderSlot = options.slots?.render
  const isEditable = Boolean(renderSlot)
  if ((!block.items || block.items.length === 0) && !isEditable) return null
  const sourceVariant = rendererVariantClassName(block, options.variantContext)
  const items: TestimonialsBlock["items"] = block.items && block.items.length > 0
    ? block.items
    : [{ quote: "", author: "", role: "", avatar: undefined as any }]
  const sectionProps = mergeRendererSectionProps(
    {
      id: resolveBlockAnchor(block, { legacyTenant: options.variantContext?.legacyTenant, surface: options.surface }),
      className: cx("cms-block cms-block--testimonials", sourceVariant, nativeBlockClassName(block, "section", options.variantContext)),
      "data-source-variant": runtimeVariantDataAttribute(block, options.variantContext),
      "data-block-index": options.index,
      ...sectionAnalyticsAttrs(block.analytics, "testimonials", options.index),
    },
    options.sectionProps,
  )
  const title = renderSlot
    ? renderSlot({
      kind: "text",
      value: typeof block.title === "string" ? block.title : "",
      path: { blockIndex: options.index, field: "title" },
      as: "span",
      placeholder: "Section title",
    })
    : block.title

  return (
    <section {...sectionProps}>
      {(title || renderSlot) && (
        <h2 className={cx("cms-block__title", nativeBlockClassName(block, "title", options.variantContext))} style={{ fontFamily: "var(--font-heading)" }}>
          {title}
        </h2>
      )}
      <ul className={cx("cms-block__testimonials-list", nativeBlockClassName(block, "list", options.variantContext))}>
        {items.map((item, i) => {
          const avatar = resolveMedia(item.avatar ?? null, options.mediaResolver)
          return (
            <li key={i} className={cx("cms-block__testimonial", nativeBlockClassName(block, "item", options.variantContext))} style={{ borderRadius: "var(--radius-lg)" }}>
              <blockquote className="cms-block__testimonial-quote" style={{ fontFamily: "var(--font-text)" }}>
                {renderSlot
                  ? renderSlot({
                    kind: "text",
                    value: item.quote,
                    path: { blockIndex: options.index, field: "items", itemIndex: i, subField: "quote" },
                    as: "span",
                    multiline: true,
                    placeholder: "Quote",
                  })
                  : item.quote}
              </blockquote>
              <figcaption className="cms-block__testimonial-attrib">
                {(avatar || renderSlot) && (
                  <span className={cx("cms-block__testimonial-avatar", nativeBlockClassName(block, "avatar", options.variantContext))} style={{ borderRadius: "var(--radius-lg)" }}>
                    {renderSlot
                      ? renderSlot({
                        kind: "image",
                        value: item.avatar,
                        path: { blockIndex: options.index, field: "items", itemIndex: i, subField: "avatar" },
                        alt: item.author,
                        loading: "lazy",
                      })
                      : avatar && <img src={avatar.src} alt={avatar.alt ?? item.author} loading="lazy" decoding="async" />}
                  </span>
                )}
                <span className="cms-block__testimonial-author">
                  {renderSlot
                    ? renderSlot({
                      kind: "text",
                      value: item.author,
                      path: { blockIndex: options.index, field: "items", itemIndex: i, subField: "author" },
                      as: "span",
                      placeholder: "Author",
                    })
                    : item.author}
                </span>
                {(item.role || renderSlot) && (
                  <span className="cms-block__testimonial-role">
                    {renderSlot
                      ? renderSlot({
                        kind: "text",
                        value: item.role,
                        path: { blockIndex: options.index, field: "items", itemIndex: i, subField: "role" },
                        as: "span",
                        placeholder: "Role",
                      })
                      : item.role}
                  </span>
                )}
              </figcaption>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
