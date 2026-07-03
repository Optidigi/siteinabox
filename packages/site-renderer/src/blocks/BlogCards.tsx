import * as React from "react"
import type { BlogCardsBlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../analytics"
import { resolveMedia } from "../media"
import { RichTextRenderer } from "../rich-text"
import { resolveBlockAnchor } from "./anchors"
import { cx, nativeBlockClassName } from "./native-classes"
import type { BlockRenderOptions } from "./types"
import { mergeRendererSectionProps } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function BlogCardsBlockRenderer({ block, options }: { block: BlogCardsBlock; options: BlockRenderOptions }) {
  const renderSlot = options.slots?.render
  if ((!block.posts || block.posts.length === 0) && !renderSlot) return null
  const posts: BlogCardsBlock["posts"] = block.posts && block.posts.length > 0
    ? block.posts
    : [{ title: undefined as any, excerpt: undefined, image: undefined as any, href: null, cta: null, date: null, author: null }]
  const sourceVariant = rendererVariantClassName(block, options.variantContext)
  const sectionProps = mergeRendererSectionProps(
    {
      id: renderSlot
        ? resolveBlockAnchor(block, { legacyTenant: options.variantContext?.legacyTenant, surface: options.surface })
        : block.anchor || undefined,
      className: cx("cms-block cms-block--blogCards", sourceVariant, nativeBlockClassName(block, "section", options.variantContext)),
      "data-source-variant": runtimeVariantDataAttribute(block, options.variantContext),
      "data-block-index": options.index,
      ...sectionAnalyticsAttrs(block.analytics, "blogCards", options.index),
    },
    options.sectionProps,
  )
  const title = renderSlot
    ? renderSlot({
      kind: "richtext",
      value: block.title,
      path: { blockIndex: options.index, field: "title" },
      variant: "inline",
      as: "h2",
      className: cx("cms-block__title", nativeBlockClassName(block, "title", options.variantContext)),
      placeholder: "Posts title",
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

  return (
    <section {...sectionProps}>
      <div className={cx("cms-block__blogHeader", nativeBlockClassName(block, "header", options.variantContext))}>
        {title}
        {intro}
      </div>
      <div className={cx("cms-block__blogGrid", nativeBlockClassName(block, "grid", options.variantContext))}>
        {posts.map((post, i) => {
          const image = resolveMedia(post.image ?? null, options.mediaResolver)
          const href = post.href ?? post.cta?.href ?? undefined
          const ctaValue = post.cta ?? { label: "Read more", href: post.href }
          return (
            <article key={i} className={cx("cms-block__blogCard", nativeBlockClassName(block, "card", options.variantContext))}>
              {renderSlot
                ? renderSlot({
                  kind: "image",
                  value: post.image,
                  path: { blockIndex: options.index, field: "posts", itemIndex: i, subField: "image" },
                  className: nativeBlockClassName(block, "image", options.variantContext),
                  alt: image?.alt ?? "",
                })
                : image && <img className={nativeBlockClassName(block, "image", options.variantContext)} src={image.src} alt={image.alt ?? ""} loading="lazy" decoding="async" />}
              {(post.date || post.author) && (
                <p className={cx("cms-block__blogMeta", nativeBlockClassName(block, "meta", options.variantContext))}>
                  {post.date && <time>{post.date}</time>}
                  {post.author && <span>{post.author}</span>}
                </p>
              )}
              {renderSlot ? (
                renderSlot({
                  kind: "richtext",
                  value: post.title,
                  path: { blockIndex: options.index, field: "posts", itemIndex: i, subField: "title" },
                  variant: "inline",
                  as: "h3",
                  className: "cms-block__blogTitle",
                  placeholder: "Post title",
                  blockMode: "inline",
                })
              ) : (
                <h3>
                  {href ? (
                    <a href={href} {...actionAnalyticsAttrs("inline", post.cta?.label ?? "Read article")}>
                      <RichTextRenderer value={post.title} blockMode="inline" />
                    </a>
                  ) : (
                    <RichTextRenderer value={post.title} blockMode="inline" />
                  )}
                </h3>
              )}
              {renderSlot ? (
                <div className="cms-block__blogExcerpt">
                  {renderSlot({
                    kind: "richtext",
                    value: post.excerpt,
                    path: { blockIndex: options.index, field: "posts", itemIndex: i, subField: "excerpt" },
                    variant: "block",
                    as: "div",
                    placeholder: "Excerpt",
                  })}
                </div>
              ) : post.excerpt && (
                <div className="cms-block__blogExcerpt">
                  <RichTextRenderer value={post.excerpt} />
                </div>
              )}
              {renderSlot
                ? renderSlot({
                  kind: "cta",
                  value: ctaValue,
                  path: { blockIndex: options.index, field: "posts", itemIndex: i, subField: "cta" },
                  className: "cms-block__blogCta",
                  emptyLabel: "Post action",
                  actionName: "inline",
                })
                : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}
