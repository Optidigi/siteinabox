// Owned typed adaptation of upstream shadcnui-blocks pricing-10 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import { Box, CircleCheck, Gem, type LucideIcon, Users } from "lucide-react"
import { Badge } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { pricing10FamilyCmsLike } from "../../typed/fixtures/pricing-family"
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

export type Pricing10Props = TypedVariantBaseProps & {
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
  editSlots: Pricing10Props["editSlots"]
}) {
  const highlighted = planIsHighlighted(plan)
  const Icon = planIcon(null, PLAN_ICONS, planIndex)
  const priceContent = renderPlanPrice(editSlots, plan.price, blockIndex, planIndex)
  const priceValue = parsePriceNumber(plan.price)
  const ctaContent = renderPlanCta(editSlots, plan.cta, blockIndex, planIndex)

  return (
    <div className="shadow/5 relative rounded-lg border bg-background border-border">
      {highlighted ? (
        <Badge className="absolute top-3 right-3">{plan.badge?.trim() || "Most Popular"}</Badge>
      ) : null}
      <div className="rounded-t-lg border-b border-dashed p-6 border-border">
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
      <div className="px-6 pt-5 pb-10">
        <p className="mt-4 font-satoshi font-semibold text-4xl">
          {priceContent ?? (priceValue ? `$${priceValue}` : null)}
        </p>
        <p className="mt-1 text-muted-foreground text-sm tracking-normal">one-time payment</p>
        {ctaContent ? (
          <Button className="my-6 w-full" size="lg" variant={highlighted ? "default" : "outline"} asChild>
            {ctaContent}
          </Button>
        ) : !editSlots ? (
          <Button className="my-6 w-full" size="lg" variant={highlighted ? "default" : "outline"}>
            Get Started
          </Button>
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

export function Pricing10({ title, intro, plans, blockIndex, editSlots, rootAttributes }: Pricing10Props) {
  const titleContent = renderPricingTitle(editSlots, title, blockIndex)
  const introContent = renderPricingIntro(editSlots, intro, blockIndex)
  const displayPlans = slicePricingPlans(plans, MAX_PLANS)

  return (
    <section className="mx-auto max-w-6xl px-6 py-20" {...rootAttributes}>
      {titleContent ? (
        <h2 className="text-balance text-center font-medium text-4xl tracking-[-0.04em] sm:text-[2.75rem]">{titleContent}</h2>
      ) : null}
      {introContent ? (
        <p className="mt-2 text-balance text-center text-lg text-muted-foreground -tracking-[0.01em] sm:mt-4 sm:text-2xl">
          {introContent}
        </p>
      ) : null}
      <div className="mt-12 grid grid-cols-1 gap-1 rounded-xl border bg-muted/40 p-1 sm:mt-16 sm:grid-cols-2 md:mt-15 md:grid-cols-3 border-border">
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

export default function Pricing10Literal() {
  return (
    <Pricing10
      title={pricing10FamilyCmsLike.title}
      intro={pricing10FamilyCmsLike.intro}
      plans={pricing10FamilyCmsLike.plans}
      blockIndex={0}
    />
  )
}
