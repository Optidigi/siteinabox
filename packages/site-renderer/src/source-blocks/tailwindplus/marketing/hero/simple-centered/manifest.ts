import type { HeroBlock } from "@siteinabox/contracts"
import { defineProviderBlock } from "../../../../registry"
import { TailwindPlusMarketingHeroSimpleCenteredRenderer } from "./renderer"

export const TAILWIND_PLUS_MARKETING_HERO_SIMPLE_CENTERED_NAMESPACE = "tailwindplus.marketing.hero"
export const TAILWIND_PLUS_MARKETING_HERO_SIMPLE_CENTERED_ID = "tailwindplus.marketing.hero.simple-centered"
export const TAILWIND_PLUS_MARKETING_HERO_SIMPLE_CENTERED_LEGACY_VARIANT = "tailwindPlusSimpleCentered"

export const tailwindPlusMarketingHeroSimpleCenteredProviderBlock = defineProviderBlock<HeroBlock>({
  provider: "tailwindplus",
  namespace: TAILWIND_PLUS_MARKETING_HERO_SIMPLE_CENTERED_NAMESPACE,
  id: TAILWIND_PLUS_MARKETING_HERO_SIMPLE_CENTERED_ID,
  blockType: "hero",
  legacyDesignVariant: TAILWIND_PLUS_MARKETING_HERO_SIMPLE_CENTERED_LEGACY_VARIANT,
  rendererClassName: "cms-block--source-tailwindplus-hero-simple-centered",
  renderer: TailwindPlusMarketingHeroSimpleCenteredRenderer,
  slots: {
    eyebrow: {
      kind: "richtext",
      status: "optional",
      exposed: true,
      sourceField: "eyebrow",
    },
    headline: {
      kind: "richtext",
      status: "required",
      exposed: true,
      sourceField: "headline",
    },
    subheadline: {
      kind: "richtext",
      status: "optional",
      exposed: true,
      sourceField: "subheadline",
    },
    cta: {
      kind: "cta",
      status: "optional",
      exposed: true,
      sourceField: "cta",
    },
    secondary: {
      kind: "cta",
      status: "optional",
      exposed: true,
      sourceField: "secondary",
    },
    image: {
      kind: "image",
      status: "inactive",
      exposed: false,
      sourceField: "image",
    },
    stats: {
      kind: "repeater",
      status: "inactive",
      exposed: false,
      sourceField: "stats",
    },
    pills: {
      kind: "text",
      status: "inactive",
      exposed: false,
      sourceField: "pills",
    },
  },
  source: {
    sourceName: "Tailwind Plus",
    sourceUrl: "https://tailwindcss.com/plus/ui-blocks/marketing/sections/heroes",
    sourceComponent: "Marketing / Page Sections / Hero Sections / Simple centered",
    sourceHash: "sha256:522247eba4bf365e40f8a25ec24b27952080ca301988076d0c1148b673ed056f",
    capturedAt: "2026-07-04",
    license: "Tailwind Plus local source-backed component source; keep local snapshot out of runtime imports.",
    sourceAvailability: "free-public",
    licenseCompatibility: "compatible",
    approvalStatus: "approved",
    implementation: "exact-source",
    visualExactnessStatus: "reviewed-exact-source",
  },
})
