import * as React from "react"
import type { LogoCloudBlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../analytics"
import { resolveMedia } from "../media"
import { RichTextRenderer } from "../rich-text"
import { cx, nativeBlockClassName } from "./native-classes"
import type { BlockRenderOptions } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function LogoCloudBlockRenderer({ block, options }: { block: LogoCloudBlock; options: BlockRenderOptions }) {
  if (!block.logos.length) return null
  const sourceVariant = rendererVariantClassName(block)

  return (
    <section
      id={block.anchor || undefined}
      className={cx("cms-block cms-block--logoCloud", sourceVariant, nativeBlockClassName(block, "section"))}
      data-source-variant={runtimeVariantDataAttribute(block)}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "logoCloud", options.index)}
    >
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
      <ul className={cx("cms-block__logos", nativeBlockClassName(block, "list"))}>
        {block.logos.map((logo, i) => {
          const image = resolveMedia(logo.image, options.mediaResolver)
          const content = image ? <img src={image.src} alt={image.alt ?? logo.name} loading="lazy" decoding="async" /> : <span>{logo.name}</span>
          return (
            <li key={i} className={cx("cms-block__logo", nativeBlockClassName(block, "item"))}>
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
