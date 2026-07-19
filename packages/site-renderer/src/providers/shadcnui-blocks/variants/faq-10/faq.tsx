// Owned typed adaptation of upstream shadcnui-blocks faq-10 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import {
  CircleDollarSign,
  Clock,
  type LucideIcon,
  Package,
  PackageX,
  Plane,
  ShieldPlus,
  Users,
  Waypoints,
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

const ITEM_ICONS: LucideIcon[] = [
  Package, Clock, Plane, Waypoints, CircleDollarSign, PackageX, ShieldPlus, Users,
]

const AccordionItemList = ({
  items,
  itemOffset,
  blockIndex,
  editSlots,
}: {
  items: FaqItem[]
  itemOffset: number
  blockIndex: number
  editSlots: Faq10Props["editSlots"]
}) => (
  <>
    {items.map((item, localIndex) => {
      const itemIndex = itemOffset + localIndex
      const Icon = ITEM_ICONS[itemIndex % ITEM_ICONS.length] ?? Package
      return (
        <AccordionItem
          className="rounded-lg border border-primary/20 bg-primary/10 px-5 last:border-b dark:border-primary/30 dark:bg-primary/15"
          key={itemIndex}
          value={faqAccordionValue(itemIndex)}
        >
          <AccordionTrigger className="text-lg">
            <div className="flex items-center gap-2">
              <Icon className="mr-2.5 size-5 shrink-0 text-primary/80 dark:text-primary" />
              {renderFaqQuestion(editSlots, item.question, blockIndex, itemIndex)}
            </div>
          </AccordionTrigger>
          <AccordionContent className="pl-10 text-base">
            {renderFaqAnswer(editSlots, item.answer, blockIndex, itemIndex)}
          </AccordionContent>
        </AccordionItem>
      )
    })}
  </>
)

export type Faq10Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  items: FaqItem[]
}

export function Faq10({ title, intro, items, blockIndex, editSlots, rootAttributes }: Faq10Props) {
  const titleContent = renderFaqTitle(editSlots, title, blockIndex)
  const introContent = renderFaqIntro(editSlots, intro, blockIndex)
  const midpoint = Math.ceil(items.length / 2)
  const firstHalfItems = items.slice(0, midpoint)
  const secondHalfItems = items.slice(midpoint)

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

      <div className="mx-auto mt-12 max-w-5xl sm:mt-16">
        <Accordion
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
          collapsible
          type="single"
        >
          <div className="space-y-4">
            <AccordionItemList
              blockIndex={blockIndex}
              editSlots={editSlots}
              itemOffset={0}
              items={firstHalfItems}
            />
          </div>
          <div className="space-y-4">
            <AccordionItemList
              blockIndex={blockIndex}
              editSlots={editSlots}
              itemOffset={midpoint}
              items={secondHalfItems}
            />
          </div>
        </Accordion>
      </div>
    </div>
  )
}

export default function Faq10Literal() {
  return (
    <Faq10
      title={faqFamilyCmsLike.title}
      intro={faqFamilyCmsLike.intro}
      items={faqFamilyCmsLike.items}
      blockIndex={0}
    />
  )
}
