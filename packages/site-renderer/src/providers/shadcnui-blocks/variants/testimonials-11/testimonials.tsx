// Owned typed adaptation of upstream shadcnui-blocks testimonials-11 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { cn } from "@siteinabox/ui/lib/utils"
import type { MediaResolver } from "../../../../media"
import { testimonials11CmsLike } from "../../typed/fixtures/testimonials-family"
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

export type Testimonials11Props = TypedVariantBaseProps & {
  title?: string | null
  intro?: string | null
  items: TestimonialItem[]
  mediaResolver?: MediaResolver
  literalPreviewImages?: string[]
}

export function Testimonials11({
  title,
  intro,
  items,
  blockIndex,
  editSlots,
  mediaResolver,
  literalPreviewImages,
  rootAttributes,
}: Testimonials11Props) {
  const [api, setApi] = React.useState<CarouselApi | null>(null)
  const [count, setCount] = React.useState(0)
  const [current, setCurrent] = React.useState(0)
  const titleContent = renderTestimonialsTitle(editSlots, title, blockIndex)
  const introContent = renderTestimonialsIntro(editSlots, intro, blockIndex)
  const displayItems = sliceTestimonialItems(items, MAX_ITEMS)

  React.useEffect(() => {
    if (!api) return
    setCount(api.scrollSnapList().length)
    setCurrent(api.selectedScrollSnap() + 1)
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap() + 1)
    })
  }, [api])

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
      <div className="mx-auto mt-20 max-w-248 md:mt-16 md:px-12">
        <Carousel opts={{ align: "start" }} setApi={setApi}>
          <CarouselContent>
            {displayItems.map((item, itemIndex) => {
              const quoteContent = renderTestimonialQuote(editSlots, item.quote, blockIndex, itemIndex)
              const authorContent = renderTestimonialAuthor(editSlots, item.author, blockIndex, itemIndex)
              const roleContent = renderTestimonialRole(editSlots, item.role, blockIndex, itemIndex)
              const literalSrc = literalPreviewImages?.[itemIndex]
              if (!quoteContent && !authorContent) return null
              return (
                <CarouselItem key={itemIndex}>
                  <div className="relative flex gap-8 rounded-lg border bg-muted/70 p-8 pt-16 pr-8 md:pt-8">
                    <span className="absolute top-3 left-6.5 font-satoshi text-8xl md:hidden">&ldquo;</span>
                    <div className="flex flex-col gap-2">
                      {quoteContent ? (
                        <p className="grow font-medium text-xl leading-relaxed tracking-tight sm:text-2xl sm:leading-[1.45] lg:text-3xl">
                          {quoteContent}
                        </p>
                      ) : null}
                      <div className="mt-6 flex items-center gap-2 md:mt-0">
                        {renderTestimonialAvatarImage(
                          editSlots,
                          mediaResolver,
                          item.avatar,
                          item.author,
                          blockIndex,
                          itemIndex,
                          {
                            className: "aspect-square h-12 rounded-full md:hidden",
                            height: 48,
                            width: 48,
                            literalPreviewSrc: literalSrc,
                          },
                        )}
                        <div className="flex flex-col">
                          {authorContent ? <p className="font-medium text-lg">{authorContent}</p> : null}
                          {roleContent ? <p className="text-muted-foreground">{roleContent}</p> : null}
                        </div>
                      </div>
                    </div>
                    {renderTestimonialAvatarImage(
                      editSlots,
                      mediaResolver,
                      item.avatar,
                      item.author,
                      blockIndex,
                      itemIndex,
                      {
                        className: "hidden aspect-square max-w-60 rounded-lg md:block",
                        height: 240,
                        width: 240,
                        literalPreviewSrc: literalSrc,
                      },
                    )}
                  </div>
                </CarouselItem>
              )
            })}
          </CarouselContent>
          <CarouselPrevious className="-top-2.5 right-2 ml-auto -translate-x-full -translate-y-full md:top-1/2 md:-left-12 md:m-0 md:translate-x-0 md:-translate-y-1/2 lg:md:-left-16" />
          <CarouselNext className="-top-2.5 right-0 ml-auto -translate-y-full md:top-1/2 md:-right-12 md:m-0 md:-translate-y-1/2 lg:md:-right-16" />
        </Carousel>
        <div className="mt-6 flex items-center justify-center gap-2">
          {Array.from({ length: count }).map((_, index) => (
            <div
              className={cn("h-2 w-2 rounded-full", current === index + 1 ? "bg-primary" : "bg-primary/20")}
              key={index}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Testimonials11Literal() {
  return (
    <Testimonials11
      title={testimonials11CmsLike.title}
      intro={testimonials11CmsLike.intro}
      items={LITERAL_ITEMS}
      literalPreviewImages={LITERAL_IMAGES}
      blockIndex={0}
    />
  )
}
