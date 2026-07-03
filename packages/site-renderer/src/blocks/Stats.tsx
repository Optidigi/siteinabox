import * as React from "react"
import type { StatsBlock } from "@siteinabox/contracts"
import { sectionAnalyticsAttrs } from "../analytics"
import { RichTextRenderer } from "../rich-text"
import { cx, nativeBlockClassName } from "./native-classes"
import type { BlockRenderOptions } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function StatsBlockRenderer({ block, options }: { block: StatsBlock; options: BlockRenderOptions }) {
  if (!block.items.length) return null
  const sourceVariant = rendererVariantClassName(block)

  return (
    <section
      id={block.anchor || undefined}
      className={cx("cms-block cms-block--stats", sourceVariant, nativeBlockClassName(block, "section"))}
      data-source-variant={runtimeVariantDataAttribute(block)}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "stats", options.index)}
    >
      {(block.title || block.intro) && (
        <div className={cx("cms-block__statsHeader", nativeBlockClassName(block, "header"))}>
          {block.title && (
            <h2 className={cx("cms-block__title", nativeBlockClassName(block, "title"))} style={{ fontFamily: "var(--font-heading)" }}>
              <RichTextRenderer value={block.title} blockMode="inline" />
            </h2>
          )}
          {block.intro && (
            <div className={cx("cms-block__intro", nativeBlockClassName(block, "intro"))} style={{ fontFamily: "var(--font-text)" }}>
              <RichTextRenderer value={block.intro} />
            </div>
          )}
        </div>
      )}
      <dl className={cx("cms-block__statsList", nativeBlockClassName(block, "list"))}>
        {block.items.map((item, i) => (
          <div key={i} className={cx("cms-block__stat", nativeBlockClassName(block, "item"))}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
            {item.description && (
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
