// Owned typed adaptation of upstream shadcnui-blocks faq-04 (MIT, see ../../LICENSE).
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
import { faq04Literal } from "../../typed/fixtures/faq-family"
import type { TypedVariantBaseProps } from "../../typed/props"

const ITEM_ICONS: LucideIcon[] = [Undo2, Route, Truck, BadgeDollarSign, ShieldCheck, UserRoundCheck]

export type Faq04Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  items: FaqItem[]
}

export function Faq04({ title, intro, items, blockIndex, editSlots, rootAttributes }: Faq04Props) {
  const titleContent = renderFaqTitle(editSlots, title, blockIndex)
  const introContent = renderFaqIntro(editSlots, intro, blockIndex)

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-20" {...rootAttributes}>
      <div className="max-w-(--breakpoint-lg)">
        {titleContent ? (
          <h2 className="text-center font-medium text-4xl/snug tracking-[-0.04em] md:text-[2.75rem]">
            {titleContent}
          </h2>
        ) : null}
        {introContent ? (
          <div className="mt-3 text-center text-muted-foreground text-xl md:text-2xl md:tracking-[-0.015em]">
            {introContent}
          </div>
        ) : null}

        <div className="mt-12 grid gap-4 rounded-xl sm:mt-16 md:grid-cols-2">
          {items.map((item, itemIndex) => {
            const Icon = ITEM_ICONS[itemIndex % ITEM_ICONS.length] ?? Undo2
            return (
              <div
                className="rounded-xl border border-border/85 bg-card p-6 shadow-xs/3"
                key={itemIndex}
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-full bg-foreground/5">
                    <Icon className="size-4.5" />
                  </div>
                  <span className="font-medium text-[1.175rem] tracking-tight">
                    {renderFaqQuestion(editSlots, item.question, blockIndex, itemIndex)}
                  </span>
                </div>
                <div className="mt-3 text-foreground/70">
                  {renderFaqAnswer(editSlots, item.answer, blockIndex, itemIndex)}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function Faq04Literal() {
  return (
    <Faq04
      title={faq04Literal.title}
      intro={faq04Literal.intro}
      items={faq04Literal.items}
      blockIndex={0}
    />
  )
}
