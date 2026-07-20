// Owned typed adaptation of upstream shadcnui-blocks pricing-02 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import { CircleCheck } from "lucide-react"
import { Badge } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { Separator } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { cn } from "@siteinabox/ui/lib/utils"
import { pricing01Literal } from "../../typed/fixtures/pricing-01"
import {
  parsePriceNumber,
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

export type Pricing02Props = TypedVariantBaseProps & {
  title?: RtRoot | null
  intro?: RtRoot | null
  plans: PricingPlanItem[]
}

export function Pricing02({ title, intro, plans, blockIndex, editSlots, rootAttributes }: Pricing02Props) {
  const titleContent = renderPricingTitle(editSlots, title, blockIndex)
  const introContent = renderPricingIntro(editSlots, intro, blockIndex)
  const displayPlans = slicePricingPlans(plans, MAX_PLANS)

  return (
    <div className="px-6 py-20" {...rootAttributes}>
      {titleContent ? (
        <h2 className="text-center font-medium text-4xl tracking-[-0.04em] sm:text-[2.75rem]">{titleContent}</h2>
      ) : null}
      {introContent ? (
        <p className="mt-3 text-center text-muted-foreground text-xl -tracking-[0.01em] md:text-2xl">{introContent}</p>
      ) : null}
      <div className="mx-auto mt-12 grid max-w-(--breakpoint-lg) grid-cols-1 items-center gap-8 sm:mt-16 lg:grid-cols-3">
        {displayPlans.map((plan, planIndex) => {
          const highlighted = planIsHighlighted(plan)
          const priceContent = renderPlanPrice(editSlots, plan.price, blockIndex, planIndex)
          const priceValue = parsePriceNumber(plan.price)
          const ctaContent = renderPlanCta(editSlots, plan.cta, blockIndex, planIndex)
          return (
            <div
              className={cn(
                "relative rounded-lg border border-border/85 bg-card p-6 shadow-xs/3",
                { "border-2 border-primary py-10": highlighted },
              )}
              key={planIndex}
            >
              {highlighted ? (
                <Badge className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2">
                  {plan.badge?.trim() || "Most Popular"}
                </Badge>
              ) : null}
              <h3 className="font-medium text-lg">{renderPlanTitle(editSlots, plan.title, blockIndex, planIndex)}</h3>
              <p className="mt-2 font-satoshi font-semibold text-4xl">
                {priceContent ?? (priceValue ? `$${priceValue}` : null)}
              </p>
              {plan.description ? (
                <p className="mt-4 font-medium text-muted-foreground">
                  {renderPlanDescription(editSlots, plan.description, blockIndex, planIndex)}
                </p>
              ) : null}
              <Separator className="my-4" />
              <ul className="space-y-2">
                {(plan.features ?? []).map((feature, featureIndex) => (
                  <li className="flex items-start gap-2" key={featureIndex}>
                    <CircleCheck className="mt-1 h-4 w-4 text-green-600" />
                    {renderPlanFeatureLabel(editSlots, feature.label, blockIndex, planIndex, featureIndex)}
                  </li>
                ))}
              </ul>
              {ctaContent ? (
                <Button className="mt-6 w-full" size="lg" variant={highlighted ? "default" : "outline"} asChild>
                  {ctaContent}
                </Button>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Pricing02Literal() {
  return (
    <Pricing02
      title={pricing01Literal.title}
      intro={pricing01Literal.intro}
      plans={pricing01Literal.plans}
      blockIndex={0}
    />
  )
}
