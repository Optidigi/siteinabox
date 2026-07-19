// Owned typed adaptation of upstream shadcnui-blocks pricing-08 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import { Box, CircleCheck, Gem, type LucideIcon, Users } from "lucide-react"
import { Badge } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { Separator } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { cn } from "@siteinabox/ui/lib/utils"
import { pricing08FamilyCmsLike } from "../../typed/fixtures/pricing-family"
import {
  parsePriceNumber,
  planIcon,
  planIsHighlighted,
  type PricingPlanItem,
  renderPlanCta,
  renderPlanDescription,
  renderPlanFeatureLabel,
  renderPlanPrice,
  renderPlanTitle,
  renderPricingIntro,
  renderPricingTitle,
  slicePricingPlans,
} from "../../typed/pricing-fields"
import type { TypedVariantBaseProps } from "../../typed/props"

const MAX_PLANS = 3
const PLAN_ICONS: LucideIcon[] = [Box, Gem, Users]

export type Pricing08Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  plans: PricingPlanItem[]
}

function PlanCard({
  plan,
  planIndex,
  blockIndex,
  editSlots,
}: {
  plan: PricingPlanItem
  planIndex: number
  blockIndex: number
  editSlots: Pricing08Props["editSlots"]
}) {
  const highlighted = planIsHighlighted(plan)
  const Icon = planIcon(null, PLAN_ICONS, planIndex)
  const priceContent = renderPlanPrice(editSlots, plan.price, blockIndex, planIndex)
  const priceValue = parsePriceNumber(plan.price)
  const ctaContent = renderPlanCta(editSlots, plan.cta, blockIndex, planIndex)

  return (
    <div
      className={cn("border bg-card", {
        "relative border border-primary bg-card ring ring-primary ring-inset": highlighted,
      })}
    >
      {highlighted ? (
        <Badge className="absolute top-0 right-0 rounded-none">
          {plan.badge?.trim() || "Most Popular"}
        </Badge>
      ) : null}
      <div className={cn("p-6", { "bg-linear-to-bl from-primary/15": highlighted })}>
        {Icon ? <Icon className="mb-5 text-primary" /> : null}
        <div className="flex items-center gap-1">
          <h3 className="font-medium text-2xl tracking-tight">
            {renderPlanTitle(editSlots, plan.title, blockIndex, planIndex)}
          </h3>
        </div>
        {plan.description ? (
          <p className="my-2 text-muted-foreground">
            {renderPlanDescription(editSlots, plan.description, blockIndex, planIndex)}
          </p>
        ) : null}
      </div>
      <Separator />
      <div className="px-6 pt-5 pb-10">
        <p className="mt-4 font-satoshi font-semibold text-4xl">
          {priceContent ?? (priceValue ? `$${priceValue}` : null)}
        </p>
        <p className="mt-1 text-muted-foreground text-sm tracking-normal">one-time payment</p>
        {ctaContent ? (
          <Button className="my-6 w-full" size="lg" asChild>
            {ctaContent}
          </Button>
        ) : !editSlots ? (
          <Button className="my-6 w-full" size="lg">Get Started</Button>
        ) : null}
        <ul className="mt-4 space-y-2">
          {(plan.features ?? []).map((feature, featureIndex) => (
            <li className="flex items-center gap-2" key={featureIndex}>
              <CircleCheck className="size-4 shrink-0 text-primary" />
              {renderPlanFeatureLabel(editSlots, feature.label, blockIndex, planIndex, featureIndex)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function Pricing08({ title, intro, plans, blockIndex, editSlots, rootAttributes }: Pricing08Props) {
  const titleContent = renderPricingTitle(editSlots, title, blockIndex)
  const introContent = renderPricingIntro(editSlots, intro, blockIndex)
  const displayPlans = slicePricingPlans(plans, MAX_PLANS)

  return (
    <section className="mx-auto max-w-5xl px-6 py-20" {...rootAttributes}>
      {titleContent ? (
        <h2 className="text-center font-medium text-4xl tracking-[-0.04em] sm:text-[2.75rem]">{titleContent}</h2>
      ) : null}
      {introContent ? (
        <p className="mt-3 text-center text-muted-foreground text-xl -tracking-[0.01em] md:text-2xl">{introContent}</p>
      ) : null}
      <div className="mt-12 grid grid-cols-1 gap-y-8 shadow-xs/2 sm:grid-cols-2 md:mt-16 md:grid-cols-3">
        {displayPlans.map((plan, planIndex) => (
          <PlanCard
            blockIndex={blockIndex}
            editSlots={editSlots}
            key={planIndex}
            plan={plan}
            planIndex={planIndex}
          />
        ))}
      </div>
    </section>
  )
}

export default function Pricing08Literal() {
  return (
    <Pricing08
      title={pricing08FamilyCmsLike.title}
      intro={pricing08FamilyCmsLike.intro}
      plans={pricing08FamilyCmsLike.plans}
      blockIndex={0}
    />
  )
}
