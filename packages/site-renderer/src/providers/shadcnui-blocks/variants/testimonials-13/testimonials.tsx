// Owned typed adaptation of upstream shadcnui-blocks testimonials-13 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { ComponentProps } from "react"
import { Button, Marquee } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { cn } from "@siteinabox/ui/lib/utils"
import type { MediaResolver } from "../../../../media"
import Link from "../../runtime/link"
import {
  Logo01,
  Logo02,
  Logo03,
  Logo04,
  Logo05,
  Logo06,
} from "../../runtime/logos"
import { testimonials01Literal } from "../../typed/fixtures/testimonials-01"
import { testimonials13CmsLike } from "../../typed/fixtures/testimonials-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import {
  renderTestimonialAuthor,
  renderTestimonialAvatarWithImage,
  renderTestimonialQuote,
  renderTestimonialRole,
  renderTestimonialsIntro,
  renderTestimonialsTitle,
  sliceTestimonialItems,
  TwitterLogo,
  type TestimonialItem,
} from "../../typed/testimonials-fields"

const MAX_ITEMS = 6

const LITERAL_IMAGES = [
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:1bf22",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:488d6",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:41bea",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:b20ed",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:61bb8",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:02613",
]

const LITERAL_LOGOS = [Logo01, Logo02, Logo03, Logo04, Logo05, Logo06]

const logoGridStyle: React.CSSProperties = {
  backgroundImage: `
        linear-gradient(to right, var(--color-muted-foreground) 1px, transparent 1px),
        linear-gradient(to bottom, var(--color-muted-foreground) 1px, transparent 1px)
      `,
  backgroundSize: "20px 20px",
  backgroundPosition: "0 0, 0 0",
  maskImage: `
        repeating-linear-gradient(
          to right,
          black 0px,
          black 3px,
          transparent 3px,
          transparent 8px
        ),
        repeating-linear-gradient(
          to bottom,
          black 0px,
          black 3px,
          transparent 3px,
          transparent 8px
        )
      `,
  WebkitMaskImage: `
        repeating-linear-gradient(
          to right,
          black 0px,
          black 3px,
          transparent 3px,
          transparent 8px
        ),
        repeating-linear-gradient(
          to bottom,
          black 0px,
          black 3px,
          transparent 3px,
          transparent 8px
        )
      `,
  maskComposite: "intersect",
  WebkitMaskComposite: "source-in",
}

export type Testimonials13Props = TypedVariantBaseProps & {
  title?: string | null
  intro?: string | null
  items: TestimonialItem[]
  mediaResolver?: MediaResolver
  literalPreviewImages?: string[]
  literalLogos?: React.ComponentType<ComponentProps<"svg">>[]
}

function TestimonialList({
  items,
  blockIndex,
  editSlots,
  mediaResolver,
  literalPreviewImages,
  literalLogos,
  className,
  ...props
}: {
  items: TestimonialItem[]
  blockIndex: number
  editSlots?: Testimonials13Props["editSlots"]
  mediaResolver?: MediaResolver
  literalPreviewImages?: string[]
  literalLogos?: React.ComponentType<ComponentProps<"svg">>[]
} & ComponentProps<"div">) {
  const displayItems = sliceTestimonialItems(items, MAX_ITEMS)

  return (
    <>
      {displayItems.map((item, itemIndex) => {
        const quoteContent = renderTestimonialQuote(editSlots, item.quote, blockIndex, itemIndex)
        const authorContent = renderTestimonialAuthor(editSlots, item.author, blockIndex, itemIndex)
        const roleContent = renderTestimonialRole(editSlots, item.role, blockIndex, itemIndex)
        const Logo = literalLogos?.[itemIndex]
        if (!quoteContent && !authorContent) return null
        return (
          <div className="-mx-1 flex w-full max-w-sm flex-col odd:flex-col-reverse" key={itemIndex}>
            <div className={cn("rounded-xl border bg-background shadow-xs/3", className)} {...props}>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {renderTestimonialAvatarWithImage(
                      editSlots,
                      mediaResolver,
                      item.avatar,
                      item.author,
                      blockIndex,
                      itemIndex,
                      {
                        className: "size-10",
                        imageClassName: "object-cover",
                        literalPreviewSrc: literalPreviewImages?.[itemIndex],
                      },
                    )}
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
            </div>
            {Logo ? (
              <div className="mask-y-from-75% mask-x-from-75% relative flex h-42 w-96 items-center justify-center p-6">
                <Logo className="h-20 w-50 text-muted-foreground" />
                <div className="absolute inset-0 isolate -z-1 opacity-15" style={logoGridStyle} />
              </div>
            ) : null}
          </div>
        )
      })}
    </>
  )
}

export function Testimonials13({
  title,
  intro,
  items,
  blockIndex,
  editSlots,
  mediaResolver,
  literalPreviewImages,
  literalLogos,
  rootAttributes,
}: Testimonials13Props) {
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
      <div className="mask-x-from-80% mt-14 space-y-px border bg-muted">
        <Marquee className="py-0 [--duration:60s] [--gap:0px]" pauseOnHover>
          <TestimonialList
            blockIndex={blockIndex}
            editSlots={editSlots}
            items={items}
            literalLogos={literalLogos}
            literalPreviewImages={literalPreviewImages}
            mediaResolver={mediaResolver}
          />
        </Marquee>
      </div>
    </div>
  )
}

export default function Testimonials13Literal() {
  return (
    <Testimonials13
      title={testimonials13CmsLike.title}
      intro={testimonials13CmsLike.intro}
      items={testimonials01Literal.items}
      literalPreviewImages={LITERAL_IMAGES}
      literalLogos={LITERAL_LOGOS}
      blockIndex={0}
    />
  )
}
