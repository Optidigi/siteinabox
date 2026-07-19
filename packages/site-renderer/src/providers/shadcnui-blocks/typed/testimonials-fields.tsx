"use client"

import * as React from "react"
import type { MediaRef } from "@siteinabox/contracts"
import type { BlockEditSlots } from "../../../blocks/types"
import { resolveMedia, type MediaResolver } from "../../../media"
import { Avatar, AvatarFallback, AvatarImage } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { elementPath } from "./paths"

export const TESTIMONIALS_BLOCK_TYPE = "testimonials" as const

export type TestimonialItem = {
  quote: string
  author: string
  role?: string | null
  avatar?: MediaRef
}

export const sliceTestimonialItems = <T,>(items: T[], maxItems?: number) =>
  maxItems === undefined ? items : items.slice(0, maxItems)

const optionalTextField = (
  editSlots: BlockEditSlots | undefined,
  field: string,
  value: string | null | undefined,
  blockIndex: number,
) => {
  const trimmed = value?.trim() ?? ""
  if (!trimmed && !editSlots?.renderText) return null
  if (editSlots?.renderText) {
    return editSlots.renderText({
      name: `${TESTIMONIALS_BLOCK_TYPE}.${field}`,
      value: trimmed,
      className: "contents",
      elementPath: elementPath(blockIndex, field),
    })
  }
  return trimmed || null
}

export const renderTestimonialsTitle = (
  editSlots: BlockEditSlots | undefined,
  title: string | null | undefined,
  blockIndex: number,
) => optionalTextField(editSlots, "title", title, blockIndex)

export const renderTestimonialsIntro = (
  editSlots: BlockEditSlots | undefined,
  intro: string | null | undefined,
  blockIndex: number,
) => optionalTextField(editSlots, "intro", intro, blockIndex)

export const renderTestimonialQuote = (
  editSlots: BlockEditSlots | undefined,
  quote: string,
  blockIndex: number,
  itemIndex: number,
) => {
  const trimmed = quote?.trim() ?? ""
  if (!trimmed && !editSlots?.renderText) return null
  const path = elementPath(blockIndex, "items", itemIndex, "quote")
  if (editSlots?.renderText) {
    return editSlots.renderText({
      name: `${TESTIMONIALS_BLOCK_TYPE}.items.quote`,
      value: trimmed,
      className: "contents",
      elementPath: path,
    })
  }
  return trimmed || null
}

export const renderTestimonialAuthor = (
  editSlots: BlockEditSlots | undefined,
  author: string,
  blockIndex: number,
  itemIndex: number,
) => {
  const trimmed = author?.trim() ?? ""
  if (!trimmed && !editSlots?.renderText) return null
  const path = elementPath(blockIndex, "items", itemIndex, "author")
  if (editSlots?.renderText) {
    return editSlots.renderText({
      name: `${TESTIMONIALS_BLOCK_TYPE}.items.author`,
      value: trimmed,
      className: "contents",
      elementPath: path,
    })
  }
  return trimmed || null
}

export const renderTestimonialRole = (
  editSlots: BlockEditSlots | undefined,
  role: string | null | undefined,
  blockIndex: number,
  itemIndex: number,
) => {
  const trimmed = role?.trim() ?? ""
  if (!trimmed && !editSlots?.renderText) return null
  const path = elementPath(blockIndex, "items", itemIndex, "role")
  if (editSlots?.renderText) {
    return editSlots.renderText({
      name: `${TESTIMONIALS_BLOCK_TYPE}.items.role`,
      value: trimmed,
      className: "contents",
      elementPath: path,
    })
  }
  return trimmed || null
}

export const authorInitial = (author: string) => author.trim().charAt(0).toUpperCase() || "?"

export const renderTestimonialAvatarFallback = (
  editSlots: BlockEditSlots | undefined,
  author: string,
  blockIndex: number,
  itemIndex: number,
  { className }: { className?: string } = {},
) => {
  const initial = authorInitial(author)
  const path = elementPath(blockIndex, "items", itemIndex, "avatar")
  if (editSlots?.renderImage) {
    return (
      <Avatar className={className}>
        {editSlots.renderImage({
          name: `${TESTIMONIALS_BLOCK_TYPE}.items.avatar`,
          value: undefined,
          alt: author,
          className: "size-full rounded-full object-cover",
          elementPath: path,
        })}
        <AvatarFallback className="bg-primary font-medium text-primary-foreground text-xl">
          {initial}
        </AvatarFallback>
      </Avatar>
    )
  }
  return (
    <Avatar className={className}>
      <AvatarFallback className="bg-primary font-medium text-primary-foreground text-xl">
        {initial}
      </AvatarFallback>
    </Avatar>
  )
}

