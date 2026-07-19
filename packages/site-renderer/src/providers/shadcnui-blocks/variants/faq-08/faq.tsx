// Owned typed adaptation of upstream shadcnui-blocks faq-08 (MIT, see ../../LICENSE).
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
  renderFaqIntro,
  renderFaqQuestion,
  renderFaqTitle,
} from "../../typed/faq-fields"
import { faqFamilyCmsLike } from "../../typed/fixtures/faq-family"
import type { TypedVariantBaseProps } from "../../typed/props"

export type Faq08Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  items: FaqItem[]
}

export function Faq08({ title, intro, items, blockIndex, editSlots, rootAttributes }: Faq08Props) {
  const titleContent = renderFaqTitle(editSlots, title, blockIndex)
  const introContent = renderFaqIntro(editSlots, intro, blockIndex)

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 sm:py-20" {...rootAttributes}>
      {titleContent ? (
        <h2 className="text-balance text-center font-medium text-4xl tracking-[-0.04em] sm:text-[2.75rem]">
          {titleContent}
        </h2>
      ) : null}
      {introContent ? (
        <p className="mt-3 text-balance text-center text-lg text-muted-foreground md:text-2xl md:tracking-[-0.015em]">
          {introContent}
        </p>
      ) : null}

      <div className="mx-auto mt-16 max-w-3xl">
        <Accordion className="space-y-4" collapsible type="single">
          {items.map((item, itemIndex) => (
            <AccordionItem
              className="rounded-lg not-last:border-b-0 bg-muted px-5"
              key={itemIndex}
              value={faqAccordionValue(itemIndex)}
            >
              <AccordionTrigger className="text-lg">
                <div className="flex items-center gap-2">
                  <span className="mr-2 hidden sm:inline-block">
                    {itemIndex + 1}.
                  </span>{" "}
                  {renderFaqQuestion(editSlots, item.question, blockIndex, itemIndex)}
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                {renderFaqAnswer(editSlots, item.answer, blockIndex, itemIndex)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  )
}

export default function Faq08Literal() {
  return (
    <Faq08
      title={faqFamilyCmsLike.title}
      intro={faqFamilyCmsLike.intro}
      items={faqFamilyCmsLike.items}
      blockIndex={0}
    />
  )
}
