import type { PricingBlock } from "@siteinabox/contracts"
import { defineProviderBlock } from "../../../../registry"
import { TailwindPlusMarketingPricingTwoTiersWithEmphasizedRightTierRenderer } from "./renderer"

export const TAILWIND_PLUS_MARKETING_PRICING_TWO_TIERS_WITH_EMPHASIZED_RIGHT_TIER_NAMESPACE =
  "tailwindplus.marketing.pricing"
export const TAILWIND_PLUS_MARKETING_PRICING_TWO_TIERS_WITH_EMPHASIZED_RIGHT_TIER_ID =
  "tailwindplus.marketing.pricing.two-tiers-with-emphasized-right-tier"
export const TAILWIND_PLUS_MARKETING_PRICING_TWO_TIERS_WITH_EMPHASIZED_RIGHT_TIER_LEGACY_VARIANT =
  "tailwindPlusSimpleTiers"

export const tailwindPlusMarketingPricingTwoTiersWithEmphasizedRightTierProviderBlock =
  defineProviderBlock<PricingBlock>({
    provider: "tailwindplus",
    namespace: TAILWIND_PLUS_MARKETING_PRICING_TWO_TIERS_WITH_EMPHASIZED_RIGHT_TIER_NAMESPACE,
    id: TAILWIND_PLUS_MARKETING_PRICING_TWO_TIERS_WITH_EMPHASIZED_RIGHT_TIER_ID,
    blockType: "pricing",
    legacyDesignVariant: TAILWIND_PLUS_MARKETING_PRICING_TWO_TIERS_WITH_EMPHASIZED_RIGHT_TIER_LEGACY_VARIANT,
    rendererClassName: "cms-block--source-tailwindplus-pricing-two-tiers-with-emphasized-right-tier",
    renderer: TailwindPlusMarketingPricingTwoTiersWithEmphasizedRightTierRenderer,
    slots: {
      eyebrow: { kind: "richtext", status: "optional", exposed: true, sourceField: "eyebrow" },
      title: { kind: "richtext", status: "required", exposed: true, sourceField: "title" },
      intro: { kind: "richtext", status: "optional", exposed: true, sourceField: "intro" },
      plans: {
        kind: "repeater",
        status: "required",
        exposed: true,
        sourceField: "plans",
        minItems: 2,
        maxItems: 2,
      },
      planTitle: { kind: "richtext", status: "required", exposed: true, sourceField: "plans.title" },
      planDescription: { kind: "richtext", status: "required", exposed: true, sourceField: "plans.description" },
      planPrice: { kind: "text", status: "required", exposed: true, sourceField: "plans.price" },
      planPeriod: { kind: "text", status: "optional", exposed: true, sourceField: "plans.period" },
      planCta: { kind: "cta", status: "required", exposed: true, sourceField: "plans.cta" },
      planBadge: { kind: "text", status: "inactive", exposed: false, sourceField: "plans.badge" },
      highlighted: { kind: "text", status: "optional", exposed: true, sourceField: "plans.highlighted" },
    },
    source: {
      sourceName: "Tailwind Plus",
      sourceUrl: "https://tailwindcss.com/plus/ui-blocks/marketing/sections/pricing",
      sourceComponent: "Marketing / Page Sections / Pricing Sections / Two tiers with emphasized right tier",
      sourceHash: "sha256:fe08d276628c09c8c5eaa241bb6de03da4df206c8cc9dc9c210067e263bca3b4",
      capturedAt: "2026-07-05",
      license: "Tailwind Plus commercial component source; keep local snapshot out of runtime imports.",
      sourceAvailability: "paid",
      licenseCompatibility: "unknown",
      approvalStatus: "deferred",
      implementation: "exact-source",
      visualExactnessStatus: "reviewed-exact-source",
    },
  })
