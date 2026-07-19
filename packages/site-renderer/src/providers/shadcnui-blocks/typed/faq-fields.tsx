"use client"

import type { RtRoot } from "@siteinabox/contracts"
import type { BlockEditSlots } from "../../../blocks/types"
import { elementPath } from "./paths"
import { renderBlockRichText, renderInlineRichText } from "./rich-text"

export const FAQ_BLOCK_TYPE = "faq" as const

export type FaqItem = {
  question: RtRoot
  answer: RtRoot
}

export const faqAccordionValue = (itemIndex: number) => `question-${itemIndex}`

export const renderFaqTitle = (
  editSlots: BlockEditSlots | undefined,
  title: RtRoot | null | undefined,
  blockIndex: number,
) => {
  if (title) {
    return renderInlineRichText(editSlots, {
      name: `${FAQ_BLOCK_TYPE}.title`,
      value: title,
      elementPath: elementPath(blockIndex, "title"),
    })
  }
  if (!editSlots?.renderRichText) return null
  return editSlots.renderRichText({
    name: `${FAQ_BLOCK_TYPE}.title`,
    value: title ?? null,
    variant: "inline",
    as: "span",
    className: "contents",
    elementPath: elementPath(blockIndex, "title"),
    blockMode: "inline",
  })
}

export const renderFaqIntro = (
  editSlots: BlockEditSlots | undefined,
  intro: RtRoot | null | undefined,
  blockIndex: number,
) => {
  if (intro) {
    return renderInlineRichText(editSlots, {
      name: `${FAQ_BLOCK_TYPE}.intro`,
      value: intro,
      elementPath: elementPath(blockIndex, "intro"),
    })
  }
  if (!editSlots?.renderRichText) return null
  return editSlots.renderRichText({
    name: `${FAQ_BLOCK_TYPE}.intro`,
    value: intro ?? null,
    variant: "inline",
    as: "span",
    className: "contents",
    elementPath: elementPath(blockIndex, "intro"),
    blockMode: "inline",
  })
}

export const renderFaqQuestion = (
  editSlots: BlockEditSlots | undefined,
  question: RtRoot,
  blockIndex: number,
  itemIndex: number,
) => {
  const path = elementPath(blockIndex, "items", itemIndex, "question")
  return renderInlineRichText(editSlots, {
    name: `${FAQ_BLOCK_TYPE}.items.question`,
    value: question,
    elementPath: path,
  })
}

export const renderFaqAnswer = (
  editSlots: BlockEditSlots | undefined,
  answer: RtRoot,
  blockIndex: number,
  itemIndex: number,
) => {
  const path = elementPath(blockIndex, "items", itemIndex, "answer")
  return renderBlockRichText(editSlots, {
    name: `${FAQ_BLOCK_TYPE}.items.answer`,
    value: answer,
    elementPath: path,
  })
}
