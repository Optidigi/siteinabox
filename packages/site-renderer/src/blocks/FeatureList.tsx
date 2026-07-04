import * as React from "react"
import type { FeatureListBlock } from "@siteinabox/contracts"
import { sectionAnalyticsAttrs } from "../analytics"
import { RichTextRenderer } from "../rich-text"
import { resolveIcon } from "./icons"
import { cx, nativeBlockClassName } from "./native-classes"
import { mergeRendererSectionAttributes } from "./section-attributes"
import type { BlockRenderOptions } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function FeatureListBlockRenderer({ block, options }: { block: FeatureListBlock; options: BlockRenderOptions }) {
  if ((!block.features || block.features.length === 0) && !options.editSlots) return null
  const sourceVariant = rendererVariantClassName(block)
  const slots = options.editSlots
  const features = block.features && block.features.length > 0
    ? block.features
    : ([{}] as Partial<NonNullable<FeatureListBlock["features"]>[number]>[])
  const sectionProps = mergeRendererSectionAttributes(
    {
      id: block.anchor || undefined,
      className: cx("cms-block cms-block--featurelist", sourceVariant, nativeBlockClassName(block, "section")),
      "data-source-variant": runtimeVariantDataAttribute(block),
      "data-block-index": options.index,
      ...sectionAnalyticsAttrs(block.analytics, "featureList", options.index),
    },
    options.sectionAttributes,
  )

  return (
    <section {...sectionProps}>
      {(block.title || slots?.renderRichText) && (
        <h2 className={cx("cms-block__title", nativeBlockClassName(block, "title"))} style={{ fontFamily: "var(--font-heading)" }}>
          {slots?.renderRichText
            ? slots.renderRichText({
              name: "featureList.title",
              value: block.title,
              variant: "inline",
              elementPath: { blockIndex: options.index, field: "title" },
            })
            : <RichTextRenderer value={block.title} />}
        </h2>
      )}
      {(block.intro || slots?.renderRichText) && (
        <div className={cx("cms-block__intro", nativeBlockClassName(block, "intro"))} style={{ fontFamily: "var(--font-text)" }}>
          {slots?.renderRichText
            ? slots.renderRichText({
              name: "featureList.intro",
              value: block.intro,
              variant: "block",
              elementPath: { blockIndex: options.index, field: "intro" },
            })
            : <RichTextRenderer value={block.intro} />}
        </div>
      )}
      <ul className={cx("cms-block__features", nativeBlockClassName(block, "list"))}>
        {features.map((feature, i) => {
          const Icon = resolveIcon(feature.icon)
          return (
            <li key={i} className={cx("cms-block__feature", nativeBlockClassName(block, "item"))} style={{ borderRadius: "var(--radius-lg)" }}>
              {(Icon || slots?.renderIcon) && (
                <span className={cx("cms-block__feature-icon", nativeBlockClassName(block, "icon"))} aria-hidden="true">
                  {slots?.renderIcon
                    ? slots.renderIcon({
                      name: "featureList.featureIcon",
                      value: feature.icon,
                      elementPath: { blockIndex: options.index, field: "features", itemIndex: i, subField: "icon" },
                    })
                    : Icon ? <Icon /> : null}
                </span>
              )}
              <h3 className="cms-block__feature-title" style={{ fontFamily: "var(--font-heading)" }}>
                {slots?.renderRichText
                  ? slots.renderRichText({
                    name: "featureList.featureTitle",
                    value: feature.title,
                    variant: "inline",
                    elementPath: { blockIndex: options.index, field: "features", itemIndex: i, subField: "title" },
                  })
                  : <RichTextRenderer value={feature.title} />}
              </h3>
              {(feature.description || slots?.renderRichText) && (
                <div className="cms-block__feature-description" style={{ fontFamily: "var(--font-text)" }}>
                  {slots?.renderRichText
                    ? slots.renderRichText({
                      name: "featureList.featureDescription",
                      value: feature.description,
                      variant: "block",
                      elementPath: { blockIndex: options.index, field: "features", itemIndex: i, subField: "description" },
                    })
                    : <RichTextRenderer value={feature.description} />}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
