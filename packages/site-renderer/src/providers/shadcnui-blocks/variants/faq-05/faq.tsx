// Owned typed adaptation of upstream shadcnui-blocks faq-05 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import {
  BadgeDollarSign,
  Route,
  ShieldCheck,
  Truck,
  Undo2,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react"
import {
  type FaqItem,
  renderFaqAnswer,
  renderFaqIntro,
  renderFaqQuestion,
  renderFaqTitle,
} from "../../typed/faq-fields"
import { faq05Literal } from "../../typed/fixtures/faq-family"
import type { TypedVariantBaseProps } from "../../typed/props"

const ITEM_ICONS: LucideIcon[] = [Undo2, Route, Truck, BadgeDollarSign, ShieldCheck, UserRoundCheck]

export type Faq05Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  items: FaqItem[]
}

export function Faq05({ title, intro, items, blockIndex, editSlots, rootAttributes }: Faq05Props) {
  const titleContent = renderFaqTitle(editSlots, title, blockIndex)
  const introContent = renderFaqIntro(editSlots, intro, blockIndex)

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-20" {...rootAttributes}>
      <div className="max-w-(--breakpoint-lg)">
        {titleContent ? (
          <h2 className="text-center font-medium text-4xl/snug tracking-[-0.05em] md:text-[2.75rem]">
            {titleContent}
          </h2>
        ) : null}
        {introContent ? (
          <div className="mt-3 text-center text-muted-foreground text-xl md:text-2xl md:tracking-[-0.015em]">
            {introContent}
          </div>
        ) : null}

        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border/85 bg-border/85 shadow-xs/3 sm:mt-16 md:grid-cols-2">
          {items.map((item, itemIndex) => {
            const Icon = ITEM_ICONS[itemIndex % ITEM_ICONS.length] ?? Undo2
            return (
              <div className="flex items-start gap-4 bg-card p-6" key={itemIndex}>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground/5">
                  <Icon className="size-5" />
                </div>
                <div>
                  <div className="mt-1 mb-2 flex items-start gap-2 font-medium text-[1.175rem] tracking-tight">
                    <span>{renderFaqQuestion(editSlots, item.question, blockIndex, itemIndex)}</span>
                  </div>
                  <div className="text-foreground/70">
                    {renderFaqAnswer(editSlots, item.answer, blockIndex, itemIndex)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function Faq05Literal() {
  return (
    <Faq05
      title={faq05Literal.title}
      intro={faq05Literal.intro}
      items={faq05Literal.items}
      blockIndex={0}
    />
  )
}
