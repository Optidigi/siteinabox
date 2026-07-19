"use client"

import type { RtRoot } from "@siteinabox/contracts"
import type { BlockEditSlots } from "../../../blocks/types"
import { elementPath } from "./paths"
import { fieldInlineRichText, renderInlineRichText } from "./rich-text"

export const TIMELINE_BLOCK_TYPE = "timeline" as const

export type TimelineItem = {
  title: string
  description?: string | null
  label?: string | null
  date?: string | null
  tags?: Array<{ value: string }> | null
}

export const isTimelineItemCompleted = (item: TimelineItem) =>
  item.tags?.some((tag) => tag.value === "completed") ?? false

export const sliceTimelineItems = <T,>(items: T[], maxItems?: number) =>
  maxItems === undefined ? items : items.slice(0, maxItems)

const optionalInlineField = (
  editSlots: BlockEditSlots | undefined,
  field: string,
  value: RtRoot | null | undefined,
  blockIndex: number,
) => {
  if (value) {
    return fieldInlineRichText(editSlots, TIMELINE_BLOCK_TYPE, field, value, blockIndex)
  }
  if (!editSlots?.renderRichText) return null
  return editSlots.renderRichText({
    name: `${TIMELINE_BLOCK_TYPE}.${field}`,
    value: value ?? null,
    variant: "inline",
    as: "span",
    className: "contents",
    elementPath: elementPath(blockIndex, field),
    blockMode: "inline",
  })
}

export const renderTimelineTitle = (
  editSlots: BlockEditSlots | undefined,
  title: RtRoot | null | undefined,
  blockIndex: number,
) => optionalInlineField(editSlots, "title", title, blockIndex)

export const renderTimelineIntro = (
  editSlots: BlockEditSlots | undefined,
  intro: RtRoot | null | undefined,
  blockIndex: number,
) => optionalInlineField(editSlots, "intro", intro, blockIndex)

const itemTextField = (
  editSlots: BlockEditSlots | undefined,
  field: string,
  subField: string,
  value: string | null | undefined,
  blockIndex: number,
  itemIndex: number,
) => {
  const trimmed = value?.trim() ?? ""
  if (!trimmed && !editSlots?.renderText) return null
  const path = elementPath(blockIndex, field, itemIndex, subField)
  if (editSlots?.renderText) {
    return editSlots.renderText({
      name: `${TIMELINE_BLOCK_TYPE}.${field}.${subField}`,
      value: trimmed,
      className: "contents",
      elementPath: path,
    })
  }
  return trimmed || null
}

export const renderTimelineItemTitle = (
  editSlots: BlockEditSlots | undefined,
  title: string,
  blockIndex: number,
  itemIndex: number,
) => itemTextField(editSlots, "items", "title", title, blockIndex, itemIndex)

export const renderTimelineItemDescription = (
  editSlots: BlockEditSlots | undefined,
  description: string | null | undefined,
  blockIndex: number,
  itemIndex: number,
) => itemTextField(editSlots, "items", "description", description, blockIndex, itemIndex)

export const renderTimelineItemLabel = (
  editSlots: BlockEditSlots | undefined,
  label: string | null | undefined,
  blockIndex: number,
  itemIndex: number,
) => itemTextField(editSlots, "items", "label", label, blockIndex, itemIndex)

export const renderTimelineItemDate = (
  editSlots: BlockEditSlots | undefined,
  date: string | null | undefined,
  blockIndex: number,
  itemIndex: number,
) => itemTextField(editSlots, "items", "date", date, blockIndex, itemIndex)

export const renderTimelineItemTag = (
  editSlots: BlockEditSlots | undefined,
  value: string,
  blockIndex: number,
  itemIndex: number,
  tagIndex: number,
) => {
  const trimmed = value?.trim() ?? ""
  if (!trimmed && !editSlots?.renderText) return null
  const path = { blockIndex, field: "items", itemIndex, subField: `tags.${tagIndex}.value` }
  if (editSlots?.renderText) {
    return editSlots.renderText({
      name: `${TIMELINE_BLOCK_TYPE}.items.tags.value`,
      value: trimmed,
      className: "contents",
      elementPath: path,
    })
  }
  return trimmed || null
}
