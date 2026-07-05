import { defineProviderChrome } from "../../../../registry"
import { TailwindPlusMarketingBannerWithButtonRenderer } from "./renderer"

export const TAILWIND_PLUS_MARKETING_BANNER_WITH_BUTTON_NAMESPACE = "tailwindplus.marketing.banner"
export const TAILWIND_PLUS_MARKETING_BANNER_WITH_BUTTON_ID = "tailwindplus.marketing.banner.with-button"

export const tailwindPlusMarketingBannerWithButtonProviderChrome = defineProviderChrome({
  provider: "tailwindplus",
  role: "chrome",
  area: "banner",
  namespace: TAILWIND_PLUS_MARKETING_BANNER_WITH_BUTTON_NAMESPACE,
  id: TAILWIND_PLUS_MARKETING_BANNER_WITH_BUTTON_ID,
  rendererClassName: "site-banner--source-tailwindplus-marketing-with-button",
  renderer: TailwindPlusMarketingBannerWithButtonRenderer,
  slots: {
    title: { kind: "text", status: "optional", exposed: true, sourceField: "chrome.banner.title" },
    message: { kind: "text", status: "required", exposed: true, sourceField: "chrome.banner.message" },
    link: { kind: "cta", status: "optional", exposed: true, sourceField: "chrome.banner.link" },
    dismissible: { kind: "text", status: "optional", exposed: true, sourceField: "chrome.banner.dismissible" },
  },
  source: {
    sourceName: "Tailwind Plus",
    sourceUrl: "https://tailwindcss.com/plus/ui-blocks/marketing/elements/banners#component-8904b9d9a9fbb9a2313df3975112f9d7",
    sourceComponent: "Marketing / Elements / Banners / With button",
    sourceHash: "sha256:b5838b8487842359193c702041d67718e3d5e6138c49d2a2b1bdad557da18336",
    capturedAt: "2026-07-05",
    license: "Tailwind Plus public downloadable component source; keep local snapshot out of runtime imports.",
  },
})