export const renderTestimonialAvatarImage = (
  editSlots: BlockEditSlots | undefined,
  mediaResolver: MediaResolver | undefined,
  avatar: MediaRef | undefined,
  author: string,
  blockIndex: number,
  itemIndex: number,
  {
    className,
    width,
    height,
    literalPreviewSrc,
    fill = false,
    sizes,
  }: {
    className?: string
    width?: number
    height?: number
    literalPreviewSrc?: string
    fill?: boolean
    sizes?: string
  } = {},
) => {
  const path = elementPath(blockIndex, "items", itemIndex, "avatar")
  if (literalPreviewSrc) {
    if (fill) {
      return (
        <img
          alt={author}
          className={className}
          decoding="async"
          loading="lazy"
          sizes={sizes}
          src={literalPreviewSrc}
          style={{ position: "absolute", height: "100%", width: "100%", inset: 0, objectFit: "cover" }}
        />
      )
    }
    return (
      <img
        alt={author}
        className={className}
        decoding="async"
        height={height}
        loading="lazy"
        src={literalPreviewSrc}
        width={width}
      />
    )
  }
  if (!avatar) return null
  const resolved = resolveMedia(avatar, mediaResolver)
  const altText = resolved?.alt ?? author
  if (editSlots?.renderImage) {
    return editSlots.renderImage({
      name: `${TESTIMONIALS_BLOCK_TYPE}.items.avatar`,
      value: avatar,
      alt: altText,
      className,
      elementPath: path,
    })
  }
  if (!resolved?.src) return null
  if (fill) {
    return (
      <img
        alt={altText}
        className={className}
        decoding="async"
        loading="lazy"
        sizes={sizes}
        src={resolved.src}
        style={{ position: "absolute", height: "100%", width: "100%", inset: 0, objectFit: "cover" }}
      />
    )
  }
  return (
    <img
      alt={altText}
      className={className}
      decoding="async"
      height={height}
      loading="lazy"
      src={resolved.src}
      width={width}
    />
  )
}

export const renderTestimonialAvatarWithImage = (
  editSlots: BlockEditSlots | undefined,
  mediaResolver: MediaResolver | undefined,
  avatar: MediaRef | undefined,
  author: string,
  blockIndex: number,
  itemIndex: number,
  {
    className,
    imageClassName = "object-cover",
    literalPreviewSrc,
  }: {
    className?: string
    imageClassName?: string
    literalPreviewSrc?: string
  } = {},
) => {
  const initial = authorInitial(author)
  const path = elementPath(blockIndex, "items", itemIndex, "avatar")
  const resolved = literalPreviewSrc
    ? { src: literalPreviewSrc, alt: author }
    : avatar
      ? resolveMedia(avatar, mediaResolver)
      : undefined
  if (editSlots?.renderImage && avatar) {
    return (
      <Avatar className={className}>
        {editSlots.renderImage({
          name: `${TESTIMONIALS_BLOCK_TYPE}.items.avatar`,
          value: avatar,
          alt: resolved?.alt ?? author,
          className: `size-full rounded-full ${imageClassName}`,
          elementPath: path,
        })}
        <AvatarFallback className="bg-primary font-medium text-primary-foreground text-xl">
          {initial}
        </AvatarFallback>
      </Avatar>
    )
  }
  return (
    <Avatar className={className}>
      {resolved?.src ? <AvatarImage alt={resolved.alt ?? author} className={imageClassName} src={resolved.src} /> : null}
      <AvatarFallback className="bg-primary font-medium text-primary-foreground text-xl">
        {initial}
      </AvatarFallback>
    </Avatar>
  )
}

export const TwitterLogo = (props: React.ComponentProps<"svg">) => (
  <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
    <title>X</title>
    <path
      d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"
      fill="currentColor"
    />
  </svg>
)
