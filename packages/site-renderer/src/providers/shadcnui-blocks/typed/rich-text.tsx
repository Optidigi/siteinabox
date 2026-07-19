"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import type { BlockEditSlots, RendererElementPath } from "../../../blocks/types"
import { RichTextRenderer } from "../../../rich-text"
import { elementPath } from "./paths"

type RichTextSlotArgs = {
  name: string
  value: RtRoot
  elementPath: RendererElementPath
}

export const renderInlineRichText = (
  editSlots: BlockEditSlots | undefined,
  { name, value, elementPath: path }: RichTextSlotArgs,
) => {
  return editSlots?.renderRichText
    ? editSlots.renderRichText({
        name,
        value,
        variant: "inline",
        as: "span",
        className: "contents",
        elementPath: path,
        blockMode: "inline",
      })
    : <RichTextRenderer value={value} blockMode="inline" />
}

export const renderBlockRichText = (
  editSlots: BlockEditSlots | undefined,
  { name, value, elementPath: path }: RichTextSlotArgs,
) => {
  return editSlots?.renderRichText
    ? editSlots.renderRichText({
        name,
        value,
        variant: "block",
        as: "div",
        className: "contents",
        elementPath: path,
        blockMode: "normal",
      })
    : <RichTextRenderer value={value} blockMode="normal" />
}

export const fieldInlineRichText = (
  editSlots: BlockEditSlots | undefined,
  blockType: string,
  field: string,
  value: RtRoot,
  blockIndex: number,
) => renderInlineRichText(editSlots, {
  name: `${blockType}.${field}`,
  value,
  elementPath: elementPath(blockIndex, field),
})
