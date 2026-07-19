// Owned typed adaptation of upstream shadcnui-blocks blog-03 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import type { MediaResolver } from "../../../../media"
import {
  BadgeDollarSign,
  Bike,
  BookHeart,
  BriefcaseBusiness,
  Calendar,
  ClockIcon,
  Cpu,
  FlaskRound,
  HeartPulse,
  Scale,
  type LucideIcon,
} from "lucide-react"
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

const BLOG03_CATEGORIES: Array<{ name: string; totalPosts: number; icon: LucideIcon }> = [
  { name: "Technology", totalPosts: 10, icon: Cpu },
  { name: "Business", totalPosts: 5, icon: BriefcaseBusiness },
  { name: "Finance", totalPosts: 8, icon: BadgeDollarSign },
  { name: "Health", totalPosts: 12, icon: HeartPulse },
  { name: "Lifestyle", totalPosts: 15, icon: BookHeart },
  { name: "Politics", totalPosts: 20, icon: Scale },
  { name: "Science", totalPosts: 25, icon: FlaskRound },
  { name: "Sports", totalPosts: 30, icon: Bike },
]

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
                    <div className="flex items-center gap-6">
                      <Badge className="bg-primary/5 text-primary shadow-none hover:bg-primary/5">{post.authorRole}</Badge>
                    </div>
                  ) : null}
                  {postTitle ? <h3 className="mt-4 font-medium text-[1.5rem] tracking-tight">{postTitle}</h3> : null}
                  {excerpt ? <p className="mt-2 line-clamp-3 text-ellipsis text-muted-foreground">{excerpt}</p> : null}
                  <div className="mt-4 flex items-center gap-6 font-medium text-muted-foreground text-sm">
                    {post.readTime ? (
                      <div className="flex items-center gap-2">
                        <ClockIcon className="h-4 w-4" /> {post.readTime}
                      </div>
                    ) : null}
                    {date ? (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" /> {date}
                      </div>
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
        <div className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-1">
          {BLOG03_CATEGORIES.map((category) => (
            <div
              className="flex items-center justify-between gap-2 rounded-lg bg-muted bg-opacity-15 p-3 ps-4 dark:bg-muted/70 dark:bg-opacity-25"
              key={category.name}
            >
              <div className="flex items-center gap-3">
                <category.icon className="h-5 w-5" />
                <span className="font-medium">{category.name}</span>
              </div>
              <Badge className="rounded-full bg-foreground/7 px-1.5 text-foreground">
                {category.totalPosts}
              </Badge>
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}

export default function Blog03Literal() {
  return <Blog03 title={blog03CmsLike.title} posts={blog03CmsLike.posts} blockIndex={0} />
}
