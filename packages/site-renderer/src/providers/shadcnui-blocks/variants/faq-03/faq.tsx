// Owned typed adaptation of upstream shadcnui-blocks faq-03 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import { useState } from "react"
import type { RtRoot } from "@siteinabox/contracts"
import { PlusIcon } from "lucide-react"
import { AccordionPrimitive } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { cn } from "@siteinabox/ui/lib/utils"
import {
  faqAccordionValue,
  type FaqItem,
  renderFaqAnswer,
  renderFaqQuestion,
  renderFaqTitle,
} from "../../typed/faq-fields"
import { faq03Literal } from "../../typed/fixtures/faq-family"
import type { TypedVariantBaseProps } from "../../typed/props"

export type Faq03Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  items: FaqItem[]
}

const Faq03Column = ({
  items,
  valueOffset,
  value,
  onValueChange,
  blockIndex,
  editSlots,
  triggerClassName,
}: {
  items: FaqItem[]
  valueOffset: number
  value: string | undefined
  onValueChange: (value: string) => void
  blockIndex: number
  editSlots: Faq03Props["editSlots"]
  triggerClassName: string
}) => (
  <Accordion
    className="w-full"
    collapsible
    onValueChange={onValueChange}
    type="single"
    value={value}
  >
    {items.map((item, itemIndex) => {
      const globalIndex = valueOffset + itemIndex
      return (
        <AccordionItem key={globalIndex} value={faqAccordionValue(globalIndex)}>
          <AccordionPrimitive.Header className="flex">
            <AccordionPrimitive.Trigger
              className={cn(
                "flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-45",
                triggerClassName,
              )}
            >
              {renderFaqQuestion(editSlots, item.question, blockIndex, globalIndex)}
              <PlusIcon className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200" />
            </AccordionPrimitive.Trigger>
          </AccordionPrimitive.Header>
          <AccordionContent className="text-pretty text-base text-muted-foreground">
            {renderFaqAnswer(editSlots, item.answer, blockIndex, globalIndex)}
          </AccordionContent>
        </AccordionItem>
      )
    })}
  </Accordion>
)

export function Faq03({ title, items, blockIndex, editSlots, rootAttributes }: Faq03Props) {
  const [value, setValue] = useState<string>()
  const titleContent = renderFaqTitle(editSlots, title, blockIndex)
  const leftItems = items.slice(0, 5)
  const rightItems = items.slice(5)

  return (
    <div className="px-6 py-20" {...rootAttributes}>
      <div className="mx-auto w-full max-w-(--breakpoint-lg)">
        {titleContent ? (
          <h2 className="font-medium text-4xl tracking-[-0.04em] md:text-[2.75rem]">
            {titleContent}
          </h2>
        ) : null}

        <div className="mt-6 grid w-full gap-x-10 md:grid-cols-2">
          <Faq03Column
            blockIndex={blockIndex}
            editSlots={editSlots}
            items={leftItems}
            onValueChange={setValue}
            triggerClassName="text-start text-lg"
            value={value}
            valueOffset={0}
          />
          <Faq03Column
            blockIndex={blockIndex}
            editSlots={editSlots}
            items={rightItems}
            onValueChange={setValue}
            triggerClassName="text-start text-lg tracking-tight"
            value={value}
            valueOffset={5}
          />
        </div>
      </div>
    </div>
  )
}

export default function Faq03Literal() {
  return (
    <Faq03
      title={faq03Literal.title}
      items={faq03Literal.items}
      blockIndex={0}
    />
  )
}
