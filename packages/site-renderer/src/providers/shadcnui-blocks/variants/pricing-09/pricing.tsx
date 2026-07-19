// Owned typed adaptation of upstream shadcnui-blocks pricing-09 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import { Box, CircleCheck, Gem, type LucideIcon, Users } from "lucide-react"
import { Badge } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { cn } from "@siteinabox/ui/lib/utils"
import { pricing09FamilyCmsLike } from "../../typed/fixtures/pricing-family"
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
import { BorderBeam } from "./border-beam"

const MAX_PLANS = 3
const PLAN_ICONS: LucideIcon[] = [Box, Gem, Users]

const circuitBoardStyle: React.CSSProperties = {
  backgroundImage: `
        repeating-linear-gradient(0deg, transparent, transparent 19px, var(--provider-grid-line, rgba(75, 85, 99, 0.08)) 19px, var(--provider-grid-line, rgba(75, 85, 99, 0.08)) 20px, transparent 20px, transparent 39px, var(--provider-grid-line, rgba(75, 85, 99, 0.08)) 39px, var(--provider-grid-line, rgba(75, 85, 99, 0.08)) 40px),
        repeating-linear-gradient(90deg, transparent, transparent 19px, var(--provider-grid-line, rgba(75, 85, 99, 0.08)) 19px, var(--provider-grid-line, rgba(75, 85, 99, 0.08)) 20px, transparent 20px, transparent 39px, var(--provider-grid-line, rgba(75, 85, 99, 0.08)) 39px, var(--provider-grid-line, rgba(75, 85, 99, 0.08)) 40px),
        radial-gradient(circle at 20px 20px, var(--provider-grid-dot, rgba(55, 65, 81, 0.12)) 2px, transparent 2px),
        radial-gradient(circle at 40px 40px, var(--provider-grid-dot, rgba(55, 65, 81, 0.12)) 2px, transparent 2px)
      `,
  backgroundSize: "40px 40px, 40px 40px, 40px 40px, 40px 40px",
}

export type Pricing09Props = TypedVariantBaseProps & {
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
  editSlots: Pricing09Props["editSlots"]
}) {
  const highlighted = planIsHighlighted(plan)
  const Icon = planIcon(null, PLAN_ICONS, planIndex)
  const priceContent = renderPlanPrice(editSlots, plan.price, blockIndex, planIndex)
  const priceValue = parsePriceNumber(plan.price)
  const ctaContent = renderPlanCta(editSlots, plan.cta, blockIndex, planIndex)

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border bg-muted/50 p-1 dark:bg-muted/75",
        { "shadow/5": highlighted },
      )}
    >
      {highlighted ? <BorderBeam duration={8} size={150} /> : null}
      <div className="shadow/5 dark:shadow/45 relative overflow-hidden rounded-lg border bg-background px-6 pt-5 pb-4">
        {highlighted ? (
          <Badge className="absolute top-3 right-3 bg-primary/20 text-primary dark:bg-primary/30">
            {plan.badge?.trim() || "Most Popular"}
          </Badge>
        ) : null}
        {highlighted ? (
          <div
            className="pointer-events-none absolute inset-0 -top-px -left-2 z-0 not-dark:opacity-50"
            style={circuitBoardStyle}
          />
        ) : null}
        {Icon ? <Icon className="mb-5 text-primary" /> : null}
        <div className="flex items-center gap-1">
          <h3 className="font-medium text-2xl tracking-tight">
            {renderPlanTitle(editSlots, plan.title, blockIndex, planIndex)}
          </h3>
        </div>
        {plan.description ? (
          <p className="mt-1 mb-2 text-muted-foreground">
            {renderPlanDescription(editSlots, plan.description, blockIndex, planIndex)}
          </p>
        ) : null}
      </div>
      <div className="shadow/5 dark:shadow/45 mt-1 grow rounded-lg border bg-background px-6 pt-5 pb-10">
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
              <CircleCheck className="size-4 shrink-0 fill-primary/10 text-primary dark:fill-primary/15" />
              {renderPlanFeatureLabel(editSlots, feature.label, blockIndex, planIndex, featureIndex)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function Pricing09({ title, intro, plans, blockIndex, editSlots, rootAttributes }: Pricing09Props) {
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
      <div className="mt-12 grid grid-cols-1 gap-x-6 gap-y-8 overflow-clip sm:mt-16 sm:grid-cols-2 md:grid-cols-3">
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

export default function Pricing09Literal() {
  return (
    <Pricing09
      title={pricing09FamilyCmsLike.title}
      intro={pricing09FamilyCmsLike.intro}
      plans={pricing09FamilyCmsLike.plans}
      blockIndex={0}
    />
  )
}
