import * as React from "react"
import type { BentoGridBlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../analytics"
import { resolveMedia } from "../media"
import { RichTextRenderer } from "../rich-text"
import { resolveIcon } from "./icons"
import { cx, nativeBlockClassName } from "./native-classes"
import type { BlockRenderOptions } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function BentoGridBlockRenderer({ block, options }: { block: BentoGridBlock; options: BlockRenderOptions }) {
  if (!block.items.length) return null
  const sourceVariant = rendererVariantClassName(block)

  return (
    <section
      id={block.anchor || undefined}
      className={cx("cms-block cms-block--bentoGrid", sourceVariant, nativeBlockClassName(block, "section"))}
      data-source-variant={runtimeVariantDataAttribute(block)}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "bentoGrid", options.index)}
    >
      {(block.title || block.intro) && (
        <div className={cx("cms-block__header", nativeBlockClassName(block, "header"))}>
          {block.title ? <h2 className={cx("cms-block__title", nativeBlockClassName(block, "title"))}><RichTextRenderer value={block.title} blockMode="inline" /></h2> : null}
          {block.intro ? <div className={cx("cms-block__intro", nativeBlockClassName(block, "intro"))}><RichTextRenderer value={block.intro} /></div> : null}
        </div>
      )}
      <div className={cx("cms-block__bentoGrid", nativeBlockClassName(block, "grid"))}>
        {block.items.map((item, index) => {
          const image = resolveMedia(item.image ?? null, options.mediaResolver)
          const Icon = resolveIcon(item.icon)
          const content = (
            <article className={cx("cms-block__bentoItem", nativeBlockClassName(block, "card"))}>
              {image ? <img className={nativeBlockClassName(block, "image")} src={image.src} alt={image.alt ?? ""} loading="lazy" decoding="async" /> : null}
              {Icon ? <Icon aria-hidden="true" /> : null}
              <h3><RichTextRenderer value={item.title} blockMode="inline" /></h3>
              {item.description ? <RichTextRenderer value={item.description} /> : null}
            </article>
          )
          return item.cta?.href ? (
            <a key={index} href={item.cta.href} {...actionAnalyticsAttrs("inline", item.cta.label ?? "Bento item")}>
              {content}
            </a>
          ) : (
            <React.Fragment key={index}>{content}</React.Fragment>
          )
        })}
      </div>
    </section>
  )
}
