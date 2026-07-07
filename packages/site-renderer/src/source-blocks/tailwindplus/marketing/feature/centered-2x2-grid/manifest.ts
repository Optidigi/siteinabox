import type { FeatureListBlock } from "@siteinabox/contracts"
import { defineProviderBlock } from "../../../../registry"
import { TailwindPlusMarketingFeatureCentered2x2GridRenderer } from "./renderer"

export const TAILWIND_PLUS_MARKETING_FEATURE_CENTERED_2X2_GRID_NAMESPACE = "tailwindplus.marketing.feature"
export const TAILWIND_PLUS_MARKETING_FEATURE_CENTERED_2X2_GRID_ID =
  "tailwindplus.marketing.feature.centered-2x2-grid"
export const TAILWIND_PLUS_MARKETING_FEATURE_CENTERED_2X2_GRID_LEGACY_VARIANT =
  "tailwindPlusCentered2x2"

export const tailwindPlusMarketingFeatureCentered2x2GridProviderBlock = defineProviderBlock<FeatureListBlock>({
  provider: "tailwindplus",
  namespace: TAILWIND_PLUS_MARKETING_FEATURE_CENTERED_2X2_GRID_NAMESPACE,
  id: TAILWIND_PLUS_MARKETING_FEATURE_CENTERED_2X2_GRID_ID,
  blockType: "featureList",
  legacyDesignVariant: TAILWIND_PLUS_MARKETING_FEATURE_CENTERED_2X2_GRID_LEGACY_VARIANT,
  rendererClassName: "cms-block--source-tailwindplus-feature-centered-2x2-grid",
  renderer: TailwindPlusMarketingFeatureCentered2x2GridRenderer,
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
    features: {
      kind: "repeater",
      status: "required",
      exposed: true,
      sourceField: "features",
      minItems: 4,
      maxItems: 4,
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
    image: {
      kind: "image",
      status: "inactive",
      exposed: false,
      sourceField: "image",
    },
  },
  source: {
    sourceName: "Tailwind Plus",
    sourceUrl: "https://tailwindcss.com/plus/ui-blocks/marketing/sections/feature-sections",
    sourceComponent: "Marketing / Page Sections / Feature Sections / Centered 2x2 grid",
    sourceHash: "sha256:2bca54eeec9904075e3a38d66db48bd0f2b7bfaecbfc0f49e35f9b6e895719a3",
    capturedAt: "2026-07-04",
    license: "Tailwind Plus local source-backed component source; keep local snapshot out of runtime imports.",
    sourceAvailability: "free-public",
    licenseCompatibility: "compatible",
    approvalStatus: "approved",
    implementation: "exact-source",
    visualExactnessStatus: "reviewed-exact-source",
  },
})
