"use client"

import * as React from "react"
import type { LinkRef, MediaRef, RtRoot } from "@siteinabox/contracts"
import type { BlockEditSlots } from "../../../blocks/types"
import { resolveMedia, type MediaResolver } from "../../../media"
import { isExternalHref } from "./links"
import { elementPath } from "./paths"
import { fieldInlineRichText, renderBlockRichText } from "./rich-text"

export const TEAM_BLOCK_TYPE = "team" as const

export type TeamMemberItem = {
  name: string
  role?: string | null
  bio?: RtRoot | null
  image?: MediaRef
  links?: LinkRef[] | null
}

export const sliceTeamMembers = <T,>(members: T[], maxMembers?: number) =>
  maxMembers === undefined ? members : members.slice(0, maxMembers)

const optionalInlineField = (
  editSlots: BlockEditSlots | undefined,
  field: string,
  value: RtRoot | null | undefined,
  blockIndex: number,
) => {
  if (value) {
    return fieldInlineRichText(editSlots, TEAM_BLOCK_TYPE, field, value, blockIndex)
  }
  if (!editSlots?.renderRichText) return null
  return editSlots.renderRichText({
    name: `${TEAM_BLOCK_TYPE}.${field}`,
    value: value ?? null,
    variant: "inline",
    as: "span",
    className: "contents",
    elementPath: elementPath(blockIndex, field),
    blockMode: "inline",
  })
}

export const renderTeamTitle = (
  editSlots: BlockEditSlots | undefined,
  title: RtRoot | null | undefined,
  blockIndex: number,
) => optionalInlineField(editSlots, "title", title, blockIndex)

export const renderTeamIntro = (
  editSlots: BlockEditSlots | undefined,
  intro: RtRoot | null | undefined,
  blockIndex: number,
) => optionalInlineField(editSlots, "intro", intro, blockIndex)

export const renderMemberName = (
  editSlots: BlockEditSlots | undefined,
  name: string,
  blockIndex: number,
  itemIndex: number,
) => {
  const trimmed = name?.trim() ?? ""
  if (!trimmed && !editSlots?.renderText) return null
  const path = elementPath(blockIndex, "members", itemIndex, "name")
  if (editSlots?.renderText) {
    return editSlots.renderText({
      name: `${TEAM_BLOCK_TYPE}.members.name`,
      value: trimmed,
      className: "contents",
      elementPath: path,
    })
  }
  return trimmed || null
}

export const renderMemberRole = (
  editSlots: BlockEditSlots | undefined,
  role: string | null | undefined,
  blockIndex: number,
  itemIndex: number,
) => {
  const trimmed = role?.trim() ?? ""
  if (!trimmed && !editSlots?.renderText) return null
  const path = elementPath(blockIndex, "members", itemIndex, "role")
  if (editSlots?.renderText) {
    return editSlots.renderText({
      name: `${TEAM_BLOCK_TYPE}.members.role`,
      value: trimmed,
      className: "contents",
      elementPath: path,
    })
  }
  return trimmed || null
}

export const renderMemberBio = (
  editSlots: BlockEditSlots | undefined,
  bio: RtRoot | null | undefined,
  blockIndex: number,
  itemIndex: number,
) => {
  if (!bio) return null
  const path = elementPath(blockIndex, "members", itemIndex, "bio")
  return renderBlockRichText(editSlots, {
    name: `${TEAM_BLOCK_TYPE}.members.bio`,
    value: bio,
    elementPath: path,
  })
}

export const renderMemberImage = (
  editSlots: BlockEditSlots | undefined,
  mediaResolver: MediaResolver | undefined,
  image: MediaRef | undefined,
  name: string,
  blockIndex: number,
  itemIndex: number,
  {
    alt = "",
    className,
    width,
    height,
    literalPreviewSrc,
  }: {
    alt?: string
    className?: string
    width?: number
    height?: number
    literalPreviewSrc?: string
  },
) => {
  if (literalPreviewSrc) {
    return <img alt={alt || name} className={className} height={height} src={literalPreviewSrc} width={width} />
  }
  if (!image) return null
  const resolved = resolveMedia(image, mediaResolver)
  const path = elementPath(blockIndex, "members", itemIndex, "image")
  const altText = resolved?.alt ?? (alt || name)
  if (editSlots?.renderImage) {
    return editSlots.renderImage({
      name: `${TEAM_BLOCK_TYPE}.members.image`,
      value: image,
      alt: altText,
      className,
      elementPath: path,
    })
  }
  if (!resolved?.src) return null
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

const withBoundHref = (
  node: React.ReactNode,
  value: LinkRef & { href: string },
): React.ReactNode => {
  if (!React.isValidElement<{ children?: React.ReactNode; href?: string; target?: string; rel?: string }>(node)) {
    return node
  }
  const props = node.props
  const children = props.children == null
    ? props.children
    : React.Children.count(props.children) === 1
      ? withBoundHref(React.Children.toArray(props.children)[0], value)
      : React.Children.map(props.children, (child) => withBoundHref(child, value))
  if ("href" in props) {
    return React.cloneElement(node, {
      href: value.href,
      target: value.external ? "_blank" : undefined,
      rel: value.external ? "noreferrer" : undefined,
    }, children)
  }
  return React.cloneElement(node, undefined, children)
}

export const renderMemberLink = (
  value: LinkRef | null | undefined,
  fallback: React.ReactNode,
  { literalPreview = false }: { literalPreview?: boolean } = {},
) => {
  if (literalPreview) return <>{fallback}</>
  const href = value?.href?.trim()
  if (!value || !href) return null
  return <>{withBoundHref(fallback, { ...value, href, external: value.external ?? isExternalHref(href) })}</>
}
