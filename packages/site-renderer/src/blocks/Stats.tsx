import * as React from "react"
import type { StatsBlock } from "@siteinabox/contracts"
import { sectionAnalyticsAttrs } from "../analytics"
import { RichTextRenderer } from "../rich-text"
import { resolveBlockAnchor } from "./anchors"
import { cx, nativeBlockClassName } from "./native-classes"
import type { BlockRenderOptions } from "./types"
import { mergeRendererSectionProps } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function StatsBlockRenderer({ block, options }: { block: StatsBlock; options: BlockRenderOptions }) {
  const renderSlot = options.slots?.render
  const isEditable = Boolean(renderSlot)
  if ((!block.items || block.items.length === 0) && !isEditable) return null
  const sourceVariant = rendererVariantClassName(block, options.variantContext)
  const items: StatsBlock["items"] = block.items && block.items.length > 0
    ? block.items
    : [{ value: "", label: "", description: undefined }]
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
        <RichTextRenderer value={block.title} blockMode="inline" />
      </h2>
    ) : null
  const intro = renderSlot
    ? renderSlot({
      kind: "richtext",
      value: block.intro,
      path: { blockIndex: options.index, field: "intro" },
      variant: "block",
      as: "div",
      className: cx("cms-block__intro", nativeBlockClassName(block, "intro", options.variantContext)),
      placeholder: "Intro",
      style: { fontFamily: "var(--font-text)" },
    })
    : block.intro ? (
      <div className={cx("cms-block__intro", nativeBlockClassName(block, "intro", options.variantContext))} style={{ fontFamily: "var(--font-text)" }}>
        <RichTextRenderer value={block.intro} />
      </div>
    ) : null
  const sectionProps = mergeRendererSectionProps(
    {
      id: resolveBlockAnchor(block, { legacyTenant: options.variantContext?.legacyTenant, surface: options.surface }),
      className: cx("cms-block cms-block--stats", sourceVariant, nativeBlockClassName(block, "section", options.variantContext)),
      "data-source-variant": runtimeVariantDataAttribute(block, options.variantContext),
      "data-block-index": options.index,
      ...sectionAnalyticsAttrs(block.analytics, "stats", options.index),
    },
    options.sectionProps,
  )

  return (
    <section {...sectionProps}>
      {(title || intro) && (
        <div className={cx("cms-block__statsHeader", nativeBlockClassName(block, "header", options.variantContext))}>
          {title}
          {intro}
        </div>
      )}
      <dl className={cx("cms-block__statsList", nativeBlockClassName(block, "list", options.variantContext))}>
        {items.map((item, i) => (
          <div key={i} className={cx("cms-block__stat", nativeBlockClassName(block, "item", options.variantContext))}>
            <dt>
              {renderSlot
                ? renderSlot({
                  kind: "text",
                  value: item.label,
                  path: { blockIndex: options.index, field: "items", itemIndex: i, subField: "label" },
                  placeholder: "Stat label",
                })
                : item.label}
            </dt>
            <dd>
              {renderSlot
                ? renderSlot({
                  kind: "text",
                  value: item.value,
                  path: { blockIndex: options.index, field: "items", itemIndex: i, subField: "value" },
                  placeholder: "Stat value",
                })
                : item.value}
            </dd>
            {renderSlot ? (
              <div className="cms-block__statDescription">
                {renderSlot({
                  kind: "richtext",
                  value: item.description,
                  path: { blockIndex: options.index, field: "items", itemIndex: i, subField: "description" },
                  variant: "block",
                  as: "div",
                  placeholder: "Stat description",
                })}
              </div>
            ) : item.description && (
              <div className="cms-block__statDescription">
                <RichTextRenderer value={item.description} />
              </div>
            )}
          </div>
        ))}
      </dl>
    </section>
  )
}
