// Owned typed adaptation of upstream shadcnui-blocks faq-11 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import { useState } from "react"
import type { RtRoot } from "@siteinabox/contracts"
import {
  BanknoteArrowDown,
  CircleDollarSign,
  Package,
  Users,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@siteinabox/ui/lib/utils"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
} from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import {
  faqAccordionValue,
  type FaqItem,
  renderFaqAnswer,
  renderFaqIntro,
  renderFaqQuestion,
  renderFaqTitle,
} from "../../typed/faq-fields"
import { faq11Literal } from "../../typed/fixtures/faq-family"
import type { TypedVariantBaseProps } from "../../typed/props"

type FaqCategory = {
  category: string
  icon: LucideIcon
}

const CATEGORIES: FaqCategory[] = [
  { category: "Orders & Shipping", icon: Package },
  { category: "Returns & Refunds", icon: BanknoteArrowDown },
  { category: "Payments", icon: CircleDollarSign },
  { category: "Account & Support", icon: Users },
]

const FAQList = ({
  items,
  blockIndex,
  editSlots,
}: {
  items: FaqItem[]
  blockIndex: number
  editSlots: Faq11Props["editSlots"]
}) => (
  <Accordion className="space-y-4" collapsible type="single">
    {items.map((item, itemIndex) => (
      <AccordionItem
        className="rounded-xl not-last:border-b-0 bg-muted px-5"
        key={itemIndex}
        value={faqAccordionValue(itemIndex)}
      >
        <AccordionTrigger className="font-medium text-lg">
          <div className="flex items-center gap-2">
            {renderFaqQuestion(editSlots, item.question, blockIndex, itemIndex)}
          </div>
        </AccordionTrigger>
        <AccordionContent className="text-base">
          {renderFaqAnswer(editSlots, item.answer, blockIndex, itemIndex)}
        </AccordionContent>
      </AccordionItem>
    ))}
  </Accordion>
)

export type Faq11Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  items: FaqItem[]
}

export function Faq11({ title, intro, items, blockIndex, editSlots, rootAttributes }: Faq11Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>(CATEGORIES[0]?.category ?? null)
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
        <div className="mt-3 text-balance text-center text-lg text-muted-foreground md:text-2xl md:tracking-[-0.015em]">
          {introContent}
        </div>
      ) : null}

      <div className="mx-auto mt-12 max-w-4xl sm:mt-16">
        <div className="flex flex-col divide-y sm:hidden">
          {CATEGORIES.map(({ category, icon: Icon }) => (
            <div className="pt-8 pb-10" key={category}>
              <div className="mb-2 flex items-center gap-3 pb-3 pl-2">
                <Icon className="size-6" />
                <span className="font-medium text-lg">{category}</span>
              </div>
              <FAQList blockIndex={blockIndex} editSlots={editSlots} items={items} />
            </div>
          ))}
        </div>

        <div className="hidden gap-8 sm:flex">
          <div className="flex flex-col gap-4">
            {CATEGORIES.map(({ category, icon: Icon }) => (
              <Button
                className={cn("h-11 justify-start gap-1 font-semibold", {
                  "text-foreground/70 hover:text-foreground": activeCategory !== category,
                })}
                key={category}
                onClick={() => setActiveCategory(category)}
                variant={activeCategory === category ? "default" : "ghost"}
              >
                <Icon className="mr-2.5 size-5" />
                {category}
              </Button>
            ))}
          </div>

          <div className="flex grow flex-col gap-4">
            <FAQList blockIndex={blockIndex} editSlots={editSlots} items={items} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Faq11Literal() {
  return (
    <Faq11
      title={faq11Literal.title}
      intro={faq11Literal.intro}
      items={faq11Literal.items}
      blockIndex={0}
    />
  )
}
