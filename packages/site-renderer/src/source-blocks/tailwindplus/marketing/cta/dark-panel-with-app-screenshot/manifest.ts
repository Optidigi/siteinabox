import type { CTABlock } from "@siteinabox/contracts"
import { defineProviderBlock } from "../../../../registry"
import { TailwindPlusMarketingCtaDarkPanelWithAppScreenshotRenderer } from "./renderer"

export const TAILWIND_PLUS_MARKETING_CTA_DARK_PANEL_WITH_APP_SCREENSHOT_NAMESPACE = "tailwindplus.marketing.cta"
export const TAILWIND_PLUS_MARKETING_CTA_DARK_PANEL_WITH_APP_SCREENSHOT_ID =
  "tailwindplus.marketing.cta.dark-panel-with-app-screenshot"
export const TAILWIND_PLUS_MARKETING_CTA_DARK_PANEL_WITH_APP_SCREENSHOT_LEGACY_VARIANT =
  "tailwindPlusDarkPanelWithAppScreenshot"

export const tailwindPlusMarketingCtaDarkPanelWithAppScreenshotProviderBlock = defineProviderBlock<CTABlock>({
  provider: "tailwindplus",
  namespace: TAILWIND_PLUS_MARKETING_CTA_DARK_PANEL_WITH_APP_SCREENSHOT_NAMESPACE,
  id: TAILWIND_PLUS_MARKETING_CTA_DARK_PANEL_WITH_APP_SCREENSHOT_ID,
  blockType: "cta",
  legacyDesignVariant: TAILWIND_PLUS_MARKETING_CTA_DARK_PANEL_WITH_APP_SCREENSHOT_LEGACY_VARIANT,
  rendererClassName: "cms-block--source-tailwindplus-cta-dark-panel-with-app-screenshot",
  renderer: TailwindPlusMarketingCtaDarkPanelWithAppScreenshotRenderer,
  slots: {
    headline: {
      kind: "richtext",
      status: "required",
      exposed: true,
      sourceField: "headline",
    },
    description: {
      kind: "richtext",
      status: "optional",
      exposed: true,
      sourceField: "description",
    },
    primary: {
      kind: "cta",
      status: "optional",
      exposed: true,
      sourceField: "primary",
    },
    secondary: {
      kind: "cta",
      status: "optional",
      exposed: true,
      sourceField: "secondary",
    },
    backgroundImage: {
      kind: "image",
      status: "optional",
      exposed: true,
      sourceField: "backgroundImage",
    },
    eyebrow: {
      kind: "richtext",
      status: "inactive",
      exposed: false,
      sourceField: "eyebrow",
    },
  },
  source: {
    sourceName: "Tailwind Plus",
    sourceUrl: "https://tailwindcss.com/plus/ui-blocks/marketing/sections/cta-sections",
    sourceComponent: "Marketing / Page Sections / CTA Sections / Dark panel with app screenshot",
    sourceHash: "sha256:96aa545a28c9e2028183f08b5d3016412c7f23a2dbf576bc8257df2f55c03d1c",
    capturedAt: "2026-07-04",
    license: "Tailwind Plus commercial component source; keep local snapshot out of runtime imports.",
  },
})
