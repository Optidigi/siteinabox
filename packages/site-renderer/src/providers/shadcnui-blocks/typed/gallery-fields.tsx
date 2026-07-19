"use client"

import * as React from "react"
import type { LinkRef, MediaRef, RtRoot } from "@siteinabox/contracts"
import type { BlockEditSlots } from "../../../blocks/types"
import { resolveMedia, type MediaResolver } from "../../../media"
import { renderCtaLink } from "./actions"
import { elementPath } from "./paths"
import { fieldInlineRichText } from "./rich-text"

export const GALLERY_BLOCK_TYPE = "gallery" as const

export type GalleryImageItem = {
  image?: MediaRef
  caption?: RtRoot | null
  link?: LinkRef | null
}

export const sliceGalleryImages = <T,>(images: T[], maxItems?: number) =>
  maxItems === undefined ? images : images.slice(0, maxItems)

const optionalInlineField = (
  editSlots: BlockEditSlots | undefined,
  field: string,
  value: RtRoot | null | undefined,
  blockIndex: number,
) => {
  if (value) {
    return fieldInlineRichText(editSlots, GALLERY_BLOCK_TYPE, field, value, blockIndex)
  }
  if (!editSlots?.renderRichText) return null
  return editSlots.renderRichText({
    name: `${GALLERY_BLOCK_TYPE}.${field}`,
    value: value ?? null,
    variant: "inline",
    as: "span",
    className: "contents",
    elementPath: elementPath(blockIndex, field),
    blockMode: "inline",
  })
}

export const renderGalleryTitle = (
  editSlots: BlockEditSlots | undefined,
  title: RtRoot | null | undefined,
  blockIndex: number,
) => optionalInlineField(editSlots, "title", title, blockIndex)

export const renderGalleryIntro = (
  editSlots: BlockEditSlots | undefined,
  intro: RtRoot | null | undefined,
  blockIndex: number,
) => optionalInlineField(editSlots, "intro", intro, blockIndex)

export const renderGalleryCta = (
  editSlots: BlockEditSlots | undefined,
  cta: LinkRef | null | undefined,
  blockIndex: number,
  options?: { trailingIcon?: React.ReactNode },
) => {
  if (!cta) return null
  return renderCtaLink(editSlots, cta, blockIndex, GALLERY_BLOCK_TYPE, "cta", options)
}

export const renderGalleryImage = (
  editSlots: BlockEditSlots | undefined,
  mediaResolver: MediaResolver | undefined,
  image: MediaRef | undefined,
  alt: string,
  blockIndex: number,
  itemIndex: number,
  { className, fill, sizes }: { className?: string; fill?: boolean; sizes?: string } = {},
) => {
  const resolved = resolveMedia(image ?? null, mediaResolver)
  const path = elementPath(blockIndex, "images", itemIndex, "image")
  if (editSlots?.renderImage) {
    return editSlots.renderImage({
      name: `${GALLERY_BLOCK_TYPE}.images.image`,
      value: image,
      alt,
      className,
      elementPath: path,
    })
  }
  if (!resolved?.src) return null
  if (fill) {
    return <img className={className} src={resolved.src} alt={resolved.alt ?? alt} sizes={sizes} />
  }
  return <img className={className} src={resolved.src} alt={resolved.alt ?? alt} />
}
