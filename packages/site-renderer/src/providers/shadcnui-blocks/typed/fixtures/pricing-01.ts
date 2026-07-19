import type { LinkRef } from "@siteinabox/contracts"
import { previewInlineText } from "../fixtures"
import type { PricingPlanItem } from "../pricing-fields"

const planCta = (label: string): LinkRef => ({ label, href: "#" })

export const pricingPlan = (
  title: string,
  price: string,
  description: string,
  features: string[],
  cta: LinkRef,
  options?: { highlighted?: boolean; badge?: string },
): PricingPlanItem => ({
  title: previewInlineText(title),
  description: previewInlineText(description),
  price,
  features: features.map((label) => ({ label: previewInlineText(label), included: true })),
  cta,
  highlighted: options?.highlighted ?? false,
  badge: options?.badge ?? null,
})

export const pricing01Literal = {
  title: previewInlineText("Our Plans"),
  intro: previewInlineText("Choose the plan that fits your needs"),
  plans: [
    pricingPlan(
      "Starter",
      "19",
      "Get 20 AI-generated portraits with 2 unique styles and filters.",
      [
        "5 hours turnaround time",
        "20 AI portraits",
        "Choice of 2 styles",
        "Choice of 2 filters",
        "2 retouch credits",
      ],
      planCta("Get 20 portraits in 5 hours"),
    ),
    pricingPlan(
      "Advanced",
      "29",
      "Get 50 AI-generated portraits with 5 unique styles and filters.",
      [
        "3 hours turnaround time",
        "50 AI portraits",
        "Choice of 5 styles",
        "Choice of 5 filters",
        "5 retouch credits",
      ],
      planCta("Get 50 portraits in 3 hours"),
      { highlighted: true },
    ),
    pricingPlan(
      "Premium",
      "49",
      "Get 100 AI-generated portraits with 10 unique styles and filters.",
      [
        "1-hour turnaround time",
        "100 AI portraits",
        "Choice of 10 styles",
        "Choice of 10 filters",
        "10 retouch credits",
      ],
      planCta("Get 100 portraits in 1 hour"),
    ),
  ],
}

export const pricing01CmsLike = {
  title: pricing01Literal.title,
  intro: pricing01Literal.intro,
  plans: pricing01Literal.plans.slice(0, 2),
}

export const pricing01Sparse = {
  plans: [pricing01Literal.plans[0]],
}

export const pricing01Long = {
  title: previewInlineText("A".repeat(500)),
  intro: previewInlineText("B".repeat(500)),
  plans: [
    pricingPlan("C".repeat(200), "9".repeat(20), "D".repeat(500), ["E".repeat(500)], planCta("F".repeat(200))),
  ],
}

export const pricing01EmptyPlans = {
  title: previewInlineText("Our Plans"),
  plans: [] as PricingPlanItem[],
}
