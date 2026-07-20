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
import type { BlockEditSlots } from "../../../../blocks/types"
import { faq01Literal } from "../../typed/fixtures/faq-01"
import { elementPath } from "../../typed/paths"
import type { TypedVariantBaseProps } from "../../typed/props"
import { renderBlockRichText, renderInlineRichText } from "../../typed/rich-text"

const BLOCK_TYPE = "faq" as const

type FaqItem = {
  question: RtRoot
  answer: RtRoot
}

const renderTitle = (
  editSlots: BlockEditSlots | undefined,
  title: RtRoot | null | undefined,
  blockIndex: number,
) => {
  if (title) {
    return renderInlineRichText(editSlots, {
      name: `${BLOCK_TYPE}.title`,
      value: title,
      elementPath: elementPath(blockIndex, "title"),
    })
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
  return renderInlineRichText(editSlots, {
    name: `${BLOCK_TYPE}.items.question`,
    value: question,
    elementPath: path,
  })
}

const renderAnswer = (
  editSlots: BlockEditSlots | undefined,
  answer: RtRoot,
  blockIndex: number,
  itemIndex: number,
) => {
  const path = elementPath(blockIndex, "items", itemIndex, "answer")
  return renderBlockRichText(editSlots, {
    name: `${BLOCK_TYPE}.items.answer`,
    value: answer,
    elementPath: path,
  })
}

export type Faq01Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  items: FaqItem[]
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
      title={faq01Literal.title}
      items={faq01Literal.items}
      blockIndex={0}
    />
  )
}
