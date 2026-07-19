// Owned typed adaptation of upstream shadcnui-blocks faq-12 (MIT, see ../../LICENSE).
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

const ITEM_ICONS: LucideIcon[] = [
  Package, Clock, Plane, Waypoints, CircleDollarSign, PackageX, ShieldPlus, Users,
]

const GRID_PATTERN_STYLE: React.CSSProperties = {
  backgroundImage: `
        linear-gradient(to right, oklch(from var(--card-foreground) l c h / 0.12) 1px, transparent 1px),
        linear-gradient(to bottom, oklch(from var(--card-foreground) l c h / 0.12) 1px, transparent 1px)
      `,
  backgroundSize: "20px 20px",
  backgroundPosition: "0 0, 0 0",
  maskImage: `
          repeating-linear-gradient(
              to right,
              black 0px,
              black 3px,
              transparent 3px,
              transparent 8px
            ),
            repeating-linear-gradient(
              to bottom,
              black 0px,
              black 3px,
              transparent 3px,
              transparent 8px
            ),
            radial-gradient(ellipse 80% 80% at 100% 0%, #000 50%, transparent 90%)
      `,
  WebkitMaskImage: `
    repeating-linear-gradient(
              to right,
              black 0px,
              black 3px,
              transparent 3px,
              transparent 8px
            ),
            repeating-linear-gradient(
              to bottom,
              black 0px,
              black 3px,
              transparent 3px,
              transparent 8px
            ),
            radial-gradient(ellipse 80% 80% at 100% 0%, #000 50%, transparent 90%)
      `,
  maskComposite: "intersect",
  WebkitMaskComposite: "source-in",
}

export type Faq12Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  items: FaqItem[]
}

export function Faq12({ title, intro, items, blockIndex, editSlots, rootAttributes }: Faq12Props) {
  const titleContent = renderFaqTitle(editSlots, title, blockIndex)
  const introContent = renderFaqIntro(editSlots, intro, blockIndex)

  return (
    <div {...rootAttributes}>
      <div className="px-6 py-20 text-center">
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

        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 sm:mt-16 md:grid-cols-2">
          {items.map((item, itemIndex) => {
            const Icon = ITEM_ICONS[itemIndex % ITEM_ICONS.length] ?? Package
            return (
              <div
                className={cn(
                  "relative -ms-px -mt-px overflow-hidden border bg-card p-6 text-start",
                  "first:rounded-t-lg last:rounded-b-lg md:nth-[2]:rounded-tr-lg md:nth-last-[2]:rounded-bl-lg md:last:rounded-bl-none md:first:rounded-tr-none",
                )}
                key={itemIndex}
              >
                <div className="isolate">
                  <div className="flex items-center gap-2 font-medium text-lg tracking-tight">
                    <Icon className="mr-2.5 size-5 shrink-0 text-primary" />
                    {renderFaqQuestion(editSlots, item.question, blockIndex, itemIndex)}
                  </div>
                  <div className="mt-2 pl-10 text-start text-base text-foreground/80">
                    {renderFaqAnswer(editSlots, item.answer, blockIndex, itemIndex)}
                  </div>
                </div>

                <div
                  className="absolute inset-0 z-0 -ms-px -mt-0.5"
                  style={GRID_PATTERN_STYLE}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function Faq12Literal() {
  return (
    <Faq12
      title={faqFamilyCmsLike.title}
      intro={faqFamilyCmsLike.intro}
      items={faqFamilyCmsLike.items}
      blockIndex={0}
    />
  )
}
