// Owned typed adaptation of upstream shadcnui-blocks faq-07 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import { PlusIcon } from "lucide-react"
import { AccordionPrimitive } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { cn } from "@siteinabox/ui/lib/utils"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
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

export type Faq07Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  items: FaqItem[]
}

export function Faq07({ title, intro, items, blockIndex, editSlots, rootAttributes }: Faq07Props) {
  const titleContent = renderFaqTitle(editSlots, title, blockIndex)
  const introContent = renderFaqIntro(editSlots, intro, blockIndex)

  return (
    <div className="px-6 py-20" {...rootAttributes}>
      <div className="mx-auto w-full max-w-2xl">
        {titleContent ? (
          <h2 className="font-medium text-4xl/snug tracking-[-0.04em]">
            {titleContent}
          </h2>
        ) : null}
        {introContent ? (
          <p className="mt-2 text-muted-foreground text-xl">
            {introContent}
          </p>
        ) : null}

        <Accordion
          className="mt-8 space-y-4 sm:mt-10"
          collapsible
          defaultValue={items.length > 0 ? faqAccordionValue(0) : undefined}
          type="single"
        >
          {items.map((item, itemIndex) => (
            <AccordionItem
              className="rounded-xl border-none bg-muted px-4"
              key={itemIndex}
              value={faqAccordionValue(itemIndex)}
            >
              <AccordionPrimitive.Header className="flex items-center">
                <AccordionPrimitive.Trigger
                  className={cn(
                    "flex flex-1 items-center justify-between py-4 font-medium tracking-tight transition-all hover:underline aria-expanded:pb-3 [&[aria-expanded=true]>svg]:rotate-45",
                    "text-start text-lg",
                  )}
                >
                  {renderFaqQuestion(editSlots, item.question, blockIndex, itemIndex)}
                  <PlusIcon className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200" />
                </AccordionPrimitive.Trigger>
              </AccordionPrimitive.Header>
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

export default function Faq07Literal() {
  return (
    <Faq07
      title={faqFamilyCmsLike.title}
      intro={faqFamilyCmsLike.intro}
      items={faqFamilyCmsLike.items}
      blockIndex={0}
    />
  )
}
