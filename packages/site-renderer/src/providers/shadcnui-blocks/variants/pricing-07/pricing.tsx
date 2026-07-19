// Owned typed adaptation of upstream shadcnui-blocks pricing-07 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import { useState } from "react"
import type { RtRoot } from "@siteinabox/contracts"
import NumberFlow from "@number-flow/react"
import { Box, CircleCheck, Gem, type LucideIcon, Users } from "lucide-react"
import { Badge } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { Tabs, TabsList, TabsTrigger } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { cn } from "@siteinabox/ui/lib/utils"
import { pricing07FamilyCmsLike } from "../../typed/fixtures/pricing-family"
import {
  parsePriceNumber,
  planIcon,
  planIsHighlighted,
  type PricingPlanItem,
  renderPlanCta,
  renderPlanDescription,
  renderPlanFeatureLabel,
  renderPlanTitle,
  slicePricingPlans,
} from "../../typed/pricing-fields"
import type { TypedVariantBaseProps } from "../../typed/props"

const MAX_PLANS = 3
const YEARLY_DISCOUNT_PERCENTAGE = 20
const PLAN_ICONS: LucideIcon[] = [Box, Gem, Users]

type BillingPeriod = "monthly" | "yearly"

export type Pricing07Props = TypedVariantBaseProps & {
  plans: PricingPlanItem[]
}

function PlanCard({
  plan,
  planIndex,
  blockIndex,
  editSlots,
  billingPeriod,
}: {
  plan: PricingPlanItem
  planIndex: number
  blockIndex: number
  editSlots: Pricing07Props["editSlots"]
  billingPeriod: BillingPeriod
}) {
  const highlighted = planIsHighlighted(plan)
  const Icon = planIcon(null, PLAN_ICONS, planIndex)
  const monthlyPrice = parsePriceNumber(plan.price)
  const price = billingPeriod === "yearly"
    ? Math.floor((monthlyPrice * (100 - YEARLY_DISCOUNT_PERCENTAGE)) / 100)
    : monthlyPrice
  const ctaContent = renderPlanCta(editSlots, plan.cta, blockIndex, planIndex)

  return (
    <div
      className={cn("rounded-lg bg-card p-6 shadow-xs/3 ring ring-border/85", {
        "relative bg-primary/5 ring-2 ring-primary": highlighted,
      })}
    >
      {highlighted ? (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
          {plan.badge?.trim() || "Most Popular"}
        </Badge>
      ) : null}
      {Icon ? <Icon className="mb-4 text-primary" /> : null}
      <div className="flex items-center gap-1">
        <h3 className="font-medium text-2xl tracking-tight">
          {renderPlanTitle(editSlots, plan.title, blockIndex, planIndex)}
        </h3>
      </div>
      {plan.description ? (
        <p className="mt-2 min-h-[2lh] text-muted-foreground">
          {renderPlanDescription(editSlots, plan.description, blockIndex, planIndex)}
        </p>
      ) : null}
      <p className="mt-4 font-semibold text-4xl">
        <NumberFlow className="font-satoshi" prefix="$" value={price} />
        <span className="ms-0.5 font-normal text-lg text-muted-foreground tracking-tight">/month</span>
      </p>
      {ctaContent ? (
        <Button className="mt-6 mb-8 h-10 w-full" size="lg" asChild>
          {ctaContent}
        </Button>
      ) : !editSlots ? (
        <Button className="mt-6 mb-8 h-10 w-full" size="lg">Get Started</Button>
      ) : null}
      <ul className="space-y-2">
        {(plan.features ?? []).map((feature, featureIndex) => (
          <li className="flex items-center gap-2" key={featureIndex}>
            <CircleCheck className="size-4 shrink-0 text-primary" />
            {renderPlanFeatureLabel(editSlots, feature.label, blockIndex, planIndex, featureIndex)}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Pricing07({ plans, blockIndex, editSlots, rootAttributes }: Pricing07Props) {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("yearly")
  const displayPlans = slicePricingPlans(plans, MAX_PLANS)

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-16" {...rootAttributes}>
      <Tabs
        className="mx-auto"
        onValueChange={(value) => setBillingPeriod(value as BillingPeriod)}
        value={billingPeriod}
      >
        <TabsList>
          <TabsTrigger className="px-4" value="monthly">Monthly</TabsTrigger>
          <TabsTrigger className="px-4" value="yearly">Yearly</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 md:grid-cols-3">
        {displayPlans.map((plan, planIndex) => (
          <PlanCard
            billingPeriod={billingPeriod}
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

export default function Pricing07Literal() {
  return <Pricing07 plans={pricing07FamilyCmsLike.plans} blockIndex={0} />
}
