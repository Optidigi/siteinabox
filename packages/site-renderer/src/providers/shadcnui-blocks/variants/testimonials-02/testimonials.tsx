// Owned typed adaptation of upstream shadcnui-blocks testimonials-02 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { MediaResolver } from "../../../../media"
import type { TypedVariantBaseProps } from "../../typed/props"
import {
  renderTestimonialAuthor,
  renderTestimonialAvatarFallback,
  renderTestimonialAvatarImage,
  renderTestimonialAvatarWithImage,
  renderTestimonialQuote,
  renderTestimonialRole,
  renderTestimonialsIntro,
  renderTestimonialsTitle,
  sliceTestimonialItems,
  TwitterLogo,
  type TestimonialItem,
} from "../../typed/testimonials-fields"

import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import Link from "../../runtime/link"
import { testimonials01Literal } from "../../typed/fixtures/testimonials-01"
import { testimonials02CmsLike } from "../../typed/fixtures/testimonials-family"

const MAX_ITEMS = 6

export type Testimonials02Props = TypedVariantBaseProps & {
  title?: string | null
  intro?: string | null
  items: TestimonialItem[]
  mediaResolver?: MediaResolver
}

export function Testimonials02({ title, intro, items, blockIndex, editSlots, mediaResolver, rootAttributes }: Testimonials02Props) {
  void mediaResolver
  const titleContent = renderTestimonialsTitle(editSlots, title, blockIndex)
  const introContent = renderTestimonialsIntro(editSlots, intro, blockIndex)
  const displayItems = sliceTestimonialItems(items, MAX_ITEMS)

  return (
    <div className="px-6 py-20" {...rootAttributes}>
      <div>
        {titleContent ? (
          <h2 className="text-center font-medium text-4xl tracking-[-0.04em] md:text-[2.75rem]">{titleContent}</h2>
        ) : null}
        {introContent ? (
          <p className="mt-3.5 text-center text-muted-foreground text-xl tracking-[-0.015em] md:text-2xl">{introContent}</p>
        ) : null}
        <div className="mx-auto mt-14 max-w-(--breakpoint-xl) columns-1 gap-8 md:columns-2 lg:mt-16 lg:columns-3">
          {displayItems.map((item, itemIndex) => {
            const quoteContent = renderTestimonialQuote(editSlots, item.quote, blockIndex, itemIndex)
            const authorContent = renderTestimonialAuthor(editSlots, item.author, blockIndex, itemIndex)
            const roleContent = renderTestimonialRole(editSlots, item.role, blockIndex, itemIndex)
            if (!quoteContent && !authorContent) return null
            return (
              <div className="mb-8 break-inside-avoid rounded-xl border border-border/85 bg-card p-6 shadow-xs/3 dark:shadow-foreground/50 dark:shadow-lg/7" key={itemIndex}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {renderTestimonialAvatarFallback(editSlots, item.author, blockIndex, itemIndex, { className: "size-10" })}
                    <div>
                      {authorContent ? <p className="font-medium">{authorContent}</p> : null}
                      {roleContent ? <p className="text-muted-foreground text-sm">{roleContent}</p> : null}
                    </div>
                  </div>
                  <Button asChild size="icon" variant="ghost">
                    <Link href="#" target="_blank"><TwitterLogo className="h-4 w-4" /></Link>
                  </Button>
                </div>
                {quoteContent ? <p className="mt-5 text-[17px]">{quoteContent}</p> : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function Testimonials02Literal() {
  return <Testimonials02 title={testimonials01Literal.title} intro={testimonials01Literal.intro} items={testimonials01Literal.items} blockIndex={0} />
}
