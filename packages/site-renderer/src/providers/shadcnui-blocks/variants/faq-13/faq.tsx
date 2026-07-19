// Owned typed adaptation of upstream shadcnui-blocks faq-13 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import { cn } from "@siteinabox/ui/lib/utils"
import {
  type FaqItem,
  renderFaqAnswer,
  renderFaqIntro,
  renderFaqQuestion,
  renderFaqTitle,
} from "../../typed/faq-fields"
import { faqFamilyCmsLike } from "../../typed/fixtures/faq-family"
import type { TypedVariantBaseProps } from "../../typed/props"

export type Faq13Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  items: FaqItem[]
}

export function Faq13({ title, intro, items, blockIndex, editSlots, rootAttributes }: Faq13Props) {
  const titleContent = renderFaqTitle(editSlots, title, blockIndex)
  const introContent = renderFaqIntro(editSlots, intro, blockIndex)

  return (
    <div className="mx-auto max-w-(--breakpoint-lg) px-6 py-14" {...rootAttributes}>
      {titleContent ? (
        <h2 className="mt-5 max-w-4xl text-balance font-medium text-4xl leading-[1.1] tracking-[-0.04em]">
          {titleContent}
        </h2>
      ) : null}
      {introContent ? (
        <div className="mt-2 text-lg text-muted-foreground sm:text-xl">
          {introContent}
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-1 rounded-lg border border-border/75 bg-muted p-0.75 md:grid-cols-2">
        {items.map((item, itemIndex) => (
          <div
            className={cn(
              "relative overflow-hidden border border-border/90 bg-background text-start",
              "first:rounded-t-md last:rounded-b-md md:nth-[2]:rounded-tr-md md:nth-last-[2]:rounded-bl-md md:last:rounded-bl-none md:first:rounded-tr-none",
            )}
            key={itemIndex}
          >
            <div className="isolate">
              <span className="absolute top-0 left-0 rounded-br-md border-border/50 border-e border-b bg-muted px-2 py-0.75 font-mono text-[11px]">
                {(itemIndex + 1).toString().padStart(2, "0")}
              </span>
              <div className="flex items-center gap-2 border-b border-dashed px-6 py-3 ps-11 font-medium text-base">
                {renderFaqQuestion(editSlots, item.question, blockIndex, itemIndex)}
              </div>
              <div className="px-6 py-5 ps-11 text-start text-foreground/70 text-sm">
                {renderFaqAnswer(editSlots, item.answer, blockIndex, itemIndex)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Faq13Literal() {
  return (
    <Faq13
      title={faqFamilyCmsLike.title}
      intro={faqFamilyCmsLike.intro}
      items={faqFamilyCmsLike.items}
      blockIndex={0}
    />
  )
}
