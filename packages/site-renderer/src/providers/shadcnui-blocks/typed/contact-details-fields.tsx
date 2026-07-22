"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import { MailIcon, MapPinIcon, MessageCircle, PhoneIcon, Building2, type LucideIcon } from "lucide-react"
import type { BlockEditSlots } from "../../../blocks/types"
import { isExternalHref } from "./links"
import { elementPath } from "./paths"
import { fieldInlineRichText } from "./rich-text"

export const CONTACT_DETAILS_BLOCK_TYPE = "contactDetails" as const

export type ContactDetailsItem = {
  title: string
  description?: string | null
  value: string
  href?: string | null
  icon?: string | null
}

const CONTACT_ICONS: Record<string, LucideIcon> = {
  mail: MailIcon,
  "map-pin": MapPinIcon,
  message: MessageCircle,
  phone: PhoneIcon,
  "building-2": Building2,
}

export const resolveContactIcon = (icon: string | null | undefined, fallback: LucideIcon = MailIcon) => {
  const key = icon?.trim().toLowerCase() ?? ""
  return CONTACT_ICONS[key] ?? fallback
}

export const renderContactItemIcon = (
  editSlots: BlockEditSlots | undefined,
  iconName: string | null | undefined,
  blockIndex: number,
  itemIndex: number,
  { className, fallback }: { className?: string; fallback?: LucideIcon } = {},
) => {
  const Icon = resolveContactIcon(iconName, fallback)
  const path = elementPath(blockIndex, "items", itemIndex, "icon")
  if (editSlots?.renderIcon) {
    return editSlots.renderIcon({
      name: `${CONTACT_DETAILS_BLOCK_TYPE}.items.icon`,
      value: iconName ?? null,
      icon: Icon,
      className,
      elementPath: path,
    })
  }
  return <Icon className={className} />
}

const renderPlainContactValue = (value: string) => {
  if (!value.includes("\n")) return value
  return value.split("\n").map((part, index) => (
    <React.Fragment key={index}>
      {index > 0 ? <br /> : null}
      {part}
    </React.Fragment>
  ))
}

const optionalInlineField = (
  editSlots: BlockEditSlots | undefined,
  field: string,
  value: RtRoot | null | undefined,
  blockIndex: number,
) => {
  if (value) {
    return fieldInlineRichText(editSlots, CONTACT_DETAILS_BLOCK_TYPE, field, value, blockIndex)
  }
  if (!editSlots?.renderRichText) return null
  return editSlots.renderRichText({
    name: `${CONTACT_DETAILS_BLOCK_TYPE}.${field}`,
    value: value ?? null,
    variant: "inline",
    as: "span",
    className: "contents",
    elementPath: elementPath(blockIndex, field),
    blockMode: "inline",
  })
}

export const renderContactDetailsTitle = (
  editSlots: BlockEditSlots | undefined,
  title: RtRoot | null | undefined,
  blockIndex: number,
) => optionalInlineField(editSlots, "title", title, blockIndex)

export const renderContactDetailsDescription = (
  editSlots: BlockEditSlots | undefined,
  description: RtRoot | null | undefined,
  blockIndex: number,
) => optionalInlineField(editSlots, "description", description, blockIndex)

const itemTextField = (
  editSlots: BlockEditSlots | undefined,
  subField: string,
  value: string | null | undefined,
  blockIndex: number,
  itemIndex: number,
) => {
  const trimmed = value?.trim() ?? ""
  if (!trimmed && !editSlots?.renderText) return null
  const path = elementPath(blockIndex, "items", itemIndex, subField)
  if (editSlots?.renderText) {
    return editSlots.renderText({
      name: `${CONTACT_DETAILS_BLOCK_TYPE}.items.${subField}`,
      value: trimmed,
      className: "contents",
      elementPath: path,
    })
  }
  return trimmed || null
}

export const renderContactItemTitle = (
  editSlots: BlockEditSlots | undefined,
  title: string,
  blockIndex: number,
  itemIndex: number,
) => itemTextField(editSlots, "title", title, blockIndex, itemIndex)

export const renderContactItemDescription = (
  editSlots: BlockEditSlots | undefined,
  description: string | null | undefined,
  blockIndex: number,
  itemIndex: number,
) => itemTextField(editSlots, "description", description, blockIndex, itemIndex)

export const renderContactItemValue = (
  editSlots: BlockEditSlots | undefined,
  value: string,
  blockIndex: number,
  itemIndex: number,
  { className }: { className?: string } = {},
) => {
  const trimmed = value?.trim() ?? ""
  if (!trimmed && !editSlots?.renderText) return null
  const path = elementPath(blockIndex, "items", itemIndex, "value")
  const content = editSlots?.renderText
    ? editSlots.renderText({
        name: `${CONTACT_DETAILS_BLOCK_TYPE}.items.value`,
        value: trimmed,
        className: "contents",
        elementPath: path,
      })
    : renderPlainContactValue(trimmed)
  if (!content) return null
  return className ? <span className={className}>{content}</span> : content
}

export const renderContactItemLink = (
  editSlots: BlockEditSlots | undefined,
  item: ContactDetailsItem,
  blockIndex: number,
  itemIndex: number,
  { className, target }: { className?: string; target?: string } = {},
) => {
  const href = item.href?.trim() ?? ""
  const valueContent = renderContactItemValue(editSlots, item.value, blockIndex, itemIndex)
  if (!valueContent) return null
  if (!href) return className ? <span className={className}>{valueContent}</span> : valueContent
  const external = isExternalHref(href)
  return (
    <a
      className={className}
      href={href}
      target={target ?? (external ? "_blank" : undefined)}
      rel={external ? "noreferrer" : undefined}
    >
      {valueContent}
    </a>
  )
}
