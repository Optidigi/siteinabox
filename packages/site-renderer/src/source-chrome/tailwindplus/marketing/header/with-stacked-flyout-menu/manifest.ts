import { defineProviderChrome } from "../../../../registry"
import { TailwindPlusMarketingHeaderWithStackedFlyoutMenuRenderer } from "./renderer"

export const TAILWIND_PLUS_MARKETING_HEADER_WITH_STACKED_FLYOUT_MENU_NAMESPACE = "tailwindplus.marketing.header"
export const TAILWIND_PLUS_MARKETING_HEADER_WITH_STACKED_FLYOUT_MENU_ID =
  "tailwindplus.marketing.header.with-stacked-flyout-menu"

export const tailwindPlusMarketingHeaderWithStackedFlyoutMenuProviderChrome = defineProviderChrome({
  provider: "tailwindplus",
  role: "chrome",
  area: "header",
  namespace: TAILWIND_PLUS_MARKETING_HEADER_WITH_STACKED_FLYOUT_MENU_NAMESPACE,
  id: TAILWIND_PLUS_MARKETING_HEADER_WITH_STACKED_FLYOUT_MENU_ID,
  rendererClassName: "site-header--source-tailwindplus-marketing-stacked-flyout",
  renderer: TailwindPlusMarketingHeaderWithStackedFlyoutMenuRenderer,
  slots: {
    brandName: {
      kind: "text",
      status: "required",
      exposed: true,
      sourceField: "siteName",
    },
    logo: {
      kind: "image",
      status: "optional",
      exposed: true,
      sourceField: "chrome.header.logo",
    },
    navLinks: {
      kind: "repeater",
      status: "optional",
      exposed: true,
      sourceField: "navHeader",
      minItems: 0,
      maxItems: 6,
    },
    primaryCta: {
      kind: "cta",
      status: "optional",
      exposed: true,
      sourceField: "chrome.header.cta",
    },
  },
  source: {
    sourceName: "Tailwind Plus",
    sourceUrl: "https://tailwindcss.com/plus/ui-blocks/marketing/elements/headers",
    sourceComponent: "Marketing / Elements / Headers / With stacked flyout menu",
    sourceHash: "sha256:adade2d97143884d5a9de578b393fd40c8f8746b3552b363bfd1559248980433",
    capturedAt: "2026-07-04",
    license: "Tailwind Plus source-visible Marketing header source; keep local snapshot out of runtime imports.",
  },
})
