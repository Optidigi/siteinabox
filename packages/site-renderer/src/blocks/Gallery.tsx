import * as React from "react"
import type { GalleryBlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../analytics"
import { resolveMedia } from "../media"
import { RichTextRenderer } from "../rich-text"
import { resolveBlockAnchor } from "./anchors"
import { cx, nativeBlockClassName } from "./native-classes"
import type { BlockRenderOptions } from "./types"
import { mergeRendererSectionProps } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function GalleryBlockRenderer({ block, options }: { block: GalleryBlock; options: BlockRenderOptions }) {
  const renderSlot = options.slots?.render
  const isEditable = Boolean(renderSlot)
  if ((!block.images || block.images.length === 0) && !isEditable) return null
  const sourceVariant = rendererVariantClassName(block, options.variantContext)
  const ctaLabel = block.cta?.label?.trim()
  const ctaHref = block.cta?.href?.trim()
  const images: GalleryBlock["images"] = block.images && block.images.length > 0
    ? block.images
    : [{ image: undefined as any, caption: undefined, link: null }]
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
      className: cx("cms-block cms-block--gallery", sourceVariant, nativeBlockClassName(block, "section", options.variantContext)),
      "data-source-variant": runtimeVariantDataAttribute(block, options.variantContext),
      "data-block-index": options.index,
      ...sectionAnalyticsAttrs(block.analytics, "gallery", options.index),
    },
    options.sectionProps,
  )

  return (
    <section {...sectionProps}>
      {(title || intro) && (
        <div className={cx("cms-block__galleryHeader", nativeBlockClassName(block, "header", options.variantContext))}>
          {title}
          {intro}
        </div>
      )}
      <div className={cx("cms-block__galleryGrid", nativeBlockClassName(block, "grid", options.variantContext))}>
        {images.map((item, i) => {
          const image = resolveMedia(item.image, options.mediaResolver)
          if (!image && !renderSlot) return null
          const figure = (
            <figure className={cx("cms-block__galleryItem", nativeBlockClassName(block, "card", options.variantContext))}>
              {renderSlot
                ? renderSlot({
                  kind: "image",
                  value: item.image,
                  path: { blockIndex: options.index, field: "images", itemIndex: i, subField: "image" },
                  imageClassName: nativeBlockClassName(block, "image", options.variantContext),
                  alt: image?.alt ?? "",
                  loading: "lazy",
                })
                : <img className={nativeBlockClassName(block, "image", options.variantContext)} src={image!.src} alt={image!.alt ?? ""} loading="lazy" decoding="async" />}
              {renderSlot ? (
                <figcaption>
                  {renderSlot({
                    kind: "richtext",
                    value: item.caption,
                    path: { blockIndex: options.index, field: "images", itemIndex: i, subField: "caption" },
                    variant: "block",
                    as: "div",
                    placeholder: "Caption",
                  })}
                </figcaption>
              ) : item.caption && (
                <figcaption>
                  <RichTextRenderer value={item.caption} />
                </figcaption>
              )}
            </figure>
          )
          return item.link?.href ? (
            <a key={i} className="cms-block__galleryLink" href={item.link.href} {...actionAnalyticsAttrs("inline", item.link.label ?? "Gallery image")}>
              {figure}
            </a>
          ) : (
            <React.Fragment key={i}>{figure}</React.Fragment>
          )
        })}
      </div>
      {renderSlot ? (
        renderSlot({
          kind: "cta",
          value: block.cta,
          path: { blockIndex: options.index, field: "cta" },
          className: "cms-block__cta",
          emptyLabel: "Add CTA",
          actionName: "primary",
        })
      ) : ctaLabel && ctaHref && (
        <a className="cms-block__cta" href={ctaHref} {...actionAnalyticsAttrs("primary", ctaLabel)}>
          {ctaLabel}
        </a>
      )}
    </section>
  )
}
