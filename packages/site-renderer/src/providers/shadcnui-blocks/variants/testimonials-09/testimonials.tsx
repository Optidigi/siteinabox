// Owned typed adaptation of upstream shadcnui-blocks testimonials-09 (MIT, see ../../LICENSE).

import * as React from "react"
import type { MediaResolver } from "../../../../media"
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
    author: "Daniel Kim",
    role: "CTO at NextLaunch",
    quote:
      "We integrated this solution into our stack within days, and the benefits were immediate. Our team collaboration improved, deployment times dropped, and the analytics insights have helped us fine-tune performance at every level.",
  },
  {
    author: "Emily Chen",
    role: "Marketing Manager at HubSpot",
    quote:
      "I've worked with multiple marketing platforms over the years, but none have offered the kind of personalized experience and seamless integration that this one does. It has truly elevated our campaigns and improved our ROI.",
  },
  {
    author: "Raj Mehta",
    role: "Frontend Developer at Zomato",
    quote: "Clean, fast, and reliable. Everything a dev could ask for.",
  },
  {
    author: "Aisha Patel",
    role: "Software Engineer at Swiggy",
    quote: "Smooth and delightful experience!",
  },
  {
    author: "Liam Garcia",
    role: "Startup Founder",
    quote:
      "I've used dozens of tools in the past year alone, and this is one of the few I'd actually recommend to other founders. It doesn't just work — it works smart. Everything feels thoughtfully designed and built with care.",
  },
]

export type Testimonials09Props = TypedVariantBaseProps & {
  title?: string | null
  intro?: string | null
  items: TestimonialItem[]
  mediaResolver?: MediaResolver
  literalPreviewImages?: string[]
}

export function Testimonials09({
  title,
  intro,
  items,
  blockIndex,
  editSlots,
  mediaResolver,
  literalPreviewImages,
  rootAttributes,
}: Testimonials09Props) {
  const titleContent = renderTestimonialsTitle(editSlots, title, blockIndex)
  const introContent = renderTestimonialsIntro(editSlots, intro, blockIndex)
  const displayItems = sliceTestimonialItems(items, MAX_ITEMS)

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 sm:py-20" {...rootAttributes}>
      {titleContent ? (
        <h2 className="text-center font-medium text-4xl tracking-[-0.04em] md:text-[2.75rem]">{titleContent}</h2>
      ) : null}
      {introContent ? (
        <p className="mt-2 text-balance text-center text-lg text-muted-foreground tracking-[-0.015em] sm:mt-4 sm:text-2xl">
          {introContent}
        </p>
      ) : null}
      <div className="mx-auto mt-16 max-w-5xl columns-1 gap-6 sm:columns-2 lg:columns-3">
        {displayItems.map((item, itemIndex) => {
          const quoteContent = renderTestimonialQuote(editSlots, item.quote, blockIndex, itemIndex)
          const authorContent = renderTestimonialAuthor(editSlots, item.author, blockIndex, itemIndex)
          const roleContent = renderTestimonialRole(editSlots, item.role, blockIndex, itemIndex)
          if (!quoteContent && !authorContent) return null
          return (
            <div
              className="relative mb-6 flex break-inside-avoid flex-col rounded-lg border border-primary/20 bg-linear-to-br from-primary/20 to-primary/10 px-5 pt-10 pb-3"
              key={itemIndex}
            >
              <span className="absolute top-0 left-4 select-none font-satoshi text-9xl text-primary/50">&ldquo;</span>
              {quoteContent ? <p className="grow py-6 font-medium text-lg">{quoteContent}</p> : null}
              <div className="mt-2 flex items-center gap-3 py-3.5 sm:mt-4">
                {renderTestimonialAvatarImage(
                  editSlots,
                  mediaResolver,
                  item.avatar,
                  item.author,
                  blockIndex,
                  itemIndex,
                  {
                    className: "size-12 rounded-full",
                    height: 48,
                    width: 48,
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

export default function Testimonials09Literal() {
  return (
    <Testimonials09
      title="Loved by Our Users"
      intro="Their experiences speak louder than words"
      items={LITERAL_ITEMS}
      literalPreviewImages={LITERAL_IMAGES}
      blockIndex={0}
    />
  )
}
