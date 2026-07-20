// Owned typed adaptation of upstream shadcnui-blocks testimonials-05 (MIT, see ../../LICENSE).

import * as React from "react"
import { StarIcon } from "lucide-react"
import { cn } from "@siteinabox/ui/lib/utils"
import type { MediaResolver } from "../../../../media"
import { testimonials01Literal } from "../../typed/fixtures/testimonials-01"
import { testimonials05CmsLike } from "../../typed/fixtures/testimonials-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import {
  renderTestimonialAuthor,
  renderTestimonialAvatarFallback,
  renderTestimonialQuote,
  renderTestimonialRole,
  renderTestimonialsIntro,
  renderTestimonialsTitle,
  sliceTestimonialItems,
  type TestimonialItem,
} from "../../typed/testimonials-fields"

const MAX_ITEMS = 6

export type Testimonials05Props = TypedVariantBaseProps & {
  title?: string | null
  intro?: string | null
  items: TestimonialItem[]
  mediaResolver?: MediaResolver
}

export function Testimonials05({
  title,
  intro,
  items,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
}: Testimonials05Props) {
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
          <p className="mt-4 text-center text-muted-foreground text-xl tracking-[-0.015em] md:text-2xl">{introContent}</p>
        ) : null}
        <div className="mx-auto mt-8 w-full max-w-(--breakpoint-xl) sm:mt-14 lg:mt-16">
          <div className="grid grid-cols-1 overflow-hidden md:grid-cols-2 lg:grid-cols-3">
            {displayItems.map((item, itemIndex) => {
              const quoteContent = renderTestimonialQuote(editSlots, item.quote, blockIndex, itemIndex)
              const authorContent = renderTestimonialAuthor(editSlots, item.author, blockIndex, itemIndex)
              const roleContent = renderTestimonialRole(editSlots, item.role, blockIndex, itemIndex)
              if (!quoteContent && !authorContent) return null
              return (
                <div
                  className={cn(
                    "relative flex flex-col px-6 py-10",
                    "before:absolute before:inset-0 before:-m-px before:border-border before:border-r before:border-b before:border-dashed before:content-['']",
                  )}
                  key={itemIndex}
                >
                  <div className="flex items-center justify-center gap-1">
                    <StarIcon className="h-6 w-6 fill-yellow-500 stroke-yellow-500" />
                    <StarIcon className="h-6 w-6 fill-yellow-500 stroke-yellow-500" />
                    <StarIcon className="h-6 w-6 fill-yellow-500 stroke-yellow-500" />
                    <StarIcon className="h-6 w-6 fill-yellow-500 stroke-yellow-500" />
                    <StarIcon className="h-6 w-6 fill-yellow-500 stroke-yellow-500" />
                  </div>
                  {quoteContent ? (
                    <p className="my-6 max-w-md text-pretty text-center text-[17px]">{quoteContent}</p>
                  ) : null}
                  <div className="mt-auto flex items-center justify-center gap-3">
                    {renderTestimonialAvatarFallback(editSlots, item.author, blockIndex, itemIndex, {
                      className: "size-9",
                    })}
                    <div>
                      {authorContent ? <p className="font-medium">{authorContent}</p> : null}
                      {roleContent ? <p className="text-muted-foreground text-sm">{roleContent}</p> : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Testimonials05Literal() {
  return (
    <Testimonials05
      title={testimonials05CmsLike.title}
      intro={testimonials05CmsLike.intro}
      items={testimonials01Literal.items}
      blockIndex={0}
    />
  )
}
