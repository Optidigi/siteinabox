// Owned typed adaptation of upstream shadcnui-blocks testimonials-04 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { MediaResolver } from "../../../../media"
import { Button, Marquee } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import Link from "../../runtime/link"
import { testimonials01Literal } from "../../typed/fixtures/testimonials-01"
import { testimonials04CmsLike } from "../../typed/fixtures/testimonials-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import {
  renderTestimonialAuthor,
  renderTestimonialAvatarFallback,
  renderTestimonialQuote,
  renderTestimonialRole,
  renderTestimonialsIntro,
  renderTestimonialsTitle,
  sliceTestimonialItems,
  TwitterLogo,
  type TestimonialItem,
} from "../../typed/testimonials-fields"

const MAX_ITEMS = 6

export type Testimonials04Props = TypedVariantBaseProps & {
  title?: string | null
  intro?: string | null
  items: TestimonialItem[]
  mediaResolver?: MediaResolver
}

function TestimonialList({
  items,
  blockIndex,
  editSlots,
}: {
  items: TestimonialItem[]
  blockIndex: number
  editSlots?: Testimonials04Props["editSlots"]
}) {
  const displayItems = sliceTestimonialItems(items, MAX_ITEMS)

  return (
    <>
      {displayItems.map((item, itemIndex) => {
        const quoteContent = renderTestimonialQuote(editSlots, item.quote, blockIndex, itemIndex)
        const authorContent = renderTestimonialAuthor(editSlots, item.author, blockIndex, itemIndex)
        const roleContent = renderTestimonialRole(editSlots, item.role, blockIndex, itemIndex)
        if (!quoteContent && !authorContent) return null
        return (
          <div className="min-w-96 max-w-sm rounded-xl bg-accent p-6" key={itemIndex}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {renderTestimonialAvatarFallback(editSlots, item.author, blockIndex, itemIndex, {
                  className: "size-10",
                })}
                <div>
                  {authorContent ? <p className="font-medium">{authorContent}</p> : null}
                  {roleContent ? <p className="text-muted-foreground text-sm">{roleContent}</p> : null}
                </div>
              </div>
              <Button asChild size="icon" variant="ghost">
                <Link href="#" target="_blank">
                  <TwitterLogo className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            {quoteContent ? <p className="mt-5 text-[17px]">{quoteContent}</p> : null}
          </div>
        )
      })}
    </>
  )
}

export function Testimonials04({
  title,
  intro,
  items,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
}: Testimonials04Props) {
  void mediaResolver
  const titleContent = renderTestimonialsTitle(editSlots, title, blockIndex)
  const introContent = renderTestimonialsIntro(editSlots, intro, blockIndex)

  return (
    <div className="px-6 py-20" {...rootAttributes}>
      {titleContent ? (
        <h2 className="text-center font-medium text-4xl tracking-[-0.04em] md:text-[2.75rem]">{titleContent}</h2>
      ) : null}
      {introContent ? (
        <p className="mt-3.5 text-center text-muted-foreground text-xl tracking-[-0.015em] md:text-2xl">{introContent}</p>
      ) : null}
      <div className="mask-x-from-80% mt-14">
        <Marquee className="[--duration:60s]" pauseOnHover>
          <TestimonialList blockIndex={blockIndex} editSlots={editSlots} items={items} />
        </Marquee>
        <Marquee className="mt-0 [--duration:60s]" pauseOnHover reverse>
          <TestimonialList blockIndex={blockIndex} editSlots={editSlots} items={items} />
        </Marquee>
      </div>
    </div>
  )
}

export default function Testimonials04Literal() {
  return (
    <Testimonials04
      title={testimonials04CmsLike.title}
      intro={testimonials04CmsLike.intro}
      items={testimonials01Literal.items}
      blockIndex={0}
    />
  )
}
