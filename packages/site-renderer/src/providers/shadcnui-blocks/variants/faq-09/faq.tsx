// Owned typed adaptation of upstream shadcnui-blocks faq-09 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import {
  CircleDollarSign,
  Clock,
  Package,
  PackageX,
  Plane,
  Waypoints,
  type LucideIcon,
} from "lucide-react"
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

const ITEM_ICONS: LucideIcon[] = [Package, Clock, Plane, Waypoints, CircleDollarSign, PackageX]

export type Faq09Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  items: FaqItem[]
}

export function Faq09({ title, intro, items, blockIndex, editSlots, rootAttributes }: Faq09Props) {
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

      <div className="mx-auto mt-12 max-w-2xl sm:mt-16">
        <Accordion className="space-y-4" collapsible type="single">
          {items.map((item, itemIndex) => {
            const Icon = ITEM_ICONS[itemIndex % ITEM_ICONS.length] ?? Package
            return (
              <AccordionItem
                className="rounded-xl not-last:border-b-0 bg-muted px-5"
                key={itemIndex}
                value={faqAccordionValue(itemIndex)}
              >
                <AccordionTrigger className="text-lg">
                  <div className="flex items-center gap-2">
                    <Icon className="mr-2.5 size-5" />
                    {renderFaqQuestion(editSlots, item.question, blockIndex, itemIndex)}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="relative pl-10 text-base">
                  {renderFaqAnswer(editSlots, item.answer, blockIndex, itemIndex)}
                  <div className="absolute inset-y-0 left-2.5 border-foreground/10 border-s border-dashed" />
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      </div>
    </div>
  )
}

export default function Faq09Literal() {
  return (
    <Faq09
      title={faqFamilyCmsLike.title}
      intro={faqFamilyCmsLike.intro}
      items={faqFamilyCmsLike.items}
      blockIndex={0}
    />
  )
}
