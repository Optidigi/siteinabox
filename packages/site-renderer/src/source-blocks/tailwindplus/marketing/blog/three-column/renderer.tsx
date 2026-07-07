import * as React from "react"
import type { BlogCardsBlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../../../../../analytics"
import { mergeRendererSectionAttributes } from "../../../../../blocks/section-attributes"
import type { BlockRenderOptions } from "../../../../../blocks/types"
import { resolveMedia } from "../../../../../media"
import { RichTextRenderer } from "../../../../../rich-text"
import { richTextSlot } from "../../../../../source-blocks/utils"

export function TailwindPlusMarketingBlogThreeColumnRenderer({
  block,
  options,
}: {
  block: BlogCardsBlock
  options: BlockRenderOptions
}) {
  const slots = options.editSlots
  const posts = block.posts.slice(0, 3)
  if (!posts.length) return null

  const sectionProps = mergeRendererSectionAttributes(
    {
      id: block.anchor || undefined,
      className: "bg-white py-24 sm:py-32 cms-block cms-block--blogCards cms-block--source-tailwindplus-blog-three-column",
      "data-provider-block": "tailwindplus",
      "data-provider-variant": "tailwindplus.marketing.blog.three-column",
      "data-source-backed-block": "true",
      "data-source-variant": "tailwindplus.marketing.blog.three-column",
      "data-block-index": options.index,
      ...sectionAnalyticsAttrs(block.analytics, "blogCards", options.index),
    },
    options.sectionAttributes,
  )

  return (
    <section {...sectionProps}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:mx-0">
          <h2 className="text-4xl font-semibold tracking-tight text-pretty text-gray-900 sm:text-5xl">
            {richTextSlot({
              options,
              name: "blogCards.title",
              value: block.title,
              variant: "inline",
              className: "contents",
              elementPath: { blockIndex: options.index, field: "title" },
              blockMode: "inline",
            })}
          </h2>
          {(block.intro || slots?.renderRichText) && (
            <div className="mt-2 text-lg/8 text-gray-600">
              {richTextSlot({
                options,
                name: "blogCards.intro",
                value: block.intro,
                variant: "block",
                className: "contents",
                elementPath: { blockIndex: options.index, field: "intro" },
              })}
            </div>
          )}
        </div>
        <div className="mx-auto mt-10 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 border-t border-gray-200 pt-10 sm:mt-16 sm:pt-16 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          {posts.map((post, index) => {
            const image = resolveMedia(post.image ?? null, options.mediaResolver)
            const href = post.href ?? post.cta?.href ?? "#"
            const categoryLabel = post.cta?.label?.trim()
            const categoryHref = post.cta?.href?.trim() ?? href
            return (
              <article key={index} className="flex max-w-xl flex-col items-start justify-between">
                <div className="flex items-center gap-x-4 text-xs">
                  {post.date || slots?.renderText ? (
                    <time className="text-gray-500">
                      {slots?.renderText
                        ? slots.renderText({
                          name: "blogCards.postDate",
                          value: post.date,
                          placeholder: "Post date",
                          elementPath: { blockIndex: options.index, field: "posts", itemIndex: index, subField: "date" },
                        })
                        : post.date}
                    </time>
                  ) : null}
                  {categoryLabel ? (
                    <a href={categoryHref} className="relative z-10 rounded-full bg-gray-50 px-3 py-1.5 font-medium text-gray-600 hover:bg-gray-100">
                      {categoryLabel}
                    </a>
                  ) : null}
                </div>
                <div className="group relative grow">
                  <h3 className="mt-3 text-lg/6 font-semibold text-gray-900 group-hover:text-gray-600">
                    <a href={href} {...actionAnalyticsAttrs("inline", categoryLabel ?? "Read article")}>
                      <span className="absolute inset-0" />
                      {richTextSlot({
                        options,
                        name: "blogCards.postTitle",
                        value: post.title,
                        variant: "inline",
                        className: "contents",
                        elementPath: { blockIndex: options.index, field: "posts", itemIndex: index, subField: "title" },
                        blockMode: "inline",
                      })}
                    </a>
                  </h3>
                  {(post.excerpt || slots?.renderRichText) && (
                    <div className="mt-5 line-clamp-3 text-sm/6 text-gray-600">
                      {richTextSlot({
                        options,
                        name: "blogCards.postExcerpt",
                        value: post.excerpt,
                        variant: "block",
                        className: "contents",
                        elementPath: { blockIndex: options.index, field: "posts", itemIndex: index, subField: "excerpt" },
                      })}
                    </div>
                  )}
                </div>
                <div className="relative mt-8 flex items-center gap-x-4 justify-self-end">
                  {slots?.renderImage
                    ? slots.renderImage({
                      name: "blogCards.postAuthorImage",
                      value: post.image,
                      alt: image?.alt ?? post.author ?? "",
                      className: "size-10 rounded-full bg-gray-50",
                      loading: "lazy",
                      decoding: "async",
                      elementPath: { blockIndex: options.index, field: "posts", itemIndex: index, subField: "image" },
                    })
                    : image ? <img src={image.src} alt={image.alt ?? post.author ?? ""} className="size-10 rounded-full bg-gray-50" loading="lazy" decoding="async" /> : null}
                  <div className="text-sm/6">
                    {post.author || slots?.renderText ? (
                      <p className="font-semibold text-gray-900">
                        <a href={href}>
                          <span className="absolute inset-0" />
                          {slots?.renderText
                            ? slots.renderText({
                              name: "blogCards.postAuthor",
                              value: post.author,
                              placeholder: "Author",
                              elementPath: { blockIndex: options.index, field: "posts", itemIndex: index, subField: "author" },
                            })
                            : post.author}
                        </a>
                      </p>
                    ) : null}
                    {post.authorRole || slots?.renderText ? (
                      <p className="text-gray-600">
                        {slots?.renderText
                          ? slots.renderText({
                            name: "blogCards.postAuthorRole",
                            value: post.authorRole,
                            placeholder: "Role",
                            elementPath: { blockIndex: options.index, field: "posts", itemIndex: index, subField: "authorRole" },
                          })
                          : post.authorRole}
                      </p>
                    ) : null}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
