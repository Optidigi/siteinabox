// Owned typed adaptation of upstream shadcnui-blocks pricing-04 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import { useState } from "react"
import type { RtRoot } from "@siteinabox/contracts"
import NumberFlow from "@number-flow/react"
import { ArrowUpRight, CircleCheck, CircleHelp } from "lucide-react"
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

export type Pricing04Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  plans: PricingPlanItem[]
}

export function Pricing04({ title, intro, plans, blockIndex, editSlots, rootAttributes }: Pricing04Props) {
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
          <TabsList className="h-11 rounded-full border bg-background">
            <TabsTrigger
              className="rounded-full px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              value="monthly"
            >
              Monthly
            </TabsTrigger>
            <TabsTrigger
              className="rounded-full px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              value="yearly"
            >
              Yearly (Save {YEARLY_DISCOUNT}%)
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="mx-auto mt-12 grid max-w-(--breakpoint-lg) grid-cols-1 items-center gap-8 sm:mt-16 lg:grid-cols-3 lg:gap-0">
          {displayPlans.map((plan, planIndex) => {
            const highlighted = planIsHighlighted(plan)
            const monthlyPrice = parsePriceNumber(plan.price)
            const displayPrice = selectedBillingPeriod === "monthly"
              ? monthlyPrice
              : monthlyPrice * ((100 - YEARLY_DISCOUNT) / 100)
            const ctaContent = renderPlanCta(editSlots, plan.cta, blockIndex, planIndex, {
              trailingIcon: <ArrowUpRight className="h-4 w-4" />,
            })
            return (
              <div
                className={cn("relative rounded-lg border bg-card/50 p-6 px-8", {
                  "z-1 overflow-hidden bg-card px-10 py-14 shadow-[0px_1px_6px_0px_rgba(0,0,0,0.07)] lg:-mx-2": highlighted,
                })}
                key={planIndex}
              >
                {highlighted ? (
                  <Badge className="absolute top-2 right-2 px-2.5 py-1 uppercase">
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
                  <Button className="mt-6 w-full rounded-full text-base" size="lg" variant={highlighted ? "default" : "outline"} asChild>
                    {ctaContent}
                  </Button>
                ) : !editSlots ? (
                  <Button className="mt-6 w-full rounded-full text-base" size="lg" variant={highlighted ? "default" : "outline"}>
                    Get Started <ArrowUpRight className="h-4 w-4" />
                  </Button>
                ) : null}
                <Separator className="my-8" />
                <ul className="space-y-3">
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

export default function Pricing04Literal() {
  return (
    <Pricing04
      title={pricing03FamilyCmsLike.title}
      intro={pricing03FamilyCmsLike.intro}
      plans={pricing03FamilyCmsLike.plans}
      blockIndex={0}
    />
  )
}
