import * as React from "react"
import type { GalleryBlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../analytics"
import { resolveMedia } from "../media"
import { RichTextRenderer } from "../rich-text"
import { cx, nativeBlockClassName } from "./native-classes"
import type { BlockRenderOptions } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function GalleryBlockRenderer({ block, options }: { block: GalleryBlock; options: BlockRenderOptions }) {
  if (!block.images.length) return null
  const sourceVariant = rendererVariantClassName(block)
  const ctaLabel = block.cta?.label?.trim()
  const ctaHref = block.cta?.href?.trim()

  return (
    <section
      id={block.anchor || undefined}
      className={cx("cms-block cms-block--gallery", sourceVariant, nativeBlockClassName(block, "section"))}
      data-source-variant={runtimeVariantDataAttribute(block)}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "gallery", options.index)}
    >
      {(block.title || block.intro) && (
        <div className={cx("cms-block__galleryHeader", nativeBlockClassName(block, "header"))}>
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
      <div className={cx("cms-block__galleryGrid", nativeBlockClassName(block, "grid"))}>
        {block.images.map((item, i) => {
          const image = resolveMedia(item.image, options.mediaResolver)
          if (!image) return null
          const figure = (
            <figure className={cx("cms-block__galleryItem", nativeBlockClassName(block, "card"))}>
              <img className={nativeBlockClassName(block, "image")} src={image.src} alt={image.alt ?? ""} loading="lazy" decoding="async" />
              {item.caption && (
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
      {ctaLabel && ctaHref && (
        <a className="cms-block__cta" href={ctaHref} {...actionAnalyticsAttrs("primary", ctaLabel)}>
          {ctaLabel}
        </a>
      )}
    </section>
  )
}
