import { Hero } from "./Hero"
import { FeatureList } from "./FeatureList"
import { Testimonials } from "./Testimonials"
import { FAQ } from "./FAQ"
import { CTA } from "./CTA"
import { RichText } from "./RichText"
import { ContactSection } from "./ContactSection"
import { MediaHero } from "./MediaHero"
import { InfoCardList } from "./InfoCardList"
import { ServiceCarousel } from "./ServiceCarousel"
import { BeforeAfterGallery } from "./BeforeAfterGallery"
import { ContactDetails } from "./ContactDetails"
import type { BlockWithMeta } from "./_summary"

export const BLOCKS = [
  Hero,
  FeatureList,
  Testimonials,
  FAQ,
  CTA,
  RichText,
  ContactSection,
  MediaHero,
  InfoCardList,
  ServiceCarousel,
  BeforeAfterGallery,
  ContactDetails,
] as const

export const blockBySlug = Object.fromEntries(BLOCKS.map((b) => [b.slug, b])) as Record<string, BlockWithMeta>

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
