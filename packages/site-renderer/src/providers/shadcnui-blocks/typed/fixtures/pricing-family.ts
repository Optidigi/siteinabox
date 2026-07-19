import { previewInlineText } from "../fixtures"
import { pricing01Literal, pricingPlan } from "./pricing-01"

const planCta = (label: string) => ({ label, href: "#" })

export const pricingFamilyCmsLike = {
  title: previewInlineText("Our Plans"),
  intro: previewInlineText("Choose the plan that fits your needs"),
  plans: pricing01Literal.plans,
}

export const pricingFamilySparse = {
  plans: [pricing01Literal.plans[0]],
}

export const pricingFamilyLong = {
  title: previewInlineText("A".repeat(500)),
  intro: previewInlineText("B".repeat(500)),
  plans: [
    pricingPlan("C".repeat(200), "9".repeat(20), "D".repeat(500), ["E".repeat(500)], planCta("F".repeat(200))),
  ],
}

export const pricingFamilyEmptyPlans = {
  title: previewInlineText("Our Plans"),
  plans: [] as typeof pricing01Literal.plans,
}

export const pricing03FamilyCmsLike = {
  title: pricingFamilyCmsLike.title,
  intro: pricingFamilyCmsLike.intro,
  plans: [
    pricingPlan("Starter", "20", "Get 20 AI-generated portraits with 2 unique styles and filters.", [
      "5 hours turnaround time",
      "20 AI portraits",
      "Choice of 2 styles",
      "Choice of 2 filters",
      "2 retouch credits",
    ], planCta("Get 20 portraits in 5 hours")),
    pricingPlan("Advanced", "40", "Get 50 AI-generated portraits with 5 unique styles and filters.", [
      "3 hours turnaround time",
      "50 AI portraits",
      "Choice of 5 styles",
      "Choice of 5 filters",
      "5 retouch credits",
    ], planCta("Get 50 portraits in 3 hours"), { highlighted: true }),
    pricingPlan("Premium", "80", "Get 100 AI-generated portraits with 10 unique styles and filters.", [
      "1-hour turnaround time",
      "100 AI portraits",
      "Choice of 10 styles",
      "Choice of 10 filters",
      "10 retouch credits",
    ], planCta("Get 100 portraits in 1 hour")),
  ],
}

export const pricing07FamilyCmsLike = {
  plans: [
    pricingPlan("Basic", "0", "Perfect for individuals getting started.", [
      "1 Project",
      "Community Support",
      "Basic Analytics",
      "Limited Components",
    ], planCta("Get Started")),
    pricingPlan("Pro", "19", "Ideal for professionals who need more power.", [
      "Unlimited Projects",
      "Priority Support",
      "Advanced Analytics",
      "Access to Premium Components",
      "Custom Branding",
    ], planCta("Get Started"), { highlighted: true }),
    pricingPlan("Team", "49", "Best for growing teams and small businesses.", [
      "Everything in Pro",
      "Team Collaboration",
      "Role-based Access",
      "Usage Insights",
      "Dedicated Support",
    ], planCta("Get Started")),
  ],
}

export const pricing08FamilyCmsLike = {
  title: previewInlineText("Pricing that makes sense"),
  intro: previewInlineText("Choose a plan that fits your needs with no hidden costs"),
  plans: [
    pricingPlan("Starter", "29", "Perfect for individuals just getting started.", [
      "1 Project",
      "Basic Components",
      "Email Support",
      "Access to Updates for 6 Months",
      "Community Access",
    ], planCta("Get Started")),
    pricingPlan("Pro", "79", "Ideal for professionals who need more power.", [
      "Unlimited Projects",
      "Premium Components",
      "Priority Support",
      "Access to Updates for 1 Year",
      "Code Snippets & Templates",
    ], planCta("Get Started"), { highlighted: true }),
    pricingPlan("Team", "199", "Best for growing teams and small businesses.", [
      "Everything in Pro",
      "Team License (up to 5 users)",
      "Collaboration Features",
      "Extended Support",
      "Lifetime Updates",
    ], planCta("Get Started")),
  ],
}

export const pricing09FamilyCmsLike = {
  title: previewInlineText("Pick your plan"),
  intro: previewInlineText("Flexible pricing designed to grow with you ready"),
  plans: [
    pricingPlan("Starter", "29", "Perfect for individuals.", [
      "1 Project",
      "Basic Components",
      "Email Support",
      "Access to Updates for 6 Months",
      "Community Access",
    ], planCta("Get Started")),
    pricingPlan("Pro", "79", "Ideal for professionals.", [
      "Unlimited Projects",
      "Premium Components",
      "Priority Support",
      "Access to Updates for 1 Year",
      "Code Snippets & Templates",
    ], planCta("Get Started"), { highlighted: true }),
    pricingPlan("Team", "199", "Best for growing teams.", [
      "Everything in Pro",
      "Team License (up to 5 users)",
      "Collaboration Features",
      "Extended Support",
      "Lifetime Updates",
    ], planCta("Get Started")),
  ],
}

export const pricing10FamilyCmsLike = {
  title: previewInlineText("Plans & Pricing"),
  intro: previewInlineText("Flexible pricing designed to grow with you ready"),
  plans: pricing09FamilyCmsLike.plans.map((plan, index) => ({
    ...plan,
    title: previewInlineText(index === 0 ? "Starter" : index === 1 ? "Pro" : "Team"),
    description: previewInlineText(
      index === 0
        ? "Perfect for individuals who are just getting started."
        : index === 1
          ? "Ideal for professionals who need more power."
          : "Best for growing teams and small businesses.",
    ),
  })),
}
