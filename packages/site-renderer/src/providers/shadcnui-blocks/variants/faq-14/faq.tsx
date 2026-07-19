// Owned typed adaptation of upstream shadcnui-blocks faq-14 (MIT, see ../../LICENSE).
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
import { cn } from "@siteinabox/ui/lib/utils"
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

export type Faq14Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  items: FaqItem[]
}

export function Faq14({ title, intro, items, blockIndex, editSlots, rootAttributes }: Faq14Props) {
  const titleContent = renderFaqTitle(editSlots, title, blockIndex)
  const introContent = renderFaqIntro(editSlots, intro, blockIndex)

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 sm:py-14" {...rootAttributes}>
      {titleContent ? (
        <h2 className="text-balance font-medium text-4xl/[1.3] tracking-[-0.04em]">
          {titleContent}
        </h2>
      ) : null}
      {introContent ? (
        <div className="mt-2.5 text-balance text-lg text-muted-foreground tracking-normal">
          {introContent}
        </div>
      ) : null}

      <div className="mx-auto mt-8 max-w-2xl">
        <Accordion
          collapsible
          defaultValue={items.length > 0 ? faqAccordionValue(0) : undefined}
          type="single"
        >
          {items.map((item, itemIndex) => {
            const Icon = ITEM_ICONS[itemIndex % ITEM_ICONS.length] ?? Package
            return (
              <AccordionItem
                className="border not-last:border-b-0 bg-muted/35 last:border-b"
                key={itemIndex}
                value={faqAccordionValue(itemIndex)}
              >
                <AccordionTrigger className="rounded-none px-5 py-0 ps-0 text-base data-[state=open]:border-b">
                  <div className="flex gap-2 divide-x">
                    <div
                      className={cn(
                        "flex items-center justify-center bg-muted/40 bg-size-[10px_10px] bg-fixed px-4",
                        {
                          "bg-[repeating-linear-gradient(315deg,color-mix(in_srgb,var(--border)_30%,transparent)_0,color-mix(in_srgb,var(--border)_30%,transparent)_1px,transparent_0,transparent_50%)]":
                            itemIndex % 2 === 0,
                          "bg-[repeating-linear-gradient(45deg,color-mix(in_srgb,var(--border)_30%,transparent)_0,color-mix(in_srgb,var(--border)_30%,transparent)_1px,transparent_0,transparent_50%)]":
                            itemIndex % 2 !== 0,
                        },
                      )}
                    >
                      <Icon className="size-5 fill-foreground/7" />
                    </div>
                    <span className="py-3.5 pl-2.5">
                      {renderFaqQuestion(editSlots, item.question, blockIndex, itemIndex)}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="relative bg-background px-5 py-5 pl-18 text-base text-foreground/75">
                  {renderFaqAnswer(editSlots, item.answer, blockIndex, itemIndex)}
                  <div className="absolute inset-y-0 left-13 border-foreground/10 border-s border-dashed" />
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      </div>
    </div>
  )
}

export default function Faq14Literal() {
  return (
    <Faq14
      title={faqFamilyCmsLike.title}
      intro={faqFamilyCmsLike.intro}
      items={faqFamilyCmsLike.items}
      blockIndex={0}
    />
  )
}
