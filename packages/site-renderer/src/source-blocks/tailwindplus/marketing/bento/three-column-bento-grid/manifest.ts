import type { BentoGridBlock } from "@siteinabox/contracts"
import { defineProviderBlock } from "../../../../registry"
import { TailwindPlusMarketingBentoThreeColumnBentoGridRenderer } from "./renderer"

export const TAILWIND_PLUS_MARKETING_BENTO_THREE_COLUMN_BENTO_GRID_NAMESPACE = "tailwindplus.marketing.bento"
export const TAILWIND_PLUS_MARKETING_BENTO_THREE_COLUMN_BENTO_GRID_ID =
  "tailwindplus.marketing.bento.three-column-bento-grid"
export const TAILWIND_PLUS_MARKETING_BENTO_THREE_COLUMN_BENTO_GRID_LEGACY_VARIANT =
  "tailwindPlusThreeColumnBentoGrid"

export const tailwindPlusMarketingBentoThreeColumnBentoGridProviderBlock = defineProviderBlock<BentoGridBlock>({
  provider: "tailwindplus",
  namespace: TAILWIND_PLUS_MARKETING_BENTO_THREE_COLUMN_BENTO_GRID_NAMESPACE,
  id: TAILWIND_PLUS_MARKETING_BENTO_THREE_COLUMN_BENTO_GRID_ID,
  blockType: "bentoGrid",
  legacyDesignVariant: TAILWIND_PLUS_MARKETING_BENTO_THREE_COLUMN_BENTO_GRID_LEGACY_VARIANT,
  rendererClassName: "cms-block--source-tailwindplus-bento-three-column-bento-grid",
  renderer: TailwindPlusMarketingBentoThreeColumnBentoGridRenderer,
  slots: {
    title: { kind: "richtext", status: "required", exposed: true, sourceField: "title" },
    intro: { kind: "richtext", status: "required", exposed: true, sourceField: "intro" },
    items: { kind: "repeater", status: "required", exposed: true, sourceField: "items", minItems: 4, maxItems: 4 },
    itemTitle: { kind: "richtext", status: "required", exposed: true, sourceField: "items.title" },
    itemDescription: { kind: "richtext", status: "required", exposed: true, sourceField: "items.description" },
    itemImage: { kind: "image", status: "optional", exposed: true, sourceField: "items.image" },
    itemIcon: { kind: "text", status: "inactive", exposed: false, sourceField: "items.icon" },
    itemCta: { kind: "cta", status: "inactive", exposed: false, sourceField: "items.cta" },
  },
  source: {
    sourceName: "Tailwind Plus",
    sourceUrl:
      "https://tailwindcss.com/plus/ui-blocks/marketing/sections/bento-grids#component-dc65cfa183921e10d45c401610332cca",
    sourceComponent: "Marketing / Page Sections / Bento Grids / Three column bento grid",
    sourceHash: "sha256:a8a79ed6f4abec319bec1c5ce1d10acf41fb2be51135c0bee8138eb87eecebab",
    capturedAt: "2026-07-05",
    license: "Tailwind Plus public downloadable component source; keep local snapshot out of runtime imports.",
    sourceAvailability: "free-public",
    licenseCompatibility: "compatible",
    approvalStatus: "approved",
    implementation: "exact-source",
    visualExactnessStatus: "reviewed-exact-source",
  },
})
