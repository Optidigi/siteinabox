import * as React from "react"
import type { HeroBlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../analytics"
import { resolveMedia } from "../media"
import { RichTextRenderer } from "../rich-text"
import { cx, nativeBlockClassName } from "./native-classes"
import type { BlockRenderOptions } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function HeroBlockRenderer({ block, options }: { block: HeroBlock; options: BlockRenderOptions }) {
  const image = resolveMedia(block.image ?? null, options.mediaResolver)
  const ctaLabel = block.cta?.label?.trim()
  const ctaHref = block.cta?.href?.trim()
  const sourceVariant = rendererVariantClassName(block)

  return (
    <section
      id={block.anchor || undefined}
      className={cx("cms-block cms-block--hero", sourceVariant, nativeBlockClassName(block, "section"))}
      data-source-variant={runtimeVariantDataAttribute(block)}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "hero", options.index)}
    >
      {block.eyebrow && (
        <div className={cx("cms-block__eyebrow", nativeBlockClassName(block, "eyebrow"))}>
          <RichTextRenderer value={block.eyebrow} />
        </div>
      )}
      <h1 className={cx("cms-block__title", nativeBlockClassName(block, "title"))} style={{ fontFamily: "var(--font-title)" }}>
        <RichTextRenderer value={block.headline} />
      </h1>
      {block.subheadline && (
        <div className={cx("cms-block__subheadline", nativeBlockClassName(block, "intro"))} style={{ fontFamily: "var(--font-text)" }}>
          <RichTextRenderer value={block.subheadline} />
        </div>
      )}
      {block.pills && block.pills.length > 0 && (
        <ul className="cms-block__pills">
          {block.pills.map((pill, i) => (
            <li key={pill.id ?? i} className="cms-block__pill" style={{ borderRadius: "var(--radius-sm)" }}>
              {pill.label}
            </li>
          ))}
        </ul>
      )}
      {ctaLabel && ctaHref && (
        <a
          className={cx("cms-block__cta", nativeBlockClassName(block, "cta"))}
          href={ctaHref}
          style={{ borderRadius: "var(--radius-md)" }}
          {...actionAnalyticsAttrs("primary", ctaLabel)}
        >
          {ctaLabel}
        </a>
      )}
      {image && (
        <figure className={cx("cms-block__image", nativeBlockClassName(block, "image"))} style={{ borderRadius: "var(--radius-lg)" }}>
          <img src={image.src} alt={image.alt ?? ""} loading="eager" decoding="async" />
        </figure>
      )}
    </section>
  )
}
