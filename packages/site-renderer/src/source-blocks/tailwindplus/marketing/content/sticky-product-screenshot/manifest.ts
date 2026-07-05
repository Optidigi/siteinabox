import type { ContentSectionBlock } from "@siteinabox/contracts"
import { defineProviderBlock } from "../../../../registry"
import { TailwindPlusMarketingContentStickyProductScreenshotRenderer } from "./renderer"

export const TAILWIND_PLUS_MARKETING_CONTENT_STICKY_PRODUCT_SCREENSHOT_NAMESPACE =
  "tailwindplus.marketing.content"
export const TAILWIND_PLUS_MARKETING_CONTENT_STICKY_PRODUCT_SCREENSHOT_ID =
  "tailwindplus.marketing.content.sticky-product-screenshot"
export const TAILWIND_PLUS_MARKETING_CONTENT_STICKY_PRODUCT_SCREENSHOT_LEGACY_VARIANT =
  "tailwindPlusContentStickyProductScreenshot"

export const tailwindPlusMarketingContentStickyProductScreenshotProviderBlock =
  defineProviderBlock<ContentSectionBlock>({
    provider: "tailwindplus",
    namespace: TAILWIND_PLUS_MARKETING_CONTENT_STICKY_PRODUCT_SCREENSHOT_NAMESPACE,
    id: TAILWIND_PLUS_MARKETING_CONTENT_STICKY_PRODUCT_SCREENSHOT_ID,
    blockType: "contentSection",
    legacyDesignVariant: TAILWIND_PLUS_MARKETING_CONTENT_STICKY_PRODUCT_SCREENSHOT_LEGACY_VARIANT,
    rendererClassName: "cms-block--source-tailwindplus-content-sticky-product-screenshot",
    renderer: TailwindPlusMarketingContentStickyProductScreenshotRenderer,
    slots: {
      eyebrow: { kind: "richtext", status: "optional", exposed: true, sourceField: "eyebrow" },
      title: { kind: "richtext", status: "required", exposed: true, sourceField: "title" },
      intro: { kind: "richtext", status: "required", exposed: true, sourceField: "intro" },
      body: { kind: "richtext", status: "required", exposed: true, sourceField: "body" },
      image: { kind: "image", status: "optional", exposed: true, sourceField: "image" },
      features: { kind: "repeater", status: "required", exposed: true, sourceField: "features", minItems: 3, maxItems: 3 },
      featureTitle: { kind: "richtext", status: "required", exposed: true, sourceField: "features.title" },
      featureDescription: { kind: "richtext", status: "required", exposed: true, sourceField: "features.description" },
      featureIcon: { kind: "text", status: "inactive", exposed: false, sourceField: "features.icon" },
      secondaryTitle: { kind: "richtext", status: "required", exposed: true, sourceField: "secondaryTitle" },
      secondaryBody: { kind: "richtext", status: "required", exposed: true, sourceField: "secondaryBody" },
      cta: { kind: "cta", status: "inactive", exposed: false, sourceField: "cta" },
    },
    source: {
      sourceName: "Tailwind Plus",
      sourceUrl:
        "https://tailwindcss.com/plus/ui-blocks/marketing/sections/content-sections#component-218027743700ff38c54be7e9c1ce3bf8",
      sourceComponent: "Marketing / Page Sections / Content Sections / With sticky product screenshot",
      sourceHash: "sha256:fbc4dbd626b016ea22b0487bb4db614046dbb1f088ec41d690ddb2e67ac924de",
      capturedAt: "2026-07-05",
      license: "Tailwind Plus public downloadable component source; keep local snapshot out of runtime imports.",
    },
  })
