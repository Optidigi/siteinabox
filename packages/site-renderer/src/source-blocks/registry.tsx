import type { Block } from "@siteinabox/contracts"
import type { BlockRendererComponent } from "../blocks/types"
import {
  TailwindPlusSimpleLogoCloud,
  TailwindPlusCentered2x2FeatureList,
  TailwindPlusNewsletterDetails,
  TailwindPlusSimplePricing,
  TailwindPlusSimpleCenteredHero,
  TailwindPlusSimpleStats,
  TailwindPlusTeamGrid,
  TailwindPlusThreeColumnBlogCards,
} from "./tailwind-plus"

type SourceBackedVariantKey = `${Block["blockType"]}:${string}`

export const sourceBackedVariantRegistry = {
  "hero:tailwindPlusSimpleCentered": TailwindPlusSimpleCenteredHero,
  "featureList:tailwindPlusCentered2x2": TailwindPlusCentered2x2FeatureList,
  "contactSection:tailwindPlusNewsletterDetails": TailwindPlusNewsletterDetails,
  "pricing:tailwindPlusSimpleTiers": TailwindPlusSimplePricing,
  "stats:tailwindPlusSimple": TailwindPlusSimpleStats,
  "logoCloud:tailwindPlusSimple": TailwindPlusSimpleLogoCloud,
  "team:tailwindPlusGrid": TailwindPlusTeamGrid,
  "blogCards:tailwindPlusThreeColumn": TailwindPlusThreeColumnBlogCards,
} satisfies Partial<Record<SourceBackedVariantKey, BlockRendererComponent<any>>>

const sourceBackedVariantRenderers: Partial<Record<SourceBackedVariantKey, BlockRendererComponent<any>>> =
  sourceBackedVariantRegistry

export function getSourceBackedVariantRenderer(block: Block) {
  const variant = block.designVariant?.trim()
  if (!variant) return null
  return sourceBackedVariantRenderers[`${block.blockType}:${variant}` as SourceBackedVariantKey] ?? null
}

export function isSourceBackedVariant(block: Block) {
  return Boolean(getSourceBackedVariantRenderer(block))
}
