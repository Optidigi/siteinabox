"use client"

import type { RtRoot } from "@siteinabox/contracts"
import type { BlockEditSlots } from "../../../blocks/types"
import { elementPath } from "./paths"
import { fieldInlineRichText, renderInlineRichText } from "./rich-text"

export const STATS_BLOCK_TYPE = "stats" as const

export type StatItem = {
  value: string
  label: string
  description?: RtRoot | null
}

export const sliceStatItems = <T,>(items: T[], maxItems: number) => items.slice(0, maxItems)

const optionalInlineField = (
  editSlots: BlockEditSlots | undefined,
  field: string,
  value: RtRoot | null | undefined,
  blockIndex: number,
) => {
  if (value) {
    return fieldInlineRichText(editSlots, STATS_BLOCK_TYPE, field, value, blockIndex)
  }
  if (!editSlots?.renderRichText) return null
  return editSlots.renderRichText({
    name: `${STATS_BLOCK_TYPE}.${field}`,
    value: value ?? null,
    variant: "inline",
    as: "span",
    className: "contents",
    elementPath: elementPath(blockIndex, field),
    blockMode: "inline",
  })
}

export const renderStatsTitle = (
  editSlots: BlockEditSlots | undefined,
  title: RtRoot | null | undefined,
  blockIndex: number,
) => optionalInlineField(editSlots, "title", title, blockIndex)

export const renderStatsIntro = (
  editSlots: BlockEditSlots | undefined,
  intro: RtRoot | null | undefined,
  blockIndex: number,
) => optionalInlineField(editSlots, "intro", intro, blockIndex)

export const renderStatValue = (
  editSlots: BlockEditSlots | undefined,
  value: string,
  blockIndex: number,
  itemIndex: number,
) => {
  const trimmed = value?.trim() ?? ""
  if (!trimmed && !editSlots?.renderText) return null
  const path = elementPath(blockIndex, "items", itemIndex, "value")
  if (editSlots?.renderText) {
    return editSlots.renderText({
      name: `${STATS_BLOCK_TYPE}.items.value`,
      value: trimmed,
      className: "contents",
      elementPath: path,
    })
  }
  return trimmed || null
}

export const renderStatLabel = (
  editSlots: BlockEditSlots | undefined,
  label: string,
  blockIndex: number,
  itemIndex: number,
) => {
  const trimmed = label?.trim() ?? ""
  if (!trimmed && !editSlots?.renderText) return null
  const path = elementPath(blockIndex, "items", itemIndex, "label")
  if (editSlots?.renderText) {
    return editSlots.renderText({
      name: `${STATS_BLOCK_TYPE}.items.label`,
      value: trimmed,
      className: "contents",
      elementPath: path,
    })
  }
  return trimmed || null
}

export const renderStatDescription = (
  editSlots: BlockEditSlots | undefined,
  description: RtRoot | null | undefined,
  blockIndex: number,
  itemIndex: number,
) => {
  if (!description) return null
  const path = elementPath(blockIndex, "items", itemIndex, "description")
  return renderInlineRichText(editSlots, {
    name: `${STATS_BLOCK_TYPE}.items.description`,
    value: description,
    elementPath: path,
  })
}
