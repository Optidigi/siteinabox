import type { MediaRef } from "@siteinabox/contracts"
import { previewInlineText } from "../fixtures"
import type { GalleryImageItem } from "../gallery-fields"

const previewImage = (index: number): MediaRef => ({
  url: `https://cdn.example.test/gallery-${index}.jpg`,
  alt: `Gallery image ${index}`,
})

export const galleryImage = (index: number): GalleryImageItem => ({
  image: previewImage(index),
})

export const galleryFamilyCmsLike = {
  title: previewInlineText("dddepth"),
  intro: previewInlineText("A Curated Collection of AI-generated Abstract 3D Shapes"),
  cta: { label: "View all", href: "https://example.test/gallery" },
  images: [galleryImage(1), galleryImage(2), galleryImage(3), galleryImage(4)],
}

export const galleryFamilySparse = {
  images: [galleryImage(1)],
}

export const galleryFamilyLong = {
  title: previewInlineText("A".repeat(500)),
  intro: previewInlineText("B".repeat(500)),
  images: [galleryImage(1)],
}

export const galleryFamilyEmptyItems = {
  title: previewInlineText("Gallery"),
  intro: previewInlineText("No images yet"),
  images: [] as GalleryImageItem[],
}

export const carouselBlock01CmsLike = galleryFamilyCmsLike

export const carouselBlock02CmsLike = {
  title: galleryFamilyCmsLike.title,
  intro: galleryFamilyCmsLike.intro,
  images: galleryFamilyCmsLike.images,
}
