// Owned typed adaptation of upstream shadcnui-blocks blog-01 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import type { MediaResolver } from "../../../../media"
import { Badge } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { Card, CardContent, CardHeader } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { blog01CmsLike } from "../../typed/fixtures/blog-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import {
  renderBlogPostAuthor,
  renderBlogPostDate,
  renderBlogPostImage,
  renderBlogPostTitle,
  renderBlogTitle,
  sliceBlogPosts,
  type BlogPostItem,
} from "../../typed/blog-fields"

const MAX_POSTS = 12

export type Blog01Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  posts: BlogPostItem[]
  mediaResolver?: MediaResolver
}

export function Blog01({ title, posts, blockIndex, editSlots, mediaResolver, rootAttributes }: Blog01Props) {
  const titleContent = renderBlogTitle(editSlots, title, blockIndex)
  const displayPosts = sliceBlogPosts(posts, MAX_POSTS)

  return (
    <div className="mx-auto max-w-(--breakpoint-xl) px-6 py-16 xl:px-0" {...rootAttributes}>
      <div className="flex items-end justify-between">
        {titleContent ? <h2 className="font-medium text-[1.5rem] tracking-tight">{titleContent}</h2> : null}
        <Select defaultValue="recommended">
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recommended">Recommended</SelectItem>
            <SelectItem value="latest">Latest</SelectItem>
            <SelectItem value="popular">Popular</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="mt-6 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
        {displayPosts.map((post, itemIndex) => {
          const postTitle = renderBlogPostTitle(editSlots, post.title, blockIndex, itemIndex)
          const author = renderBlogPostAuthor(editSlots, post.author, blockIndex, itemIndex)
          const date = renderBlogPostDate(editSlots, post.date, blockIndex, itemIndex)
          if (!postTitle && !author && !date && !post.image) return null
          return (
            <Card className="gap-3 bg-muted/30 py-0 shadow-none" key={itemIndex}>
              <CardHeader className="p-1.5 pb-0">
                <div className="relative aspect-video w-full overflow-hidden rounded-lg">
                  {renderBlogPostImage(editSlots, mediaResolver, post.image, "Blog post", blockIndex, itemIndex, {
                    className: "object-cover",
                    fill: true,
                    sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
                  })}
                </div>
              </CardHeader>
              <CardContent className="px-4 pt-0 pb-5">
                {post.authorRole ? <Badge variant="secondary">{post.authorRole}</Badge> : null}
                {postTitle ? <h3 className="mt-4 font-medium text-[1.4rem] text-xl tracking-[-0.02em]">{postTitle}</h3> : null}
                <div className="mt-6 flex items-center justify-between">
                  {author ? (
                    <div className="flex items-center gap-2">
                      <img
                        alt={typeof author === "string" ? author : "Author"}
                        className="size-8 rounded-full object-cover"
                        height={32}
                        src={`data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3C/svg%3E`}
                        width={32}
                      />
                      <span className="font-medium text-muted-foreground">{author}</span>
                    </div>
                  ) : (
                    <span />
                  )}
                  {date ? <span className="text-muted-foreground text-sm">{date}</span> : null}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export default function Blog01Literal() {
  return <Blog01 title={blog01CmsLike.title} posts={blog01CmsLike.posts} blockIndex={0} />
}
