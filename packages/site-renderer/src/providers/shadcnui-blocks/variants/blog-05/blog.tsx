// Owned typed adaptation of upstream shadcnui-blocks blog-05 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { LinkRef, RtRoot } from "@siteinabox/contracts"
import type { MediaResolver } from "../../../../media"
import { CalendarDays, Dot, Mails, User } from "lucide-react"
import { Badge } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { Separator } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { blog05CmsLike } from "../../typed/fixtures/blog-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import {
  formatBlogDate,
  renderBlogCta,
  renderBlogIntro,
  renderBlogPostAuthor,
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
  const ctaContent = renderBlogCta(editSlots, cta, blockIndex)
  const secondaryContent = renderBlogCta(editSlots, secondary, blockIndex, "secondary")
  const displayPosts = sliceBlogPosts(posts, MAX_POSTS)

  return (
    <section className="mx-auto max-w-7xl px-6 py-16" {...rootAttributes}>
      <div className="flex items-end justify-between gap-4">
        <div>
          {titleContent ? <h2 className="text-balance font-medium text-2xl tracking-tight">{titleContent}</h2> : null}
          {introContent ? <p className="mt-0.5 text-pretty text-lg text-muted-foreground tracking-normal">{introContent}</p> : null}
        </div>
        {ctaContent ? (
          <Button className="hidden gap-3 sm:inline-flex" size="lg" variant="secondary">
            <Mails />
            <span className="hidden lg:inline">{ctaContent}</span>
            <span className="hidden md:inline lg:hidden">Subscribe</span>
          </Button>
        ) : null}
      </div>
      <Separator className="mt-7 mb-10" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {displayPosts.map((post, itemIndex) => {
          const postTitle = renderBlogPostTitle(editSlots, post.title, blockIndex, itemIndex)
          const author = renderBlogPostAuthor(editSlots, post.author, blockIndex, itemIndex)
          if (!postTitle && !author && !post.image) return null
          return (
            <a href={post.href ?? "#"} key={itemIndex}>
              <div className="flex flex-col gap-x-6 gap-y-4 rounded-xl bg-muted p-2.5 pb-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:pe-4 sm:pb-3">
                {renderBlogPostImage(editSlots, mediaResolver, post.image, "Blog post", blockIndex, itemIndex, {
                  className: "aspect-video w-full rounded-lg bg-muted object-cover sm:aspect-square sm:max-w-40",
                })}
                <div className="px-1 sm:px-0">
                  {postTitle ? <h3 className="font-medium text-xl tracking-[-0.015em]">{postTitle}</h3> : null}
                  {(post.tags?.length ?? 0) > 0 ? (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {post.tags!.map((tag) => (
                        <Badge
                          className="bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/15 dark:text-indigo-400"
                          key={tag}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-4 flex items-center gap-1">
                    {post.date ? (
                      <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                        <CalendarDays className="h-4 w-4" />
                        {formatBlogDate(post.date)}
                      </div>
                    ) : null}
                    {author ? (
                      <>
                        <Dot className="text-muted-foreground" />
                        <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                          <User className="h-4 w-4" /> {author}
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </a>
          )
        })}
      </div>
      {secondaryContent ? (
        <Button className="mx-auto mt-16 flex" size="lg" variant="secondary">
          {secondaryContent}
        </Button>
      ) : null}
    </section>
  )
}

export default function Blog05Literal() {
  return (
    <Blog05
      title={blog05CmsLike.title}
      intro={blog05CmsLike.intro}
      posts={blog05CmsLike.posts}
      cta={blog05CmsLike.cta}
      secondary={blog05CmsLike.secondary}
      blockIndex={0}
    />
  )
}
