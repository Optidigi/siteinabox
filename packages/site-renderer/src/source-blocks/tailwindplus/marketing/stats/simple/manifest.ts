import type { StatsBlock } from "@siteinabox/contracts"
import { defineProviderBlock } from "../../../../registry"
import { TailwindPlusMarketingStatsSimpleRenderer } from "./renderer"

export const TAILWIND_PLUS_MARKETING_STATS_SIMPLE_NAMESPACE = "tailwindplus.marketing.stats"
export const TAILWIND_PLUS_MARKETING_STATS_SIMPLE_ID = "tailwindplus.marketing.stats.simple"
export const TAILWIND_PLUS_MARKETING_STATS_SIMPLE_LEGACY_VARIANT = "tailwindPlusSimple"

export const tailwindPlusMarketingStatsSimpleProviderBlock = defineProviderBlock<StatsBlock>({
  provider: "tailwindplus",
  namespace: TAILWIND_PLUS_MARKETING_STATS_SIMPLE_NAMESPACE,
  id: TAILWIND_PLUS_MARKETING_STATS_SIMPLE_ID,
  blockType: "stats",
  legacyDesignVariant: TAILWIND_PLUS_MARKETING_STATS_SIMPLE_LEGACY_VARIANT,
  rendererClassName: "cms-block--source-tailwindplus-stats-simple",
  renderer: TailwindPlusMarketingStatsSimpleRenderer,
  slots: {
    items: {
      kind: "repeater",
      status: "required",
      exposed: true,
      sourceField: "items",
      minItems: 3,
      maxItems: 3,
    },
    itemValue: {
      kind: "text",
      status: "required",
      exposed: true,
      sourceField: "items.value",
    },
    itemLabel: {
      kind: "text",
      status: "required",
      exposed: true,
      sourceField: "items.label",
    },
    title: {
      kind: "richtext",
      status: "inactive",
      exposed: false,
      sourceField: "title",
    },
    intro: {
      kind: "richtext",
      status: "inactive",
      exposed: false,
      sourceField: "intro",
    },
    itemDescription: {
      kind: "richtext",
      status: "inactive",
      exposed: false,
      sourceField: "items.description",
    },
  },
  source: {
    sourceName: "Tailwind Plus",
    sourceUrl: "https://tailwindcss.com/plus/ui-blocks/marketing/sections/stats-sections",
    sourceComponent: "Marketing / Page Sections / Stats / Simple",
    sourceHash: "sha256:cb068ee7616fce869c7c1698ddb76b59fcc4f5996ac486f5f9d6d4cbfadc347d",
    capturedAt: "2026-07-04",
    license: "Tailwind Plus commercial component source; keep local snapshot out of runtime imports.",
  },
})
