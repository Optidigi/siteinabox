// Owned typed adaptation of upstream shadcnui-blocks pricing-03 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import { useState } from "react"
import type { RtRoot } from "@siteinabox/contracts"
import NumberFlow from "@number-flow/react"
import { CircleCheck, CircleHelp } from "lucide-react"
import { cn } from "@siteinabox/ui/lib/utils"
import { Badge } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { Separator } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { Tabs, TabsList, TabsTrigger } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { pricing03FamilyCmsLike } from "../../typed/fixtures/pricing-family"
import {
  parsePriceNumber,
  planIsHighlighted,
  pricingFeatureTooltip,
  type PricingPlanItem,
  renderPlanCta,
  renderPlanDescription,
  renderPlanFeatureLabel,
  renderPlanTitle,
  renderPricingIntro,
  renderPricingTitle,
  slicePricingPlans,
} from "../../typed/pricing-fields"
import type { TypedVariantBaseProps } from "../../typed/props"

const MAX_PLANS = 3
const YEARLY_DISCOUNT = 20
const FEATURE_TOOLTIPS = [
  undefined,
  undefined,
  "Choose from a variety of styles to suit your preferences.",
  "Choose from a variety of filters to enhance your portraits.",
  "Use these credits to retouch your portraits.",
] as const

export type Pricing03Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  plans: PricingPlanItem[]
}

export function Pricing03({ title, intro, plans, blockIndex, editSlots, rootAttributes }: Pricing03Props) {
  const [selectedBillingPeriod, setSelectedBillingPeriod] = useState("monthly")
  const titleContent = renderPricingTitle(editSlots, title, blockIndex)
  const introContent = renderPricingIntro(editSlots, intro, blockIndex)
  const displayPlans = slicePricingPlans(plans, MAX_PLANS)

  return (
    <TooltipProvider>
      <div className="px-6 py-20" {...rootAttributes}>
        {titleContent ? (
          <h2 className="text-center font-medium text-4xl tracking-[-0.04em] sm:text-[2.75rem]">{titleContent}</h2>
        ) : null}
        {introContent ? (
          <p className="mt-3 text-center text-muted-foreground text-xl -tracking-[0.01em] md:text-2xl">{introContent}</p>
        ) : null}
        <Tabs
          className="mx-auto mt-8 max-w-max"
          onValueChange={setSelectedBillingPeriod}
          value={selectedBillingPeriod}
        >
          <TabsList className="h-11 rounded-full">
            <TabsTrigger className="rounded-full px-4 data-[state=active]:shadow-none" value="monthly">
              Monthly
            </TabsTrigger>
            <TabsTrigger className="rounded-full px-4 data-[state=active]:shadow-none" value="yearly">
              Yearly (Save {YEARLY_DISCOUNT}%)
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="mx-auto mt-12 grid max-w-(--breakpoint-lg) grid-cols-1 items-center gap-8 lg:grid-cols-3">
          {displayPlans.map((plan, planIndex) => {
            const highlighted = planIsHighlighted(plan)
            const monthlyPrice = parsePriceNumber(plan.price)
            const displayPrice = selectedBillingPeriod === "monthly"
              ? monthlyPrice
              : monthlyPrice * ((100 - YEARLY_DISCOUNT) / 100)
            const ctaContent = renderPlanCta(editSlots, plan.cta, blockIndex, planIndex)
            return (
              <div
                className={cn("relative rounded-xl border p-6", { "border-2 border-primary py-10": highlighted })}
                key={planIndex}
              >
                {highlighted ? (
                  <Badge className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2">
                    {plan.badge?.trim() || "Most Popular"}
                  </Badge>
                ) : null}
                <h3 className="font-medium text-lg">{renderPlanTitle(editSlots, plan.title, blockIndex, planIndex)}</h3>
                <p className="mt-4 font-semibold text-4xl">
                  <NumberFlow className="font-satoshi" prefix="$" value={displayPrice} />
                  <span className="ml-1.5 font-normal text-muted-foreground text-sm">/month</span>
                </p>
                {plan.description ? (
                  <p className="mt-4 text-muted-foreground text-sm">
                    {renderPlanDescription(editSlots, plan.description, blockIndex, planIndex)}
                  </p>
                ) : null}
                {ctaContent ? (
                  <Button className="mt-6 w-full" size="lg" variant={highlighted ? "default" : "outline"} asChild>
                    {ctaContent}
                  </Button>
                ) : null}
                <Separator className="my-8" />
                <ul className="space-y-2">
                  {(plan.features ?? []).map((feature, featureIndex) => {
                    const tooltip = pricingFeatureTooltip(featureIndex, FEATURE_TOOLTIPS)
                    return (
                      <li className="flex items-start gap-1.5" key={featureIndex}>
                        <CircleCheck className="mt-1 h-4 w-4 text-green-600" />
                        {renderPlanFeatureLabel(editSlots, feature.label, blockIndex, planIndex, featureIndex)}
                        {tooltip ? (
                          <Tooltip>
                            <TooltipTrigger aria-label="More information" className="cursor-help">
                              <CircleHelp className="mt-1 h-4 w-4 text-gray-500" />
                            </TooltipTrigger>
                            <TooltipContent>{tooltip}</TooltipContent>
                          </Tooltip>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </TooltipProvider>
  )
}

export default function Pricing03Literal() {
  return (
    <Pricing03
      title={pricing03FamilyCmsLike.title}
      intro={pricing03FamilyCmsLike.intro}
      plans={pricing03FamilyCmsLike.plans}
      blockIndex={0}
    />
  )
}
