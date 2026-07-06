import type { HeroBlock } from "@siteinabox/contracts"
import { defineProviderBlock } from "../../../../registry"
import { TailwindPlusMarketingHeroWithStatsRenderer } from "./renderer"

export const TAILWIND_PLUS_MARKETING_HERO_WITH_STATS_NAMESPACE = "tailwindplus.marketing.hero"
export const TAILWIND_PLUS_MARKETING_HERO_WITH_STATS_ID = "tailwindplus.marketing.hero.with-stats"
export const TAILWIND_PLUS_MARKETING_HERO_WITH_STATS_LEGACY_VARIANT = "tailwindPlusHeroWithStats"

export const tailwindPlusMarketingHeroWithStatsProviderBlock = defineProviderBlock<HeroBlock>({
  provider: "tailwindplus",
  namespace: TAILWIND_PLUS_MARKETING_HERO_WITH_STATS_NAMESPACE,
  id: TAILWIND_PLUS_MARKETING_HERO_WITH_STATS_ID,
  blockType: "hero",
  legacyDesignVariant: TAILWIND_PLUS_MARKETING_HERO_WITH_STATS_LEGACY_VARIANT,
  rendererClassName: "cms-block--source-tailwindplus-hero-with-stats",
  renderer: TailwindPlusMarketingHeroWithStatsRenderer,
  slots: {
    eyebrow: { kind: "richtext", status: "inactive", exposed: false, sourceField: "eyebrow" },
    headline: { kind: "richtext", status: "required", exposed: true, sourceField: "headline" },
    subheadline: { kind: "richtext", status: "required", exposed: true, sourceField: "subheadline" },
    cta: { kind: "cta", status: "inactive", exposed: false, sourceField: "cta" },
    secondary: { kind: "cta", status: "inactive", exposed: false, sourceField: "secondary" },
    links: { kind: "repeater", status: "required", exposed: true, sourceField: "links", minItems: 4, maxItems: 4 },
    linkLabel: { kind: "text", status: "required", exposed: true, sourceField: "links.label" },
    linkHref: { kind: "text", status: "required", exposed: true, sourceField: "links.href" },
    image: { kind: "image", status: "optional", exposed: true, sourceField: "image" },
    pills: { kind: "text", status: "inactive", exposed: false, sourceField: "pills" },
    stats: { kind: "repeater", status: "required", exposed: true, sourceField: "stats", minItems: 4, maxItems: 4 },
    statValue: { kind: "text", status: "required", exposed: true, sourceField: "stats.value" },
    statLabel: { kind: "text", status: "required", exposed: true, sourceField: "stats.label" },
  },
  source: {
    sourceName: "Tailwind Plus",
    sourceUrl: "https://tailwindcss.com/plus/ui-blocks/marketing/sections/header#component-813ce86310c2c337070a66a152012665",
    sourceComponent: "Marketing / Page Sections / Header Sections / With stats",
    sourceHash: "sha256:62e7fbad5325b4f47539a746a9f8ec97d316acada9b8d3e762875e55d476afcb",
    capturedAt: "2026-07-05",
    license: "Tailwind Plus public downloadable component source; keep local snapshot out of runtime imports.",
  },
})
