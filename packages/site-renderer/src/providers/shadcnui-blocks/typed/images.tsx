"use client"

import * as React from "react"
import type { MediaRef } from "@siteinabox/contracts"
import type { BlockEditSlots } from "../../../blocks/types"
import { resolveMedia, type MediaResolver } from "../../../media"
import { elementPath } from "./paths"

type RenderBackgroundImageOptions = {
  alt?: string
  className?: string
  fallbackSrc?: string
  /** When true, render fallbackSrc if media is empty (live + literal). Default: literalPreview only. */
  emptyFallback?: boolean
  literalPreview?: boolean
}

export const renderBackgroundImage = (
  editSlots: BlockEditSlots | undefined,
  mediaResolver: MediaResolver | undefined,
  backgroundImage: MediaRef | null | undefined,
  blockIndex: number,
  blockType: string,
  {
    alt = "",
    className,
    fallbackSrc,
    emptyFallback = false,
    literalPreview = false,
  }: RenderBackgroundImageOptions,
) => {
  if (literalPreview && fallbackSrc) {
    return <img alt={alt} className={className} src={fallbackSrc} />
  }
  if (!backgroundImage) {
    if (emptyFallback && fallbackSrc) {
      return <img alt={alt} className={className} src={fallbackSrc} decoding="async" loading="lazy" />
    }
    return null
  }
  const resolved = resolveMedia(backgroundImage, mediaResolver)
  const path = elementPath(blockIndex, "backgroundImage")
  if (editSlots?.renderImage) {
    return editSlots.renderImage({
      name: `${blockType}.backgroundImage`,
      value: backgroundImage,
      alt: resolved?.alt ?? alt,
      className,
      elementPath: path,
    })
  }
  if (!resolved?.src) return null
  return <img alt={resolved.alt ?? alt} className={className} src={resolved.src} decoding="async" loading="lazy" />
}
