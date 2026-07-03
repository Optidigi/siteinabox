import * as React from "react"
import type { LogoCloudBlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../analytics"
import { resolveMedia } from "../media"
import { RichTextRenderer } from "../rich-text"
import { resolveBlockAnchor } from "./anchors"
import { cx, nativeBlockClassName } from "./native-classes"
import type { BlockRenderOptions } from "./types"
import { mergeRendererSectionProps } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function LogoCloudBlockRenderer({ block, options }: { block: LogoCloudBlock; options: BlockRenderOptions }) {
  const renderSlot = options.slots?.render
  const isEditable = Boolean(renderSlot)
  if ((!block.logos || block.logos.length === 0) && !isEditable) return null
  const sourceVariant = rendererVariantClassName(block, options.variantContext)
  const logos: LogoCloudBlock["logos"] = block.logos && block.logos.length > 0
    ? block.logos
    : [{ name: "Logo", image: undefined as any, href: null }]
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
      className: cx("cms-block cms-block--logoCloud", sourceVariant, nativeBlockClassName(block, "section", options.variantContext)),
      "data-source-variant": runtimeVariantDataAttribute(block, options.variantContext),
      "data-block-index": options.index,
      ...sectionAnalyticsAttrs(block.analytics, "logoCloud", options.index),
    },
    options.sectionProps,
  )

  return (
    <section {...sectionProps}>
      {title}
      {intro}
      <ul className={cx("cms-block__logos", nativeBlockClassName(block, "list", options.variantContext))}>
        {logos.map((logo, i) => {
          const image = resolveMedia(logo.image, options.mediaResolver)
          const content = renderSlot
            ? renderSlot({
              kind: "image",
              value: logo.image,
              path: { blockIndex: options.index, field: "logos", itemIndex: i, subField: "image" },
              alt: logo.name,
              loading: "lazy",
            })
            : image ? <img src={image.src} alt={image.alt ?? logo.name} loading="lazy" decoding="async" /> : <span>{logo.name}</span>
          return (
            <li key={i} className={cx("cms-block__logo", nativeBlockClassName(block, "item", options.variantContext))}>
              {logo.href ? (
                <a href={logo.href} {...actionAnalyticsAttrs("inline", logo.name)}>
                  {content}
                </a>
              ) : (
                content
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
