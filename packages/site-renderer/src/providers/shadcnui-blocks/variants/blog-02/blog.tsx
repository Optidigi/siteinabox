// Owned typed adaptation of upstream shadcnui-blocks blog-02 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import type { MediaResolver } from "../../../../media"
import { ChevronRight } from "lucide-react"
import { Badge } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { Card, CardContent, CardHeader } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { blog02CmsLike } from "../../typed/fixtures/blog-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import {
  renderBlogPostExcerpt,
  renderBlogPostImage,
  renderBlogPostTitle,
  renderBlogTitle,
  sliceBlogPosts,
  type BlogPostItem,
} from "../../typed/blog-fields"

const MAX_POSTS = 12

export type Blog02Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  posts: BlogPostItem[]
  mediaResolver?: MediaResolver
}

export function Blog02({ title, posts, blockIndex, editSlots, mediaResolver, rootAttributes }: Blog02Props) {
  const titleContent = renderBlogTitle(editSlots, title, blockIndex)
  const displayPosts = sliceBlogPosts(posts, MAX_POSTS)

  return (
    <div className="mx-auto max-w-(--breakpoint-xl) px-6 py-16 xl:px-0" {...rootAttributes}>
      <div className="flex items-end justify-between">
        {titleContent ? <h2 className="font-medium text-[1.5rem] tracking-tight">{titleContent}</h2> : null}
        <Select defaultValue="recommended">
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recommended">Recommended</SelectItem>
            <SelectItem value="latest">Latest</SelectItem>
            <SelectItem value="popular">Popular</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="mt-4 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
        {displayPosts.map((post, itemIndex) => {
          const postTitle = renderBlogPostTitle(editSlots, post.title, blockIndex, itemIndex)
          const excerpt = renderBlogPostExcerpt(editSlots, post.excerpt, blockIndex, itemIndex)
          if (!postTitle && !excerpt && !post.image) return null
          return (
            <Card className="gap-0 overflow-hidden rounded-lg py-0 shadow-none" key={itemIndex}>
              <CardHeader className="relative p-0">
                <div className="relative aspect-video w-full border-b">
                  {renderBlogPostImage(editSlots, mediaResolver, post.image, "Blog post", blockIndex, itemIndex, {
                    className: "object-cover",
                    fill: true,
                    sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
                  })}
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {post.authorRole ? (
                    <Badge className="bg-primary/5 text-primary shadow-none hover:bg-primary/5">{post.authorRole}</Badge>
                  ) : null}
                </div>
                {postTitle ? <h3 className="mt-4 font-medium text-[1.4rem] text-xl tracking-[-0.02em]">{postTitle}</h3> : null}
                {excerpt ? <p className="mt-2 text-muted-foreground">{excerpt}</p> : null}
                <Button className="mt-6 shadow-none">Read more <ChevronRight /></Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export default function Blog02Literal() {
  return <Blog02 title={blog02CmsLike.title} posts={blog02CmsLike.posts} blockIndex={0} />
}
