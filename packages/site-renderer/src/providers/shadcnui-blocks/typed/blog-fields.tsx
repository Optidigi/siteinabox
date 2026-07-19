"use client"

import * as React from "react"
import type { LinkRef, MediaRef, RtRoot } from "@siteinabox/contracts"
import type { BlockEditSlots } from "../../../blocks/types"
import { resolveMedia, type MediaResolver } from "../../../media"
import { renderCtaLink } from "./actions"
import { elementPath } from "./paths"
import { fieldInlineRichText, renderInlineRichText } from "./rich-text"

export const BLOG_BLOCK_TYPE = "blogCards" as const

export type BlogPostItem = {
  title: RtRoot
  excerpt?: RtRoot | null
  image?: MediaRef
  href?: string | null
  date?: string | null
  author?: string | null
  authorRole?: string | null
  readTime?: string | null
  cta?: LinkRef | null
}

export const sliceBlogPosts = <T,>(posts: T[], maxItems?: number) =>
  maxItems === undefined ? posts : posts.slice(0, maxItems)

const optionalInlineField = (
  editSlots: BlockEditSlots | undefined,
  field: string,
  value: RtRoot | null | undefined,
  blockIndex: number,
) => {
  if (value) {
    return fieldInlineRichText(editSlots, BLOG_BLOCK_TYPE, field, value, blockIndex)
  }
  if (!editSlots?.renderRichText) return null
  return editSlots.renderRichText({
    name: `${BLOG_BLOCK_TYPE}.${field}`,
    value: value ?? null,
    variant: "inline",
    as: "span",
    className: "contents",
    elementPath: elementPath(blockIndex, field),
    blockMode: "inline",
  })
}

export const renderBlogTitle = (
  editSlots: BlockEditSlots | undefined,
  title: RtRoot | null | undefined,
  blockIndex: number,
) => optionalInlineField(editSlots, "title", title, blockIndex)

export const renderBlogIntro = (
  editSlots: BlockEditSlots | undefined,
  intro: RtRoot | null | undefined,
  blockIndex: number,
) => optionalInlineField(editSlots, "intro", intro, blockIndex)

export const renderBlogCta = (
  editSlots: BlockEditSlots | undefined,
  cta: LinkRef | null | undefined,
  blockIndex: number,
  field: "cta" | "secondary" = "cta",
  options?: { trailingIcon?: React.ReactNode; leadingIcon?: React.ReactNode },
) => {
  if (!cta) return null
  return renderCtaLink(editSlots, cta, blockIndex, BLOG_BLOCK_TYPE, field, options)
}

export const renderBlogPostTitle = (
  editSlots: BlockEditSlots | undefined,
  title: RtRoot,
  blockIndex: number,
  itemIndex: number,
) => {
  const path = elementPath(blockIndex, "posts", itemIndex, "title")
  return renderInlineRichText(editSlots, {
    name: `${BLOG_BLOCK_TYPE}.posts.title`,
    value: title,
    elementPath: path,
  })
}

export const renderBlogPostExcerpt = (
  editSlots: BlockEditSlots | undefined,
  excerpt: RtRoot | null | undefined,
  blockIndex: number,
  itemIndex: number,
) => {
  if (!excerpt) return null
  const path = elementPath(blockIndex, "posts", itemIndex, "excerpt")
  return renderInlineRichText(editSlots, {
    name: `${BLOG_BLOCK_TYPE}.posts.excerpt`,
    value: excerpt,
    elementPath: path,
  })
}

export const renderBlogPostAuthor = (
  editSlots: BlockEditSlots | undefined,
  author: string | null | undefined,
  blockIndex: number,
  itemIndex: number,
) => {
  const trimmed = author?.trim() ?? ""
  if (!trimmed && !editSlots?.renderText) return null
  const path = elementPath(blockIndex, "posts", itemIndex, "author")
  if (editSlots?.renderText) {
    return editSlots.renderText({
      name: `${BLOG_BLOCK_TYPE}.posts.author`,
      value: trimmed,
      className: "contents",
      elementPath: path,
    })
  }
  return trimmed || null
}

export const renderBlogPostDate = (
  editSlots: BlockEditSlots | undefined,
  date: string | null | undefined,
  blockIndex: number,
  itemIndex: number,
) => {
  const trimmed = date?.trim() ?? ""
  if (!trimmed && !editSlots?.renderText) return null
  const path = elementPath(blockIndex, "posts", itemIndex, "date")
  if (editSlots?.renderText) {
    return editSlots.renderText({
      name: `${BLOG_BLOCK_TYPE}.posts.date`,
      value: trimmed,
      className: "contents",
      elementPath: path,
    })
  }
  return trimmed || null
}

export const renderBlogPostImage = (
  editSlots: BlockEditSlots | undefined,
  mediaResolver: MediaResolver | undefined,
  image: MediaRef | undefined,
  alt: string,
  blockIndex: number,
  itemIndex: number,
  { className, fill, sizes, width, height }: {
    className?: string
    fill?: boolean
    sizes?: string
    width?: number
    height?: number
  } = {},
) => {
  const resolved = resolveMedia(image ?? null, mediaResolver)
  const path = elementPath(blockIndex, "posts", itemIndex, "image")
  if (editSlots?.renderImage) {
    return editSlots.renderImage({
      name: `${BLOG_BLOCK_TYPE}.posts.image`,
      value: image,
      alt,
      className,
      elementPath: path,
    })
  }
  if (!resolved?.src) return null
  return (
    <img
      className={[fill ? "absolute inset-0 h-full w-full" : null, className].filter(Boolean).join(" ")}
      src={resolved.src}
      alt={resolved.alt ?? alt}
      sizes={sizes}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      style={fill ? { objectFit: "cover" } : undefined}
    />
  )
}

export const formatBlogDate = (date: string) => {
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}
