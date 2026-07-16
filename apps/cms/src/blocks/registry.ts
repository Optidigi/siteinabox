import { Hero } from "./Hero"
import { FeatureList } from "./FeatureList"
import { Testimonials } from "./Testimonials"
import { FAQ } from "./FAQ"
import { CTA } from "./CTA"
import { RichText } from "./RichText"
import { ContactSection } from "./ContactSection"
import {
  BentoGrid,
  BlogCards,
  ContentSection,
  ContactDetails,
  Gallery,
  LogoCloud,
  Newsletter,
  Pricing,
  Stats,
  Team,
  Timeline,
} from "./MarketingCatalog"
import type { BlockWithMeta } from "./_summary"
import { SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS } from "@siteinabox/contracts/block-catalog"

export const ALL_BLOCKS = [
  Hero,
  FeatureList,
  Testimonials,
  FAQ,
  CTA,
  RichText,
  ContactSection,
  ContactDetails,
  Pricing,
  Stats,
  LogoCloud,
  Gallery,
  Team,
  Newsletter,
  BentoGrid,
  ContentSection,
  Timeline,
  BlogCards,
] as const

const activeSourceBackedBlockSlugs = new Set<string>(
  SITE_SELF_SERVE_SOURCE_BACKED_BLOCK_VARIANTS.map((variant) => variant.slug),
)

export const BLOCKS = ALL_BLOCKS.filter((block) => activeSourceBackedBlockSlugs.has(block.slug)) as BlockWithMeta[]

export const blockBySlug = Object.fromEntries(ALL_BLOCKS.map((b) => [b.slug, b])) as Record<string, BlockWithMeta>

export function resolveAllowedBlocks(
  registry: readonly BlockWithMeta[],
  declared: { slug: string }[] | undefined,
): BlockWithMeta[] {
  if (!declared || declared.length === 0) return [...registry]
  const bySlug = new Map(registry.map((b) => [b.slug, b]))
  const out: BlockWithMeta[] = []
  for (const d of declared) {
    const block = bySlug.get(d.slug)
    if (!block) {
      console.warn(`[resolveAllowedBlocks] manifest declares unknown block slug: ${d.slug}; skipping`)
      continue
    }
    out.push(block)
  }
  return out
}
