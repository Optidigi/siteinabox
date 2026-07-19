// Owned typed adaptation of upstream shadcnui-blocks faq-02 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import {
  faqAccordionValue,
  type FaqItem,
  renderFaqAnswer,
  renderFaqQuestion,
  renderFaqTitle,
} from "../../typed/faq-fields"
import { faq02Literal } from "../../typed/fixtures/faq-family"
import type { TypedVariantBaseProps } from "../../typed/props"

export type Faq02Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  titleOverride?: React.ReactNode
  items: FaqItem[]
}

export function Faq02({ title, titleOverride, items, blockIndex, editSlots, rootAttributes }: Faq02Props) {
  const titleContent = titleOverride ?? renderFaqTitle(editSlots, title, blockIndex)

  return (
    <div className="px-6 py-20" {...rootAttributes}>
      <div className="flex flex-col items-start justify-center gap-x-12 gap-y-6 md:flex-row">
        {titleContent ? (
          <h2 className="font-medium text-4xl/snug tracking-[-0.04em] lg:text-[2.75rem]/snug">
            {titleContent}
          </h2>
        ) : null}

        <Accordion className="max-w-xl" defaultValue={items.length > 0 ? faqAccordionValue(0) : undefined} type="single">
          {items.map((item, itemIndex) => (
            <AccordionItem key={itemIndex} value={faqAccordionValue(itemIndex)}>
              <AccordionTrigger className="text-left text-lg">
                {renderFaqQuestion(editSlots, item.question, blockIndex, itemIndex)}
              </AccordionTrigger>
              <AccordionContent className="text-base text-muted-foreground">
                {renderFaqAnswer(editSlots, item.answer, blockIndex, itemIndex)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  )
}

export default function Faq02Literal() {
  return (
    <Faq02
      title={faq02Literal.title}
      titleOverride={
        <>
          Frequently Asked <br /> Questions
        </>
      }
      items={faq02Literal.items}
      blockIndex={0}
    />
  )
}
