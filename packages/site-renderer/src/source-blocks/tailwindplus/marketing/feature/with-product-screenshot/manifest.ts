import type { FeatureListBlock } from "@siteinabox/contracts"
import { defineProviderBlock } from "../../../../registry"
import { TailwindPlusMarketingFeatureWithProductScreenshotRenderer } from "./renderer"

export const TAILWIND_PLUS_MARKETING_FEATURE_WITH_PRODUCT_SCREENSHOT_NAMESPACE = "tailwindplus.marketing.feature"
export const TAILWIND_PLUS_MARKETING_FEATURE_WITH_PRODUCT_SCREENSHOT_ID =
  "tailwindplus.marketing.feature.with-product-screenshot"
export const TAILWIND_PLUS_MARKETING_FEATURE_WITH_PRODUCT_SCREENSHOT_LEGACY_VARIANT =
  "tailwindPlusWithProductScreenshot"

export const tailwindPlusMarketingFeatureWithProductScreenshotProviderBlock = defineProviderBlock<FeatureListBlock>({
  provider: "tailwindplus",
  namespace: TAILWIND_PLUS_MARKETING_FEATURE_WITH_PRODUCT_SCREENSHOT_NAMESPACE,
  id: TAILWIND_PLUS_MARKETING_FEATURE_WITH_PRODUCT_SCREENSHOT_ID,
  blockType: "featureList",
  legacyDesignVariant: TAILWIND_PLUS_MARKETING_FEATURE_WITH_PRODUCT_SCREENSHOT_LEGACY_VARIANT,
  rendererClassName: "cms-block--source-tailwindplus-feature-with-product-screenshot",
  renderer: TailwindPlusMarketingFeatureWithProductScreenshotRenderer,
  slots: {
    eyebrow: {
      kind: "richtext",
      status: "optional",
      exposed: true,
      sourceField: "eyebrow",
    },
    title: {
      kind: "richtext",
      status: "required",
      exposed: true,
      sourceField: "title",
    },
    intro: {
      kind: "richtext",
      status: "optional",
      exposed: true,
      sourceField: "intro",
    },
    image: {
      kind: "image",
      status: "optional",
      exposed: true,
      sourceField: "image",
    },
    features: {
      kind: "repeater",
      status: "required",
      exposed: true,
      sourceField: "features",
      minItems: 3,
      maxItems: 3,
    },
    featureTitle: {
      kind: "richtext",
      status: "required",
      exposed: true,
      sourceField: "features.title",
    },
    featureDescription: {
      kind: "richtext",
      status: "required",
      exposed: true,
      sourceField: "features.description",
    },
    featureIcon: {
      kind: "text",
      status: "optional",
      exposed: true,
      sourceField: "features.icon",
    },
  },
  source: {
    sourceName: "Tailwind Plus",
    sourceUrl: "https://tailwindcss.com/plus/ui-blocks/marketing/sections/feature-sections",
    sourceComponent: "Marketing / Page Sections / Feature Sections / With product screenshot",
    sourceHash: "sha256:eed4856b0cdd3050c8fcb563245bcfa81af526244cfe10ecd68ad13b6b6081b8",
    capturedAt: "2026-07-04",
    license: "Tailwind Plus local source-backed component source; keep local snapshot out of runtime imports.",
    sourceAvailability: "free-public",
    licenseCompatibility: "compatible",
    approvalStatus: "approved",
    implementation: "exact-source",
    visualExactnessStatus: "reviewed-exact-source",
  },
})
