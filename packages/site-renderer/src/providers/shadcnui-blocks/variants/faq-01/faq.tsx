// Owned typed adaptation of upstream shadcnui-blocks faq-01 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import type { BlockEditSlots, RendererElementPath, RendererSectionAttributes } from "../../../../blocks/types"
import { RichTextRenderer } from "../../../../rich-text"

const BLOCK_TYPE = "faq" as const

type FaqItem = {
  question: RtRoot
  answer: RtRoot
}

const previewInlineText = (text: string): RtRoot => ({
  t: "root",
  variant: "inline",
  children: [{ t: "text", v: text }],
})

const previewBlockText = (text: string): RtRoot => ({
  t: "root",
  variant: "block",
  children: [{ t: "paragraph", children: [{ t: "text", v: text }] }],
})

const PREVIEW_TITLE = previewInlineText("Questions & Answers")

const PREVIEW_ITEMS: FaqItem[] = [
  {
    question: previewInlineText("What is your return policy?"),
    answer: previewBlockText(
      "You can return unused items in their original packaging within 30 days for a refund or exchange. Contact support for assistance.",
    ),
  },
  {
    question: previewInlineText("How do I track my order?"),
    answer: previewBlockText(
      "Track your order using the link provided in your confirmation email, or log into your account to view tracking details.",
    ),
  },
  {
    question: previewInlineText("Do you ship internationally?"),
    answer: previewBlockText(
      "Yes, we ship worldwide. Shipping fees and delivery times vary by location, and customs duties may apply for some countries.",
    ),
  },
  {
    question: previewInlineText("What payment methods do you accept?"),
    answer: previewBlockText(
      "We accept Visa, MasterCard, American Express, PayPal, Apple Pay, and Google Pay, ensuring secure payment options for all customers.",
    ),
  },
  {
    question: previewInlineText("What if I receive a damaged item?"),
    answer: previewBlockText(
      "Please contact our support team within 48 hours of delivery with photos of the damaged item. We'll arrange a replacement or refund.",
    ),
  },
]

const elementPath = (
  blockIndex: number,
  field: string,
  itemIndex?: number,
  subField?: string,
): RendererElementPath => ({ blockIndex, field, itemIndex, subField })

const renderInlineRichText = (
  editSlots: BlockEditSlots | undefined,
  name: string,
  value: RtRoot,
  path: RendererElementPath,
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

const renderBlockRichText = (
  editSlots: BlockEditSlots | undefined,
  name: string,
  value: RtRoot,
  path: RendererElementPath,
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

const renderTitle = (
  editSlots: BlockEditSlots | undefined,
  title: RtRoot | null | undefined,
  blockIndex: number,
) => {
  if (title) {
    return renderInlineRichText(
      editSlots,
      `${BLOCK_TYPE}.title`,
      title,
      elementPath(blockIndex, "title"),
    )
  }
  if (!editSlots?.renderRichText) return null
  return editSlots.renderRichText({
    name: `${BLOCK_TYPE}.title`,
    value: title ?? null,
    variant: "inline",
    as: "span",
    className: "contents",
    elementPath: elementPath(blockIndex, "title"),
    blockMode: "inline",
  })
}

const renderQuestion = (
  editSlots: BlockEditSlots | undefined,
  question: RtRoot,
  blockIndex: number,
  itemIndex: number,
) => {
  const path = elementPath(blockIndex, "items", itemIndex, "question")
  return renderInlineRichText(editSlots, `${BLOCK_TYPE}.items.question`, question, path)
}

const renderAnswer = (
  editSlots: BlockEditSlots | undefined,
  answer: RtRoot,
  blockIndex: number,
  itemIndex: number,
) => {
  const path = elementPath(blockIndex, "items", itemIndex, "answer")
  return renderBlockRichText(editSlots, `${BLOCK_TYPE}.items.answer`, answer, path)
}

export type Faq01Props = {
  title?: RtRoot | null
  items: FaqItem[]
  blockIndex: number
  editSlots?: BlockEditSlots
  rootAttributes?: RendererSectionAttributes
}

export function Faq01({ title, items, blockIndex, editSlots, rootAttributes }: Faq01Props) {
  const titleContent = renderTitle(editSlots, title, blockIndex)

  return (
    <div className="px-6 py-20" {...rootAttributes}>
      <div className="mx-auto w-full max-w-xl">
        {titleContent ? (
          <h2 className="font-medium text-4xl leading-[1.15]! tracking-[-0.04em] md:text-[2.75rem]">
            {titleContent}
          </h2>
        ) : null}

        <Accordion
          className="mt-6"
          defaultValue={items.length > 0 ? ["question-0"] : undefined}
          type="multiple"
        >
          {items.map((item, itemIndex) => (
            <AccordionItem key={itemIndex} value={`question-${itemIndex}`}>
              <AccordionTrigger className="text-left text-lg">
                {renderQuestion(editSlots, item.question, blockIndex, itemIndex)}
              </AccordionTrigger>
              <AccordionContent className="text-base text-muted-foreground">
                {renderAnswer(editSlots, item.answer, blockIndex, itemIndex)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  )
}

export default function Faq01Literal() {
  return (
    <Faq01
      title={PREVIEW_TITLE}
      items={PREVIEW_ITEMS}
      blockIndex={0}
    />
  )
}
