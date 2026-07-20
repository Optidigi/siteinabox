"use client"

import * as React from "react"
import type { LinkRef, MediaRef, RtRoot } from "@siteinabox/contracts"
import type { BlockEditSlots } from "../../../blocks/types"
import { resolveMedia, type MediaResolver } from "../../../media"
import { isExternalHref } from "./links"
import { elementPath } from "./paths"
import { fieldInlineRichText } from "./rich-text"

export const HERO_BLOCK_TYPE = "hero" as const

export type HeroLinkField = "cta" | "secondary"

export type HeroLogoItem = {
  name: string
  image?: MediaRef
  href?: string | null
}

const optionalInlineField = (
  editSlots: BlockEditSlots | undefined,
  field: string,
  value: RtRoot | null | undefined,
  blockIndex: number,
) => {
  if (value) {
    return fieldInlineRichText(editSlots, HERO_BLOCK_TYPE, field, value, blockIndex)
  }
  if (!editSlots?.renderRichText) return null
  return editSlots.renderRichText({
    name: `${HERO_BLOCK_TYPE}.${field}`,
    value: value ?? null,
    variant: "inline",
    as: "span",
    className: "contents",
    elementPath: elementPath(blockIndex, field),
    blockMode: "inline",
  })
}

export const renderHeroEyebrow = (
  editSlots: BlockEditSlots | undefined,
  eyebrow: RtRoot | null | undefined,
  blockIndex: number,
) => optionalInlineField(editSlots, "eyebrow", eyebrow, blockIndex)

export const renderHeroHeadline = (
  editSlots: BlockEditSlots | undefined,
  headline: RtRoot,
  blockIndex: number,
) => fieldInlineRichText(editSlots, HERO_BLOCK_TYPE, "headline", headline, blockIndex)

export const renderHeroSubheadline = (
  editSlots: BlockEditSlots | undefined,
  subheadline: RtRoot | null | undefined,
  blockIndex: number,
) => optionalInlineField(editSlots, "subheadline", subheadline, blockIndex)

export const renderHeroTrustLabel = (
  editSlots: BlockEditSlots | undefined,
  trustLabel: string | null | undefined,
  blockIndex: number,
) => {
  const value = trustLabel?.trim() ?? ""
  if (!value && !editSlots?.renderText) return null
  if (editSlots?.renderText) {
    return editSlots.renderText({
      name: `${HERO_BLOCK_TYPE}.trustLabel`,
      value,
      className: "contents",
      elementPath: elementPath(blockIndex, "trustLabel"),
    })
  }
  return value || null
}

export const renderHeroLink = (
  editSlots: BlockEditSlots | undefined,
  value: LinkRef,
  blockIndex: number,
  field: HeroLinkField,
  options?: { leadingIcon?: React.ReactNode; trailingIcon?: React.ReactNode },
) => {
  const href = value.href?.trim()
  const label = value.label?.trim()
  if (!href || !label) return null
  const path = elementPath(blockIndex, field)
  if (editSlots?.renderCta) {
    return editSlots.renderCta({
      name: `${HERO_BLOCK_TYPE}.${field}`,
      value: { ...value, href, label },
      elementPath: path,
    })
  }
  const external = value.external ?? isExternalHref(href)
  return (
    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
      {options?.leadingIcon}
      {label}
      {options?.trailingIcon}
    </a>
  )
}

export const renderHeroImage = (
  editSlots: BlockEditSlots | undefined,
  mediaResolver: MediaResolver | undefined,
  image: MediaRef | null | undefined,
  blockIndex: number,
  { className, alt = "", literalPreview = false }: { className: string; alt?: string; literalPreview?: boolean },
) => {
  const fallback = <div data-provider-image-region="image" className={className} />
  if (literalPreview) return fallback
  if (!image) return null
  const resolved = resolveMedia(image, mediaResolver)
  const path = elementPath(blockIndex, "image")
  if (editSlots?.renderImage) {
    return editSlots.renderImage({
      name: `${HERO_BLOCK_TYPE}.image`,
      value: image,
      alt: resolved?.alt ?? alt,
      className: [className, "object-cover"].filter(Boolean).join(" "),
      elementPath: path,
    })
  }
  if (!resolved?.src) return null
  return (
    <img
      alt={resolved.alt ?? alt}
      className={[className, "object-cover"].filter(Boolean).join(" ")}
      src={resolved.src}
      decoding="async"
      loading="lazy"
    />
  )
}

export const renderHeroLogo = (
  logo: HeroLogoItem,
  itemIndex: number,
  blockIndex: number,
  editSlots: BlockEditSlots | undefined,
  mediaResolver: MediaResolver | undefined,
  { className, fallback }: { className: string; fallback: React.ReactNode },
) => {
  const name = logo.name?.trim() ?? ""
  const value = logo.image
  const resolved = resolveMedia(value ?? null, mediaResolver)
  const path = elementPath(blockIndex, "logos", itemIndex, "image")
  const content = editSlots?.renderImage
    ? editSlots.renderImage({
        name: `${HERO_BLOCK_TYPE}.logos.image`,
        value,
        alt: name,
        className,
        elementPath: path,
      })
    : resolved?.src
      ? <img className={className} src={resolved.src} alt={resolved.alt ?? name} />
      : fallback
  if (!content) return null

  const href = logo.href?.trim() ?? ""
  if (!href) return content
  const external = isExternalHref(href)
  return (
    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
      {content}
    </a>
  )
}
