import * as React from "react"
import type { FeatureListBlock } from "@siteinabox/contracts"
import { sectionAnalyticsAttrs } from "../analytics"
import { RichTextRenderer } from "../rich-text"
import { resolveBlockAnchor } from "./anchors"
import { resolveIcon } from "./icons"
import { cx, nativeBlockClassName } from "./native-classes"
import type { BlockRenderOptions } from "./types"
import { mergeRendererSectionProps } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function FeatureListBlockRenderer({ block, options }: { block: FeatureListBlock; options: BlockRenderOptions }) {
  const renderSlot = options.slots?.render
  const isEditable = Boolean(renderSlot)
  if ((!block.features || block.features.length === 0) && !isEditable) return null
  const sourceVariant = rendererVariantClassName(block, options.variantContext)
  const features: FeatureListBlock["features"] = block.features && block.features.length > 0
    ? block.features
    : [{ title: undefined as any, description: undefined, icon: null }]
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
        <RichTextRenderer value={block.title} />
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
      className: cx("cms-block cms-block--featurelist", sourceVariant, nativeBlockClassName(block, "section", options.variantContext)),
      "data-source-variant": runtimeVariantDataAttribute(block, options.variantContext),
      "data-block-index": options.index,
      ...sectionAnalyticsAttrs(block.analytics, "featureList", options.index),
    },
    options.sectionProps,
  )

  return (
    <section {...sectionProps}>
      {title}
      {intro}
      <ul className={cx("cms-block__features", nativeBlockClassName(block, "list", options.variantContext))}>
        {features.map((feature, i) => {
          const Icon = resolveIcon(feature.icon)
          return (
            <li key={i} className={cx("cms-block__feature", nativeBlockClassName(block, "item", options.variantContext))} style={{ borderRadius: "var(--radius-lg)" }}>
              {renderSlot ? (
                <span className={cx("cms-block__feature-icon", nativeBlockClassName(block, "icon", options.variantContext))} aria-hidden="true">
                  {renderSlot({
                    kind: "icon",
                    value: feature.icon,
                    path: { blockIndex: options.index, field: "features", itemIndex: i, subField: "icon" },
                  })}
                </span>
              ) : Icon ? (
                <span className={cx("cms-block__feature-icon", nativeBlockClassName(block, "icon", options.variantContext))} aria-hidden="true">
                  <Icon />
                </span>
              ) : null}
              <h3 className="cms-block__feature-title" style={{ fontFamily: "var(--font-heading)" }}>
                {renderSlot
                  ? renderSlot({
                    kind: "richtext",
                    value: feature.title,
                    path: { blockIndex: options.index, field: "features", itemIndex: i, subField: "title" },
                    variant: "inline",
                    as: "span",
                    placeholder: "Feature title",
                    blockMode: "inline",
                  })
                  : <RichTextRenderer value={feature.title} />}
              </h3>
              {renderSlot ? (
                <div className="cms-block__feature-description" style={{ fontFamily: "var(--font-text)" }}>
                  {renderSlot({
                    kind: "richtext",
                    value: feature.description,
                    path: { blockIndex: options.index, field: "features", itemIndex: i, subField: "description" },
                    variant: "block",
                    as: "div",
                    placeholder: "Feature description",
                  })}
                </div>
              ) : feature.description && (
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
