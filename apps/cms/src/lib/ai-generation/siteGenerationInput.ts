import type { NormalizedIntake } from "@siteinabox/contracts/generation"
import { SITE_SOURCE_BACKED_BLOCK_VARIANTS } from "@siteinabox/contracts/block-catalog"
import { SUPPORTED_SITE_GENERATION_BLOCKS } from "./prompts/siteGenerationPrompt"

export type SiteGenerationModelInput = {
  promptContract: "site-generation-spec"
  schemaVersion: 1
  intake: NormalizedIntake
  supportedBlocks: string[]
  approvedSectionVariants: Array<{
    blockType: string
    sectionVariant: string
    sourceName: string
    variantId: string
  }>
  requirements: string[]
}

export const buildSiteGenerationModelInput = (intake: NormalizedIntake): SiteGenerationModelInput => ({
  promptContract: "site-generation-spec",
  schemaVersion: 1,
  intake,
  supportedBlocks: SUPPORTED_SITE_GENERATION_BLOCKS,
  approvedSectionVariants: SITE_SOURCE_BACKED_BLOCK_VARIANTS.map((variant) => ({
    blockType: variant.slug,
    sectionVariant: variant.sectionVariant!,
    sourceName: variant.provenance.sourceName,
    variantId: variant.variantId,
  })),
  requirements: [
    "Return exactly one JSON object matching SiteGenerationSpec.",
    "Use only supportedBlocks as page blockType values and blocks[].slug values.",
    "Set analytics.sectionVariant only to null or to an approvedSectionVariants entry for that exact blockType.",
    "Do not emit raw HTML, className/classes, arbitrary Tailwind classes, component source, sourceCode, source paths, imports, or file paths.",
    "Use page slug index for the root/home page and link it as /.",
    "Include at least one page and at least one block on every page.",
    "Use draft-safe contact and SEO metadata based on the normalized intake.",
    "Set generator.name, generator.version, and generator.model.",
  ],
})
