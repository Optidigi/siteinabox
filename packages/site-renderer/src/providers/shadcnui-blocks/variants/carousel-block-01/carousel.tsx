// Owned typed adaptation of upstream shadcnui-blocks carousel-block-01 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { LinkRef, RtRoot } from "@siteinabox/contracts"
import type { MediaResolver } from "../../../../media"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { carouselBlock01CmsLike } from "../../typed/fixtures/gallery-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import {
  renderGalleryCta,
  renderGalleryImage,
  renderGalleryIntro,
  renderGalleryTitle,
  sliceGalleryImages,
  type GalleryImageItem,
} from "../../typed/gallery-fields"

const MAX_IMAGES = 12

export type CarouselBlock01Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  cta?: LinkRef | null
  images: GalleryImageItem[]
  mediaResolver?: MediaResolver
}

export function CarouselBlock01({
  title,
  intro,
  cta,
  images,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
}: CarouselBlock01Props) {
  const titleContent = renderGalleryTitle(editSlots, title, blockIndex)
  const introContent = renderGalleryIntro(editSlots, intro, blockIndex)
  const ctaContent = renderGalleryCta(editSlots, cta, blockIndex)
  const displayImages = sliceGalleryImages(images, MAX_IMAGES)

  return (
    <div className="mx-auto max-w-5xl px-14 py-20" {...rootAttributes}>
      <div className="flex items-end justify-between">
        <div>
          {titleContent ? <h2 className="font-medium text-3xl tracking-tight">{titleContent}</h2> : null}
          {introContent ? (
            <p className="mt-2 text-pretty text-lg text-muted-foreground leading-snug">{introContent}</p>
          ) : null}
        </div>
        {ctaContent ? (
          <Button className="max-sm:hidden" size="sm" variant="outline">
            {ctaContent}
          </Button>
        ) : null}
      </div>
      <Carousel className="mt-6 w-full" opts={{ loop: true, align: "start" }}>
        <CarouselContent>
          {displayImages.map((image, itemIndex) => (
            <CarouselItem className="basis-1/2 md:basis-1/3 lg:basis-1/4" key={itemIndex}>
              <div className="p-1">
                <div className="aspect-square overflow-hidden">
                  {renderGalleryImage(editSlots, mediaResolver, image.image, "Gallery image", blockIndex, itemIndex, {
                    className: "size-full rounded-lg object-cover",
                  })}
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <div className="mt-4 flex items-center justify-between sm:justify-end">
          <div className="flex items-center justify-end gap-1.5">
            <CarouselPrevious className="-left-10 max-md:static max-md:translate-y-0" />
            <CarouselNext className="-right-10 max-md:static max-md:translate-y-0" />
          </div>
          {ctaContent ? (
            <Button className="sm:hidden" size="sm" variant="outline">
              {ctaContent}
            </Button>
          ) : null}
        </div>
      </Carousel>
    </div>
  )
}

export default function CarouselBlock01Literal() {
  return (
    <CarouselBlock01
      title={carouselBlock01CmsLike.title}
      intro={carouselBlock01CmsLike.intro}
      cta={carouselBlock01CmsLike.cta}
      images={carouselBlock01CmsLike.images}
      blockIndex={0}
    />
  )
}
