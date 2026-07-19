// Owned typed adaptation of upstream shadcnui-blocks blog-03 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import type { MediaResolver } from "../../../../media"
import { Calendar, ClockIcon } from "lucide-react"
import { Badge } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { Card, CardContent } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { blog03CmsLike } from "../../typed/fixtures/blog-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import {
  renderBlogPostDate,
  renderBlogPostExcerpt,
  renderBlogPostImage,
  renderBlogPostTitle,
  renderBlogTitle,
  sliceBlogPosts,
  type BlogPostItem,
} from "../../typed/blog-fields"

const MAX_POSTS = 12

export type Blog03Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  posts: BlogPostItem[]
  mediaResolver?: MediaResolver
}

export function Blog03({ title, posts, blockIndex, editSlots, mediaResolver, rootAttributes }: Blog03Props) {
  const titleContent = renderBlogTitle(editSlots, title, blockIndex)
  const displayPosts = sliceBlogPosts(posts, MAX_POSTS)

  return (
    <div className="mx-auto flex max-w-(--breakpoint-xl) flex-col items-start gap-12 px-6 py-10 lg:flex-row lg:py-16 xl:px-0" {...rootAttributes}>
      <div>
        <div className="space-y-12">
          {displayPosts.map((post, itemIndex) => {
            const postTitle = renderBlogPostTitle(editSlots, post.title, blockIndex, itemIndex)
            const excerpt = renderBlogPostExcerpt(editSlots, post.excerpt, blockIndex, itemIndex)
            const date = renderBlogPostDate(editSlots, post.date, blockIndex, itemIndex)
            if (!postTitle && !excerpt && !post.image) return null
            return (
              <Card
                className="flex flex-col overflow-hidden rounded-md border-none bg-background py-0 shadow-none sm:flex-row sm:items-center"
                key={itemIndex}
              >
                <div className="relative aspect-video shrink-0 grow overflow-hidden rounded-lg sm:aspect-square sm:w-56">
                  {renderBlogPostImage(editSlots, mediaResolver, post.image, "Blog post", blockIndex, itemIndex, {
                    className: "object-cover",
                    fill: true,
                    sizes: "(max-width: 640px) 100vw, 224px",
                  })}
                </div>
                <CardContent className="flex flex-col px-0 py-0 sm:px-6">
                  {post.authorRole ? (
                    <Badge className="bg-primary/5 text-primary shadow-none hover:bg-primary/5">{post.authorRole}</Badge>
                  ) : null}
                  {postTitle ? <h3 className="mt-4 font-medium text-[1.5rem] tracking-tight">{postTitle}</h3> : null}
                  {excerpt ? <p className="mt-2 line-clamp-3 text-ellipsis text-muted-foreground">{excerpt}</p> : null}
                  <div className="mt-4 flex items-center gap-6 font-medium text-muted-foreground text-sm">
                    <div className="flex items-center gap-2"><ClockIcon className="h-4 w-4" /> 5 min read</div>
                    {date ? (
                      <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /> {date}</div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
      <aside className="sticky top-8 w-full shrink-0 lg:max-w-sm">
        {titleContent ? <h3 className="font-medium text-xl tracking-tight">{titleContent}</h3> : null}
      </aside>
    </div>
  )
}

export default function Blog03Literal() {
  return <Blog03 title={blog03CmsLike.title} posts={blog03CmsLike.posts} blockIndex={0} />
}
