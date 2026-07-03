import * as React from "react"
import type { BlogCardsBlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../analytics"
import { resolveMedia } from "../media"
import { RichTextRenderer } from "../rich-text"
import { cx, nativeBlockClassName } from "./native-classes"
import type { BlockRenderOptions } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function BlogCardsBlockRenderer({ block, options }: { block: BlogCardsBlock; options: BlockRenderOptions }) {
  if (!block.posts.length) return null
  const sourceVariant = rendererVariantClassName(block)

  return (
    <section
      id={block.anchor || undefined}
      className={cx("cms-block cms-block--blogCards", sourceVariant, nativeBlockClassName(block, "section"))}
      data-source-variant={runtimeVariantDataAttribute(block)}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "blogCards", options.index)}
    >
      <div className={cx("cms-block__blogHeader", nativeBlockClassName(block, "header"))}>
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
      <div className={cx("cms-block__blogGrid", nativeBlockClassName(block, "grid"))}>
        {block.posts.map((post, i) => {
          const image = resolveMedia(post.image ?? null, options.mediaResolver)
          const href = post.href ?? post.cta?.href ?? undefined
          return (
            <article key={i} className={cx("cms-block__blogCard", nativeBlockClassName(block, "card"))}>
              {image && <img className={nativeBlockClassName(block, "image")} src={image.src} alt={image.alt ?? ""} loading="lazy" decoding="async" />}
              {(post.date || post.author) && (
                <p className={cx("cms-block__blogMeta", nativeBlockClassName(block, "meta"))}>
                  {post.date && <time>{post.date}</time>}
                  {post.author && <span>{post.author}</span>}
                </p>
              )}
              <h3>
                {href ? (
                  <a href={href} {...actionAnalyticsAttrs("inline", post.cta?.label ?? "Read article")}>
                    <RichTextRenderer value={post.title} blockMode="inline" />
                  </a>
                ) : (
                  <RichTextRenderer value={post.title} blockMode="inline" />
                )}
              </h3>
              {post.excerpt && (
                <div className="cms-block__blogExcerpt">
                  <RichTextRenderer value={post.excerpt} />
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
