// Owned typed adaptation of upstream shadcnui-blocks testimonials-08 (MIT, see ../../LICENSE).

import * as React from "react"
import { Separator } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import type { MediaResolver } from "../../../../media"
import { testimonials07CmsLike } from "../../typed/fixtures/testimonials-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import {
  renderTestimonialAuthor,
  renderTestimonialAvatarImage,
  renderTestimonialQuote,
  renderTestimonialRole,
  renderTestimonialsIntro,
  renderTestimonialsTitle,
  sliceTestimonialItems,
  type TestimonialItem,
} from "../../typed/testimonials-fields"

const MAX_ITEMS = 6

const LITERAL_IMAGES = [
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:1afc9",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:9e883",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:4dca5",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:6f6a8",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:3e0f4",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:e4121",
]

const LITERAL_ITEMS: TestimonialItem[] = [
  {
    author: "Sarah Johnson",
    role: "Product Designer at Canva",
    quote:
      "This product completely changed the way I work. The interface is intuitive and the performance is top-notch.",
  },
  {
    author: "Raj Mehta",
    role: "Frontend Developer at Zomato",
    quote:
      "It's rare to find a tool that blends design and usability so well. Highly recommend it to all developers!",
  },
  {
    author: "Emily Chen",
    role: "Marketing Manager at HubSpot",
    quote: "The experience has been seamless from day one. Great support, fast delivery, and amazing value.",
  },
  {
    author: "Daniel Kim",
    role: "CTO at NextLaunch",
    quote:
      "We integrated this solution into our workflow and saw an instant boost in productivity and collaboration.",
  },
  {
    author: "Aisha Patel",
    role: "Software Engineer at Swiggy",
    quote:
      "I've used several tools in this category, but nothing matches the polish and reliability of this one.",
  },
  {
    author: "Liam Garcia",
    role: "Startup Founder",
    quote: "As a founder, I care about speed and simplicity. This product delivers on both fronts beautifully.",
  },
]

export type Testimonials08Props = TypedVariantBaseProps & {
  title?: string | null
  intro?: string | null
  items: TestimonialItem[]
  mediaResolver?: MediaResolver
  literalPreviewImages?: string[]
}

export function Testimonials08({
  title,
  intro,
  items,
  blockIndex,
  editSlots,
  mediaResolver,
  literalPreviewImages,
  rootAttributes,
}: Testimonials08Props) {
  const titleContent = renderTestimonialsTitle(editSlots, title, blockIndex)
  const introContent = renderTestimonialsIntro(editSlots, intro, blockIndex)
  const displayItems = sliceTestimonialItems(items, MAX_ITEMS)

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 sm:py-20" {...rootAttributes}>
      {titleContent ? (
        <h2 className="text-center font-medium text-4xl tracking-[-0.04em] md:text-[2.75rem]">{titleContent}</h2>
      ) : null}
      {introContent ? (
        <p className="mt-2.5 text-balance text-center text-lg text-muted-foreground tracking-[-0.015em] sm:text-2xl">
          {introContent}
        </p>
      ) : null}
      <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {displayItems.map((item, itemIndex) => {
          const quoteContent = renderTestimonialQuote(editSlots, item.quote, blockIndex, itemIndex)
          const authorContent = renderTestimonialAuthor(editSlots, item.author, blockIndex, itemIndex)
          const roleContent = renderTestimonialRole(editSlots, item.role, blockIndex, itemIndex)
          if (!quoteContent && !authorContent) return null
          return (
            <div className="relative flex flex-col rounded-lg border bg-muted/70 px-5 pt-10 pb-3" key={itemIndex}>
              <span className="absolute top-2 left-4 font-satoshi text-8xl text-foreground/30">&ldquo;</span>
              {quoteContent ? <p className="grow py-6 font-medium text-lg">{quoteContent}</p> : null}
              <Separator />
              <div className="flex items-center gap-3 py-3.5">
                {renderTestimonialAvatarImage(
                  editSlots,
                  mediaResolver,
                  item.avatar,
                  item.author,
                  blockIndex,
                  itemIndex,
                  {
                    className: "h-10 w-10 rounded-full",
                    height: 40,
                    width: 40,
                    literalPreviewSrc: literalPreviewImages?.[itemIndex],
                  },
                )}
                <div className="flex flex-col">
                  {authorContent ? <p className="font-medium">{authorContent}</p> : null}
                  {roleContent ? <p className="text-muted-foreground text-sm">{roleContent}</p> : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Testimonials08Literal() {
  return (
    <Testimonials08
      title={testimonials07CmsLike.title}
      intro={testimonials07CmsLike.intro}
      items={LITERAL_ITEMS}
      literalPreviewImages={LITERAL_IMAGES}
      blockIndex={0}
    />
  )
}
