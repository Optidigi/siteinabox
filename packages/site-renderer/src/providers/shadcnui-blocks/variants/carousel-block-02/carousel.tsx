// Owned typed adaptation of upstream shadcnui-blocks carousel-block-02 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import type { MediaResolver } from "../../../../media"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { carouselBlock02CmsLike } from "../../typed/fixtures/gallery-family"
import type { TypedVariantBaseProps } from "../../typed/props"
import {
  renderGalleryImage,
  renderGalleryIntro,
  renderGalleryTitle,
  sliceGalleryImages,
  type GalleryImageItem,
} from "../../typed/gallery-fields"

const MAX_IMAGES = 12

export type CarouselBlock02Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  images: GalleryImageItem[]
  mediaResolver?: MediaResolver
}

export function CarouselBlock02({
  title,
  intro,
  images,
  blockIndex,
  editSlots,
  mediaResolver,
  rootAttributes,
}: CarouselBlock02Props) {
  const titleContent = renderGalleryTitle(editSlots, title, blockIndex)
  const introContent = renderGalleryIntro(editSlots, intro, blockIndex)
  const displayImages = sliceGalleryImages(images, MAX_IMAGES)

  return (
    <div className="px-6 py-20" {...rootAttributes}>
      <Carousel className="mx-auto w-full max-w-5xl" opts={{ loop: true, align: "start" }}>
        <div className="mb-3 flex items-center justify-end gap-1 md:hidden">
          <CarouselPrevious className="static translate-y-0" />
          <CarouselNext className="static translate-y-0" />
        </div>
        <div className="rounded-xl bg-card p-6 shadow-xl/3 ring ring-border/80">
          <div className="mb-5 flex items-end justify-between">
            <div>
              {titleContent ? <h2 className="font-medium text-3xl tracking-tight">{titleContent}</h2> : null}
              {introContent ? <p className="mt-2 text-lg text-muted-foreground leading-snug">{introContent}</p> : null}
            </div>
            <div className="hidden space-x-2 md:block">
              <CarouselPrevious className="static translate-y-0" />
              <CarouselNext className="static translate-y-0" />
            </div>
          </div>
          <CarouselContent>
            {displayImages.map((image, itemIndex) => (
              <CarouselItem className="basis-1/2 md:basis-1/3 lg:basis-1/4" key={itemIndex}>
                <div className="p-1">
                  <div className="aspect-square">
                    {renderGalleryImage(editSlots, mediaResolver, image.image, "Gallery image", blockIndex, itemIndex, {
                      className: "rounded-lg object-cover",
                    })}
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </div>
      </Carousel>
    </div>
  )
}

export default function CarouselBlock02Literal() {
  return (
    <CarouselBlock02
      title={carouselBlock02CmsLike.title}
      intro={carouselBlock02CmsLike.intro}
      images={carouselBlock02CmsLike.images}
      blockIndex={0}
    />
  )
}
