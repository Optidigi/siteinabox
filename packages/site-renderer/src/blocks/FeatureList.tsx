import * as React from "react"
import type { FeatureListBlock } from "@siteinabox/contracts"
import { sectionAnalyticsAttrs } from "../analytics"
import { RichTextRenderer } from "../rich-text"
import { resolveIcon } from "./icons"
import { cx, nativeBlockClassName } from "./native-classes"
import type { BlockRenderOptions } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function FeatureListBlockRenderer({ block, options }: { block: FeatureListBlock; options: BlockRenderOptions }) {
  if (!block.features || block.features.length === 0) return null
  const sourceVariant = rendererVariantClassName(block)

  return (
    <section
      id={block.anchor || undefined}
      className={cx("cms-block cms-block--featurelist", sourceVariant, nativeBlockClassName(block, "section"))}
      data-source-variant={runtimeVariantDataAttribute(block)}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "featureList", options.index)}
    >
      {block.title && (
        <h2 className={cx("cms-block__title", nativeBlockClassName(block, "title"))} style={{ fontFamily: "var(--font-heading)" }}>
          <RichTextRenderer value={block.title} />
        </h2>
      )}
      {block.intro && (
        <div className={cx("cms-block__intro", nativeBlockClassName(block, "intro"))} style={{ fontFamily: "var(--font-text)" }}>
          <RichTextRenderer value={block.intro} />
        </div>
      )}
      <ul className={cx("cms-block__features", nativeBlockClassName(block, "list"))}>
        {block.features.map((feature, i) => {
          const Icon = resolveIcon(feature.icon)
          return (
            <li key={i} className={cx("cms-block__feature", nativeBlockClassName(block, "item"))} style={{ borderRadius: "var(--radius-lg)" }}>
              {Icon && (
                <span className={cx("cms-block__feature-icon", nativeBlockClassName(block, "icon"))} aria-hidden="true">
                  <Icon />
                </span>
              )}
              <h3 className="cms-block__feature-title" style={{ fontFamily: "var(--font-heading)" }}>
                <RichTextRenderer value={feature.title} />
              </h3>
              {feature.description && (
                <div className="cms-block__feature-description" style={{ fontFamily: "var(--font-text)" }}>
                  <RichTextRenderer value={feature.description} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
