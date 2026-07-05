import type { PricingBlock } from "@siteinabox/contracts"
import type { RtBlockRoot, RtInlineRoot } from "@siteinabox/contracts/rich-text"

const inlineRt = (text: string): RtInlineRoot => ({
  t: "root",
  variant: "inline",
  children: [{ t: "text", v: text }],
})

const blockRt = (text: string): RtBlockRoot => ({
  t: "root",
  variant: "block",
  children: [{ t: "paragraph", children: [{ t: "text", v: text }] }],
})

const features = (items: string[]) =>
  items.map((label) => ({ label: inlineRt(label), included: true }))

export const tailwindPlusMarketingPricingTwoTiersWithEmphasizedRightTierDemoSlots = {
  blockType: "pricing",
  designVariant: "tailwindplus.marketing.pricing.two-tiers-with-emphasized-right-tier",
  title: inlineRt("Choose the right plan for you"),
  intro: blockRt("Choose an affordable plan that is packed with the best features for engaging your audience."),
  plans: [
    {
      title: inlineRt("Hobby"),
      price: "$29",
      period: "/month",
      description: blockRt("The perfect plan if you're just getting started with our product."),
      features: features(["25 products", "Up to 10,000 subscribers", "Advanced analytics", "24-hour support response time"]),
      cta: { label: "Get started today", href: "#" },
      highlighted: false,
    },
    {
      title: inlineRt("Enterprise"),
      price: "$99",
      period: "/month",
      description: blockRt("Dedicated support and infrastructure for your company."),
      features: features([
        "Unlimited products",
        "Unlimited subscribers",
        "Advanced analytics",
        "Dedicated support representative",
        "Marketing automations",
        "Custom integrations",
      ]),
      cta: { label: "Get started today", href: "#" },
      highlighted: true,
    },
  ],
} satisfies PricingBlock
