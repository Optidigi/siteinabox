// Owned typed adaptation of upstream shadcnui-blocks blog-06 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { LinkRef, RtRoot } from "@siteinabox/contracts"
import type { MediaResolver } from "../../../../media"
import { ArrowRight, CalendarDays, Dot, Mails, User } from "lucide-react"
import { Badge } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { Separator } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { blog06CmsLike } from "../../typed/fixtures/blog-family"
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

export type Blog06Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  posts: BlogPostItem[]
  cta?: LinkRef | null
  secondary?: LinkRef | null
  mediaResolver?: MediaResolver
}

export function Blog06({
  title,
  intro,
  posts,
  cta,
  secondary,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
}: Blog06Props) {
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
      <div className="grid grid-cols-1 gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
        {displayPosts.map((post, itemIndex) => {
          const postTitle = renderBlogPostTitle(editSlots, post.title, blockIndex, itemIndex)
          const author = renderBlogPostAuthor(editSlots, post.author, blockIndex, itemIndex)
          if (!postTitle && !author && !post.image) return null
          return (
            <a href={post.href ?? "#"} key={itemIndex}>
              <div className="overflow-hidden rounded-xl bg-muted p-2 pb-4">
                <div className="relative isolate">
                  {renderBlogPostImage(editSlots, mediaResolver, post.image, "Blog post", blockIndex, itemIndex, {
                    className: "aspect-[14/9] w-full rounded-lg bg-muted",
                  })}
                  {renderBlogPostImage(editSlots, mediaResolver, post.image, "Blog post", blockIndex, itemIndex, {
                    className: "absolute inset-0 -z-10 aspect-17/9 scale-y-110 rounded bg-muted blur-2xl",
                  })}
                </div>
                <div className="px-2 py-1">
                  {(post.tags?.length ?? 0) > 0 ? (
                    <div className="-ms-0.5 mt-4 flex flex-wrap items-center gap-2">
                      {post.tags!.map((tag) => (
                        <Badge
                          className="bg-indigo-600/10 text-indigo-500 dark:bg-indigo-500/35 dark:text-indigo-300"
                          key={tag}
                          variant="secondary"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  {postTitle ? <h3 className="mt-4 font-medium text-xl tracking-[-0.015em]">{postTitle}</h3> : null}
                  <div className="mt-3 flex items-center gap-1">
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
                  <Button className="mt-6">
                    Read Article <ArrowRight className="h-4 w-4" />
                  </Button>
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

export default function Blog06Literal() {
  return (
    <Blog06
      title={blog06CmsLike.title}
      intro={blog06CmsLike.intro}
      posts={blog06CmsLike.posts}
      cta={blog06CmsLike.cta}
      secondary={blog06CmsLike.secondary}
      blockIndex={0}
    />
  )
}
