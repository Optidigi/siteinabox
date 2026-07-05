import * as React from "react"
import type { ContentSectionBlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../analytics"
import { resolveMedia } from "../media"
import { RichTextRenderer } from "../rich-text"
import { cx, nativeBlockClassName } from "./native-classes"
import type { BlockRenderOptions } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function ContentSectionBlockRenderer({ block, options }: { block: ContentSectionBlock; options: BlockRenderOptions }) {
  const sourceVariant = rendererVariantClassName(block)
  const image = resolveMedia(block.image ?? null, options.mediaResolver)
  const ctaLabel = block.cta?.label?.trim()
  const ctaHref = block.cta?.href?.trim()

  return (
    <section
      id={block.anchor || undefined}
      className={cx("cms-block cms-block--contentSection", sourceVariant, nativeBlockClassName(block, "section"))}
      data-source-variant={runtimeVariantDataAttribute(block)}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "contentSection", options.index)}
    >
      <div className={cx("cms-block__content", nativeBlockClassName(block, "body"))}>
        {block.eyebrow ? <p className={cx("cms-block__eyebrow", nativeBlockClassName(block, "eyebrow"))}><RichTextRenderer value={block.eyebrow} blockMode="inline" /></p> : null}
        {block.title ? <h2 className={cx("cms-block__title", nativeBlockClassName(block, "title"))}><RichTextRenderer value={block.title} blockMode="inline" /></h2> : null}
        {block.intro ? <div className={cx("cms-block__intro", nativeBlockClassName(block, "intro"))}><RichTextRenderer value={block.intro} /></div> : null}
        <RichTextRenderer value={block.body} />
        {block.features?.length ? (
          <ul className="cms-block__features">
            {block.features.map((feature, index) => (
              <li key={index} className="cms-block__feature">
                <strong><RichTextRenderer value={feature.title} blockMode="inline" /></strong>
                {feature.description ? <RichTextRenderer value={feature.description} /> : null}
              </li>
            ))}
          </ul>
        ) : null}
        {block.secondaryTitle ? <h3 className="cms-block__subtitle"><RichTextRenderer value={block.secondaryTitle} blockMode="inline" /></h3> : null}
        {block.secondaryBody ? <RichTextRenderer value={block.secondaryBody} /> : null}
        {ctaLabel && ctaHref ? (
          <a className={cx("cms-block__cta", nativeBlockClassName(block, "cta"))} href={ctaHref} {...actionAnalyticsAttrs("primary", ctaLabel)}>
            {ctaLabel}
          </a>
        ) : null}
      </div>
      {image ? (
        <img
          className={cx("cms-block__image", nativeBlockClassName(block, "image"))}
          src={image.src}
          alt={image.alt ?? ""}
          loading="lazy"
          decoding="async"
        />
      ) : null}
    </section>
  )
}
