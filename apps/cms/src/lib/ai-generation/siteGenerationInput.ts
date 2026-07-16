import type { GenerationInput, NormalizedIntake } from "@siteinabox/contracts/generation"
import {
  SHADCNUI_BLOCK_VARIANTS,
  SHADCNUI_CHROME_VARIANTS,
} from "@siteinabox/contracts"
import { buildGenerationInput } from "@/lib/intake/normalizeIntake"
import { SUPPORTED_SITE_GENERATION_BLOCKS } from "./prompts/siteGenerationPrompt"

export type SiteGenerationModelInput = {
  promptContract: "site-generation-spec"
  schemaVersion: 1
  intake: NormalizedIntake
  generationInput: GenerationInput
  supportedBlocks: string[]
  approvedDesignVariants: Array<{
    blockType: string
    designVariant: string
    legacyDesignVariant?: string
    sourceName: string
    variantId: string
    providerVariantId?: string
    slots?: Record<string, {
      kind: string
      status: string
      exposed: boolean
    }>
  }>
  approvedChromeVariants: Array<{
    area: string
    variant: string
    sourceName: string
    variantId: string
  }>
  requirements: string[]
}

export const buildSiteGenerationModelInput = (
  intake: NormalizedIntake,
  generationInput: GenerationInput = buildGenerationInput(intake),
): SiteGenerationModelInput => ({
  promptContract: "site-generation-spec",
  schemaVersion: 1,
  intake,
  generationInput,
  supportedBlocks: SUPPORTED_SITE_GENERATION_BLOCKS,
  approvedDesignVariants: SHADCNUI_BLOCK_VARIANTS.map((variant) => ({
      blockType: variant.blockType,
      designVariant: variant.id,
      sourceName: "akash3444/shadcn-ui-blocks",
      variantId: variant.id,
      providerVariantId: variant.id,
      slots: Object.fromEntries(
        Object.entries(variant.slots)
          .map(([name, slot]) => [
            name,
            {
              kind: slot.kind,
              status: slot.status,
              exposed: slot.status !== "inactive",
              ...("minItems" in slot && slot.minItems != null ? { minItems: slot.minItems } : {}),
              ...("maxItems" in slot && slot.maxItems != null ? { maxItems: slot.maxItems } : {}),
            },
          ]),
      ),
    })),
  approvedChromeVariants: SHADCNUI_CHROME_VARIANTS.map((variant) => ({
    area: variant.area,
    variant: variant.id,
    sourceName: "akash3444/shadcn-ui-blocks",
    variantId: variant.id,
  })),
  requirements: [
    "Return exactly one JSON object matching SiteGenerationSpec.",
    "Use only supportedBlocks as page blockType values and blocks[].slug values.",
    "Set every generated block's designVariant to an approvedDesignVariants designVariant entry for that exact blockType; legacyDesignVariant is accepted only for existing stored data.",
    "Fill only exposed slots from the selected approvedDesignVariants slot manifest; do not include inactive slots.",
    "Do not set legacy page-block visual identity fields; designVariant is the only page-block visual identity field.",
    "Set settings.chrome.header.variant, settings.chrome.footer.variant, and settings.chrome.banner.variant only to null or to approvedChromeVariants values for the matching area.",
    "Set theme only to approved ThemeTokenSpec V3 preset IDs: colors blue-professional/red-confident/emerald-calm/amber-warm; fonts clear-modern/classic-editorial/friendly-organic; shape rounded/soft/sharp; mode light/dark/system.",
    "Map intake visual preferences to the nearest approved theme preset and use defaults when the intake is unclear.",
    "Never use tenant-exclusive tenant renderer variants, chrome variants, classes, content fixtures, domains, or variants for self-serve generated sites.",
    "Do not emit raw HTML, className/classes, arbitrary Tailwind classes, component source, sourceCode, source paths, imports, file paths, block tokens, style objects, or inline styles.",
    "Use CMS media ids when known. Otherwise use null or structured generated-asset placeholders without requiring remote URL ingestion.",
    "Use page slug index for the root/home page and link it as /.",
    "Include at least one page and at least one block on every page.",
    "Use draft-safe contact and SEO metadata based on the normalized intake.",
    "Set generator.name, generator.version, and generator.model.",
  ],
})
