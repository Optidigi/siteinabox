"use client"

import * as React from "react"
import type { LinkRef, MediaRef, RtRoot } from "@siteinabox/contracts"
import type { BlockEditSlots } from "../../../blocks/types"
import { resolveMedia, type MediaResolver } from "../../../media"
import { isExternalHref } from "./links"
import { elementPath } from "./paths"
import { fieldInlineRichText } from "./rich-text"

export const LOGO_CLOUD_BLOCK_TYPE = "logoCloud" as const

export type LogoCloudLogoItem = {
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
    return fieldInlineRichText(editSlots, LOGO_CLOUD_BLOCK_TYPE, field, value, blockIndex)
  }
  if (!editSlots?.renderRichText) return null
  return editSlots.renderRichText({
    name: `${LOGO_CLOUD_BLOCK_TYPE}.${field}`,
    value: value ?? null,
    variant: "inline",
    as: "span",
    className: "contents",
    elementPath: elementPath(blockIndex, field),
    blockMode: "inline",
  })
}

export const renderLogoCloudTitle = (
  editSlots: BlockEditSlots | undefined,
  title: RtRoot | null | undefined,
  blockIndex: number,
) => optionalInlineField(editSlots, "title", title, blockIndex)

export const renderLogoCloudIntro = (
  editSlots: BlockEditSlots | undefined,
  intro: RtRoot | null | undefined,
  blockIndex: number,
) => optionalInlineField(editSlots, "intro", intro, blockIndex)

export const renderLogoCloudLink = (
  editSlots: BlockEditSlots | undefined,
  value: LinkRef,
  blockIndex: number,
  options?: { trailingIcon?: React.ReactNode },
) => {
  const href = value.href?.trim()
  const label = value.label?.trim()
  if (!href || !label) return null
  const path = elementPath(blockIndex, "cta")
  if (editSlots?.renderCta) {
    return editSlots.renderCta({
      name: `${LOGO_CLOUD_BLOCK_TYPE}.cta`,
      value: { ...value, href, label },
      elementPath: path,
    })
  }
  const external = value.external ?? isExternalHref(href)
  return (
    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
      {label}
      {options?.trailingIcon}
    </a>
  )
}

export const renderLogoCloudLogo = (
  logo: LogoCloudLogoItem,
  itemIndex: number,
  blockIndex: number,
  editSlots: BlockEditSlots | undefined,
  mediaResolver: MediaResolver | undefined,
  { className, fallback }: { className: string; fallback?: React.ReactNode },
) => {
  const name = logo.name?.trim() ?? ""
  const value = logo.image
  const resolved = resolveMedia(value ?? null, mediaResolver)
  const path = elementPath(blockIndex, "logos", itemIndex, "image")
  const content = editSlots?.renderImage
    ? editSlots.renderImage({
        name: `${LOGO_CLOUD_BLOCK_TYPE}.logos.image`,
        value,
        alt: name,
        className,
        elementPath: path,
      })
    : resolved?.src
      ? <img className={className} src={resolved.src} alt={resolved.alt ?? name} />
      : fallback ?? null
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

export const sliceLogoCloudLogos = <T,>(logos: T[], maxItems?: number) =>
  maxItems === undefined ? logos : logos.slice(0, maxItems)
