"use client"

import * as React from "react"
import type { RtRoot, SiteSettings } from "@siteinabox/contracts"
import { MailIcon, MapPinIcon, MessageCircleIcon, PhoneIcon, type LucideIcon } from "lucide-react"
import type { BlockEditSlots } from "../../../blocks/types"
import { elementPath } from "./paths"
import { fieldInlineRichText } from "./rich-text"

export const CONTACT_SECTION_BLOCK_TYPE = "contactSection" as const

export type ContactSectionField = {
  name: string
  label: string
  type: "text" | "email" | "tel" | "textarea" | "select" | "checkbox"
  required?: boolean
  placeholder?: string | null
  maxLength?: number | null
  options?: Array<{ label: string; value: string }> | null
}

export type RuntimeContactDetail = {
  title: string
  description: string
  value: string
  href?: string
  Icon: LucideIcon
}

const optionalInlineField = (
  editSlots: BlockEditSlots | undefined,
  field: string,
  value: RtRoot | null | undefined,
  blockIndex: number,
) => {
  if (value) {
    return fieldInlineRichText(editSlots, CONTACT_SECTION_BLOCK_TYPE, field, value, blockIndex)
  }
  if (!editSlots?.renderRichText) return null
  return editSlots.renderRichText({
    name: `${CONTACT_SECTION_BLOCK_TYPE}.${field}`,
    value: value ?? null,
    variant: "inline",
    as: "span",
    className: "contents",
    elementPath: elementPath(blockIndex, field),
    blockMode: "inline",
  })
}

export const renderContactSectionTitle = (
  editSlots: BlockEditSlots | undefined,
  title: RtRoot | null | undefined,
  blockIndex: number,
) => optionalInlineField(editSlots, "title", title, blockIndex)

export const renderContactSectionDescription = (
  editSlots: BlockEditSlots | undefined,
  description: RtRoot | null | undefined,
  blockIndex: number,
) => optionalInlineField(editSlots, "description", description, blockIndex)

export const renderContactFieldLabel = (
  editSlots: BlockEditSlots | undefined,
  label: string,
  blockIndex: number,
  itemIndex: number,
) => {
  const trimmed = label.trim()
  if (!trimmed && !editSlots?.renderText) return null
  const path = elementPath(blockIndex, "fields", itemIndex, "label")
  if (editSlots?.renderText) {
    return editSlots.renderText({
      name: `${CONTACT_SECTION_BLOCK_TYPE}.fields.label`,
      value: trimmed,
      className: "contents",
      elementPath: path,
    })
  }
  return trimmed || null
}

export const renderContactSubmitLabel = (
  editSlots: BlockEditSlots | undefined,
  submitLabel: string,
  blockIndex: number,
) => {
  const trimmed = submitLabel.trim()
  if (!trimmed && !editSlots?.renderText) return "Submit"
  if (editSlots?.renderText) {
    return editSlots.renderText({
      name: `${CONTACT_SECTION_BLOCK_TYPE}.submitLabel`,
      value: trimmed,
      className: "contents",
      elementPath: elementPath(blockIndex, "submitLabel"),
    })
  }
  return trimmed || "Submit"
}

export const resolveRuntimeContactDetails = (settings?: SiteSettings): RuntimeContactDetail[] => [
  settings?.contactEmail
    ? {
        title: "Email",
        description: "Our friendly team is here to help.",
        value: settings.contactEmail,
        href: `mailto:${settings.contactEmail}`,
        Icon: MailIcon,
      }
    : null,
  settings?.contact?.social?.[0]
    ? {
        title: settings.contact.social[0].platform,
        description: "Start a conversation with our team.",
        value: settings.contact.social[0].platform,
        href: settings.contact.social[0].url,
        Icon: MessageCircleIcon,
      }
    : null,
  settings?.contact?.address
    ? {
        title: "Office",
        description: "Come say hello at our office.",
        value: settings.contact.address,
        Icon: MapPinIcon,
      }
    : null,
  settings?.contact?.phone
    ? {
        title: "Phone",
        description: "Call our team during opening hours.",
        value: settings.contact.phone,
        href: `tel:${settings.contact.phone}`,
        Icon: PhoneIcon,
      }
    : null,
].filter(Boolean) as RuntimeContactDetail[]
