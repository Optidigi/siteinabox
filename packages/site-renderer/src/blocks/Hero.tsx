import * as React from "react"
import type { HeroBlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../analytics"
import { resolveMedia } from "../media"
import { RichTextRenderer } from "../rich-text"
import { resolveBlockAnchor } from "./anchors"
import { cx, nativeBlockClassName } from "./native-classes"
import type { BlockRenderOptions } from "./types"
import { mergeRendererSectionProps } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function HeroBlockRenderer({ block, options }: { block: HeroBlock; options: BlockRenderOptions }) {
  const renderSlot = options.slots?.render
  const image = resolveMedia(block.image ?? null, options.mediaResolver)
  const ctaLabel = block.cta?.label?.trim()
  const ctaHref = block.cta?.href?.trim()
  const sourceVariant = rendererVariantClassName(block, options.variantContext)
  const sectionId = renderSlot
    ? resolveBlockAnchor(block, { legacyTenant: options.variantContext?.legacyTenant, surface: options.surface })
    : block.anchor || undefined
  const sectionProps = mergeRendererSectionProps(
    {
      id: sectionId,
      className: cx("cms-block cms-block--hero", sourceVariant, nativeBlockClassName(block, "section", options.variantContext)),
      "data-source-variant": runtimeVariantDataAttribute(block, options.variantContext),
      "data-block-index": options.index,
      ...sectionAnalyticsAttrs(block.analytics, "hero", options.index),
    },
    options.sectionProps,
  )
  const eyebrow = renderSlot
    ? renderSlot({
      kind: "richtext",
      value: block.eyebrow,
      path: { blockIndex: options.index, field: "eyebrow" },
      variant: "inline",
      as: "div",
      className: cx("cms-block__eyebrow", nativeBlockClassName(block, "eyebrow", options.variantContext)),
      placeholder: "Eyebrow",
      blockMode: "inline",
    })
    : block.eyebrow ? (
      <div className={cx("cms-block__eyebrow", nativeBlockClassName(block, "eyebrow", options.variantContext))}>
        <RichTextRenderer value={block.eyebrow} />
      </div>
    ) : null
  const headline = renderSlot
    ? renderSlot({
      kind: "richtext",
      value: block.headline,
      path: { blockIndex: options.index, field: "headline" },
      variant: "inline",
      as: "h1",
      className: cx("cms-block__title", nativeBlockClassName(block, "title", options.variantContext)),
      placeholder: "Headline",
      blockMode: "inline",
      style: { fontFamily: "var(--font-title)" },
    })
    : (
      <h1 className={cx("cms-block__title", nativeBlockClassName(block, "title", options.variantContext))} style={{ fontFamily: "var(--font-title)" }}>
        <RichTextRenderer value={block.headline} />
      </h1>
    )
  const subheadline = renderSlot
    ? renderSlot({
      kind: "richtext",
      value: block.subheadline,
      path: { blockIndex: options.index, field: "subheadline" },
      variant: "block",
      as: "div",
      className: cx("cms-block__subheadline", nativeBlockClassName(block, "intro", options.variantContext)),
      placeholder: "Subheadline",
      style: { fontFamily: "var(--font-text)" },
    })
    : block.subheadline ? (
      <div className={cx("cms-block__subheadline", nativeBlockClassName(block, "intro", options.variantContext))} style={{ fontFamily: "var(--font-text)" }}>
        <RichTextRenderer value={block.subheadline} />
      </div>
    ) : null
  const cta = renderSlot
    ? renderSlot({
      kind: "cta",
      value: block.cta,
      path: { blockIndex: options.index, field: "cta" },
      className: cx("cms-block__cta", nativeBlockClassName(block, "cta", options.variantContext)),
      emptyLabel: "Add CTA button",
      actionName: "primary",
      style: { borderRadius: "var(--radius-md)" },
    })
    : ctaLabel && ctaHref ? (
      <a
        className={cx("cms-block__cta", nativeBlockClassName(block, "cta", options.variantContext))}
        href={ctaHref}
        style={{ borderRadius: "var(--radius-md)" }}
        {...actionAnalyticsAttrs("primary", ctaLabel)}
      >
        {ctaLabel}
      </a>
    ) : null
  const heroImage = renderSlot
    ? renderSlot({
      kind: "image",
      value: block.image,
      path: { blockIndex: options.index, field: "image" },
      className: cx("cms-block__image", nativeBlockClassName(block, "image", options.variantContext)),
      imageClassName: "cms-block__image-img",
      alt: image?.alt ?? "",
      loading: "eager",
      style: { borderRadius: "var(--radius-lg)" },
    })
    : image ? (
      <figure className={cx("cms-block__image", nativeBlockClassName(block, "image", options.variantContext))} style={{ borderRadius: "var(--radius-lg)" }}>
        <img src={image.src} alt={image.alt ?? ""} loading="eager" decoding="async" />
      </figure>
    ) : null

  return (
    <section {...sectionProps}>
      {eyebrow}
      {headline}
      {subheadline}
      {block.pills && block.pills.length > 0 && (
        <ul className="cms-block__pills">
          {block.pills.map((pill, i) => (
            <li key={pill.id ?? i} className="cms-block__pill" style={{ borderRadius: "var(--radius-sm)" }}>
              {pill.label}
            </li>
          ))}
        </ul>
      )}
      {cta}
      {heroImage}
    </section>
  )
}
