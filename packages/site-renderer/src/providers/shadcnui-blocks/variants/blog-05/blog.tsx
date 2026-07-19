// Owned typed adaptation of upstream shadcnui-blocks blog-05 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { LinkRef, RtRoot } from "@siteinabox/contracts"
import type { MediaResolver } from "../../../../media"
import { CalendarDays, Dot, Mails, User } from "lucide-react"
import { Badge } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { Separator } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { blog04CmsLike } from "../../typed/fixtures/blog-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import {
  formatBlogDate,
  renderBlogCta,
  renderBlogIntro,
  renderBlogPostAuthor,
  renderBlogPostDate,
  renderBlogPostImage,
  renderBlogPostTitle,
  renderBlogTitle,
  sliceBlogPosts,
  type BlogPostItem,
} from "../../typed/blog-fields"

const MAX_POSTS = 12

export type Blog05Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  posts: BlogPostItem[]
  cta?: LinkRef | null
  secondary?: LinkRef | null
  mediaResolver?: MediaResolver
}

export function Blog05({
  title,
  intro,
  posts,
  cta,
  secondary,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
}: Blog05Props) {
  const titleContent = renderBlogTitle(editSlots, title, blockIndex)
  const introContent = renderBlogIntro(editSlots, intro, blockIndex)
  const ctaContent = renderBlogCta(editSlots, cta, blockIndex, "cta", { leadingIcon: <Mails /> })
  const secondaryContent = renderBlogCta(editSlots, secondary, blockIndex, "secondary")
  const displayPosts = sliceBlogPosts(posts, MAX_POSTS)

  return (
    <section className="mx-auto max-w-7xl px-6 py-16" {...rootAttributes}>
      <div className="flex items-end justify-between gap-4">
        <div>
          {titleContent ? <h2 className="text-balance font-medium text-2xl tracking-tight">{titleContent}</h2> : null}
          {introContent ? <p className="mt-0.5 text-pretty text-lg text-muted-foreground tracking-normal">{introContent}</p> : null}
        </div>
        {ctaContent ? <Button className="hidden gap-3 sm:inline-flex" size="lg" variant="secondary">{ctaContent}</Button> : null}
      </div>
      <Separator className="mt-7 mb-10" />
      <div className="grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-2">
        {displayPosts.map((post, itemIndex) => {
          const postTitle = renderBlogPostTitle(editSlots, post.title, blockIndex, itemIndex)
          const author = renderBlogPostAuthor(editSlots, post.author, blockIndex, itemIndex)
          const date = renderBlogPostDate(editSlots, post.date, blockIndex, itemIndex)
          if (!postTitle && !author && !post.image) return null
          return (
            <div className="flex flex-col gap-5 sm:flex-row" key={itemIndex}>
              <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl sm:w-56">
                {renderBlogPostImage(editSlots, mediaResolver, post.image, "Blog post", blockIndex, itemIndex, {
                  className: "object-cover",
                  fill: true,
                })}
              </div>
              <div>
                {post.authorRole ? <Badge variant="secondary">{post.authorRole}</Badge> : null}
                {postTitle ? <h3 className="mt-3 font-medium text-xl tracking-tight">{postTitle}</h3> : null}
                <div className="mt-3 flex flex-wrap items-center gap-1 text-muted-foreground text-sm">
                  {author ? (
                    <span className="inline-flex items-center gap-1"><User className="h-4 w-4" /> {author}</span>
                  ) : null}
                  {date ? (
                    <>
                      <Dot />
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-4 w-4" /> {formatBlogDate(post.date ?? "")}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {secondaryContent ? <div className="mt-12 flex justify-center"><Button variant="outline">{secondaryContent}</Button></div> : null}
    </section>
  )
}

export default function Blog05Literal() {
  return (
    <Blog05
      title={blog04CmsLike.title}
      intro={blog04CmsLike.intro}
      posts={blog04CmsLike.posts}
      cta={blog04CmsLike.cta}
      secondary={blog04CmsLike.secondary}
      blockIndex={0}
    />
  )
}
