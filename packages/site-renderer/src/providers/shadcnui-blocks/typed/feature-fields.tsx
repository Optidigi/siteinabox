"use client"

import * as React from "react"
import type { LinkRef, MediaRef, RtRoot } from "@siteinabox/contracts"
import type { LucideIcon } from "lucide-react"
import { resolveIcon } from "../../../blocks/icons"
import type { BlockEditSlots } from "../../../blocks/types"
import { resolveMedia, type MediaResolver } from "../../../media"
import { extractRichText } from "../../../rich-text"
import { elementPath } from "./paths"
import { fieldInlineRichText, renderBlockRichText, renderInlineRichText } from "./rich-text"

export const FEATURE_BLOCK_TYPE = "featureList" as const

export type FeatureItem = {
  title: RtRoot
  description?: RtRoot | null
  icon?: string | null
  image?: MediaRef
  cta?: LinkRef | null
  metricValue?: string | null
  metricLabel?: string | null
}

const optionalInlineField = (
  editSlots: BlockEditSlots | undefined,
  field: string,
  value: RtRoot | null | undefined,
  blockIndex: number,
) => {
  if (value) {
    return fieldInlineRichText(editSlots, FEATURE_BLOCK_TYPE, field, value, blockIndex)
  }
  if (!editSlots?.renderRichText) return null
  return editSlots.renderRichText({
    name: `${FEATURE_BLOCK_TYPE}.${field}`,
    value: value ?? null,
    variant: "inline",
    as: "span",
    className: "contents",
    elementPath: elementPath(blockIndex, field),
    blockMode: "inline",
  })
}

export const renderFeatureEyebrow = (
  editSlots: BlockEditSlots | undefined,
  eyebrow: RtRoot | null | undefined,
  blockIndex: number,
) => optionalInlineField(editSlots, "eyebrow", eyebrow, blockIndex)

export const renderFeatureTitle = (
  editSlots: BlockEditSlots | undefined,
  title: RtRoot | null | undefined,
  blockIndex: number,
) => optionalInlineField(editSlots, "title", title, blockIndex)

export const renderFeatureIntro = (
  editSlots: BlockEditSlots | undefined,
  intro: RtRoot | null | undefined,
  blockIndex: number,
) => optionalInlineField(editSlots, "intro", intro, blockIndex)

export const renderFeatureItemTitle = (
  editSlots: BlockEditSlots | undefined,
  title: RtRoot,
  blockIndex: number,
  itemIndex: number,
) => renderInlineRichText(editSlots, {
  name: `${FEATURE_BLOCK_TYPE}.features.title`,
  value: title,
  elementPath: elementPath(blockIndex, "features", itemIndex, "title"),
})

export const renderFeatureItemDescription = (
  editSlots: BlockEditSlots | undefined,
  description: RtRoot | null | undefined,
  blockIndex: number,
  itemIndex: number,
) => {
  if (!description) return null
  return renderBlockRichText(editSlots, {
    name: `${FEATURE_BLOCK_TYPE}.features.description`,
    value: description,
    elementPath: elementPath(blockIndex, "features", itemIndex, "description"),
  })
}

export const featureItemIcon = (
  iconName: string | null | undefined,
  fallbackIcons: readonly LucideIcon[],
  itemIndex: number,
): LucideIcon | null => {
  const resolved = resolveIcon(iconName)
  if (resolved) return resolved
  if (!fallbackIcons.length) return null
  return fallbackIcons[itemIndex % fallbackIcons.length] ?? fallbackIcons[0] ?? null
}

export const renderFeatureItemImage = (
  editSlots: BlockEditSlots | undefined,
  mediaResolver: MediaResolver | undefined,
  image: MediaRef | undefined,
  title: RtRoot,
  blockIndex: number,
  itemIndex: number,
  { alt = "", className }: { alt?: string; className?: string },
) => {
  if (!image) return null
  const resolved = resolveMedia(image, mediaResolver)
  const path = elementPath(blockIndex, "features", itemIndex, "image")
  const altText = resolved?.alt ?? (alt || extractRichText(title))
  if (editSlots?.renderImage) {
    return editSlots.renderImage({
      name: `${FEATURE_BLOCK_TYPE}.features.image`,
      value: image,
      alt: altText,
      className,
      elementPath: path,
    })
  }
  if (!resolved?.src) return null
  return <img alt={altText} className={className} src={resolved.src} decoding="async" loading="lazy" />
}

export const renderFeatureItemCta = (
  editSlots: BlockEditSlots | undefined,
  cta: LinkRef | null | undefined,
  blockIndex: number,
  itemIndex: number,
  options?: { trailingIcon?: React.ReactNode },
) => {
  const href = cta?.href?.trim()
  const label = cta?.label?.trim()
  if (!href || !label) return null
  const path = elementPath(blockIndex, "features", itemIndex, "cta")
  if (editSlots?.renderCta) {
    return editSlots.renderCta({
      name: `${FEATURE_BLOCK_TYPE}.features.cta`,
      value: { ...cta, href, label },
      elementPath: path,
    })
  }
  const external = cta?.external ?? /^(?:https?:)?\/\//.test(href)
  return (
    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
      {label}
      {options?.trailingIcon}
    </a>
  )
}

export const featureDescriptionLines = (description: RtRoot | null | undefined, limit = 2) => {
  const lines: string[] = []
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return
    const record = node as Record<string, unknown>
    if ((record.type === "paragraph" || record.type === "listitem") && Array.isArray(record.children)) {
      const line = extractRichText({ root: record } as unknown as RtRoot).trim()
      if (line) lines.push(line)
      return
    }
    if (Array.isArray(record.children)) record.children.forEach(visit)
    if (record.root) visit(record.root)
  }
  visit(description)
  if (!lines.length && description) {
    const line = extractRichText(description).trim()
    if (line) lines.push(line)
  }
  return lines.slice(0, limit)
}
