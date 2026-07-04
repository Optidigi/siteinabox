import * as React from "react"
import type { HeroBlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../analytics"
import { resolveMedia } from "../media"
import { RichTextRenderer } from "../rich-text"
import { cx, nativeBlockClassName } from "./native-classes"
import { mergeRendererSectionAttributes } from "./section-attributes"
import type { BlockRenderOptions } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function HeroBlockRenderer({ block, options }: { block: HeroBlock; options: BlockRenderOptions }) {
  const image = resolveMedia(block.image ?? null, options.mediaResolver)
  const ctaLabel = block.cta?.label?.trim()
  const ctaHref = block.cta?.href?.trim()
  const sourceVariant = rendererVariantClassName(block)
  const slots = options.editSlots
  const sectionProps = mergeRendererSectionAttributes(
    {
      id: block.anchor || undefined,
      className: cx("cms-block cms-block--hero", sourceVariant, nativeBlockClassName(block, "section")),
      "data-source-variant": runtimeVariantDataAttribute(block),
      "data-block-index": options.index,
      ...sectionAnalyticsAttrs(block.analytics, "hero", options.index),
    },
    options.sectionAttributes,
  )

  return (
    <section {...sectionProps}>
      {(block.eyebrow || slots?.renderRichText) && (
        <div className={cx("cms-block__eyebrow", nativeBlockClassName(block, "eyebrow"))}>
          {slots?.renderRichText
            ? slots.renderRichText({
              name: "hero.eyebrow",
              value: block.eyebrow,
              variant: "block",
              elementPath: { blockIndex: options.index, field: "eyebrow" },
            })
            : <RichTextRenderer value={block.eyebrow} />}
        </div>
      )}
      <h1 className={cx("cms-block__title", nativeBlockClassName(block, "title"))} style={{ fontFamily: "var(--font-title)" }}>
        {slots?.renderRichText
          ? slots.renderRichText({
            name: "hero.headline",
            value: block.headline,
            variant: "inline",
            elementPath: { blockIndex: options.index, field: "headline" },
          })
          : <RichTextRenderer value={block.headline} />}
      </h1>
      {(block.subheadline || slots?.renderRichText) && (
        <div className={cx("cms-block__subheadline", nativeBlockClassName(block, "intro"))} style={{ fontFamily: "var(--font-text)" }}>
          {slots?.renderRichText
            ? slots.renderRichText({
              name: "hero.subheadline",
              value: block.subheadline,
              variant: "block",
              elementPath: { blockIndex: options.index, field: "subheadline" },
            })
            : <RichTextRenderer value={block.subheadline} />}
        </div>
      )}
      {block.pills && block.pills.length > 0 && (
        <ul className="cms-block__pills">
          {block.pills.map((pill, i) => (
            <li key={pill.id ?? i} className="cms-block__pill" style={{ borderRadius: "var(--radius-sm)" }}>
              {slots?.renderText
                ? slots.renderText({
                  name: "hero.pillLabel",
                  value: pill.label,
                  className: "contents",
                  elementPath: { blockIndex: options.index, field: "pills", itemIndex: i },
                })
                : pill.label}
            </li>
          ))}
        </ul>
      )}
      {((ctaLabel && ctaHref) || slots?.renderCta) && (
        slots?.renderCta
          ? slots.renderCta({
            name: "hero.cta",
            value: block.cta,
            className: cx("cms-block__cta", nativeBlockClassName(block, "cta")),
            style: { borderRadius: "var(--radius-md)" },
            actionAttributes: actionAnalyticsAttrs("primary", ctaLabel),
            elementPath: { blockIndex: options.index, field: "cta" },
          })
          : (
            <a
              className={cx("cms-block__cta", nativeBlockClassName(block, "cta"))}
              href={ctaHref}
              style={{ borderRadius: "var(--radius-md)" }}
              {...actionAnalyticsAttrs("primary", ctaLabel)}
            >
              {ctaLabel}
            </a>
          )
      )}
      {image && (
        <figure className={cx("cms-block__image", nativeBlockClassName(block, "image"))} style={{ borderRadius: "var(--radius-lg)" }}>
          {slots?.renderImage
            ? slots.renderImage({
              name: "hero.image",
              value: block.image,
              alt: image.alt,
              loading: "eager",
              decoding: "async",
              elementPath: { blockIndex: options.index, field: "image" },
            })
            : <img src={image.src} alt={image.alt ?? ""} loading="eager" decoding="async" />}
        </figure>
      )}
    </section>
  )
}
