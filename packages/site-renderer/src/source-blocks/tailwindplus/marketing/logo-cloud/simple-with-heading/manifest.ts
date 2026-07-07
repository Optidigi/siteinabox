import type { LogoCloudBlock } from "@siteinabox/contracts"
import { defineProviderBlock } from "../../../../registry"
import { TailwindPlusMarketingLogoCloudSimpleWithHeadingRenderer } from "./renderer"

export const TAILWIND_PLUS_MARKETING_LOGO_CLOUD_SIMPLE_WITH_HEADING_NAMESPACE = "tailwindplus.marketing.logo-cloud"
export const TAILWIND_PLUS_MARKETING_LOGO_CLOUD_SIMPLE_WITH_HEADING_ID = "tailwindplus.marketing.logo-cloud.simple-with-heading"
export const TAILWIND_PLUS_MARKETING_LOGO_CLOUD_SIMPLE_WITH_HEADING_LEGACY_VARIANT = "tailwindPlusSimpleWithHeading"

export const tailwindPlusMarketingLogoCloudSimpleWithHeadingProviderBlock = defineProviderBlock<LogoCloudBlock>({
  provider: "tailwindplus",
  namespace: TAILWIND_PLUS_MARKETING_LOGO_CLOUD_SIMPLE_WITH_HEADING_NAMESPACE,
  id: TAILWIND_PLUS_MARKETING_LOGO_CLOUD_SIMPLE_WITH_HEADING_ID,
  blockType: "logoCloud",
  legacyDesignVariant: TAILWIND_PLUS_MARKETING_LOGO_CLOUD_SIMPLE_WITH_HEADING_LEGACY_VARIANT,
  rendererClassName: "cms-block--source-tailwindplus-logo-cloud-simple-with-heading",
  renderer: TailwindPlusMarketingLogoCloudSimpleWithHeadingRenderer,
  slots: {
    title: {
      kind: "richtext",
      status: "required",
      exposed: true,
      sourceField: "title",
    },
    logos: {
      kind: "repeater",
      status: "required",
      exposed: true,
      sourceField: "logos",
      minItems: 5,
      maxItems: 5,
    },
    logoImage: {
      kind: "image",
      status: "optional",
      exposed: true,
      sourceField: "logos.image",
    },
    logoName: {
      kind: "text",
      status: "required",
      exposed: true,
      sourceField: "logos.name",
    },
    logoHref: {
      kind: "text",
      status: "optional",
      exposed: true,
      sourceField: "logos.href",
    },
    intro: {
      kind: "richtext",
      status: "inactive",
      exposed: false,
      sourceField: "intro",
    },
  },
  source: {
    sourceName: "Tailwind Plus",
    sourceUrl: "https://tailwindcss.com/plus/ui-blocks/marketing/sections/logo-clouds",
    sourceComponent: "Marketing / Page Sections / Logo Clouds / Simple with heading",
    sourceHash: "sha256:329f4f78f6433ca02a71366c95f0f6b682a28fb71082a9d8d5441efba3efa383",
    capturedAt: "2026-07-04",
    license: "Tailwind Plus commercial component source; keep local snapshot out of runtime imports.",
    sourceAvailability: "paid",
    licenseCompatibility: "unknown",
    approvalStatus: "deferred",
    implementation: "exact-source",
    visualExactnessStatus: "reviewed-exact-source",
  },
})
