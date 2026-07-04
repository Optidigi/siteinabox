import * as React from "react"
import type { Block } from "@siteinabox/contracts"
import { BlogCardsBlockRenderer } from "./BlogCards"
import { CTABlockRenderer } from "./CTA"
import { ContactSectionBlockRenderer } from "./ContactSection"
import { FAQBlockRenderer } from "./FAQ"
import { FeatureListBlockRenderer } from "./FeatureList"
import { GalleryBlockRenderer } from "./Gallery"
import { HeroBlockRenderer } from "./Hero"
import { LogoCloudBlockRenderer } from "./LogoCloud"
import { PricingBlockRenderer } from "./Pricing"
import { RichTextBlockRenderer } from "./RichText"
import { StatsBlockRenderer } from "./Stats"
import { TeamBlockRenderer } from "./Team"
import { TestimonialsBlockRenderer } from "./Testimonials"
import { getSourceBackedVariantRenderer } from "../source-blocks/registry"
import type { BlockRegistry, BlockRenderOptions } from "./types"

export * from "./types"
export * from "./anchors"
export * from "./variants"

export const defaultBlockRegistry: Required<BlockRegistry> = {
  hero: HeroBlockRenderer,
  featureList: FeatureListBlockRenderer,
  testimonials: TestimonialsBlockRenderer,
  faq: FAQBlockRenderer,
  cta: CTABlockRenderer,
  richText: RichTextBlockRenderer,
  contactSection: ContactSectionBlockRenderer,
  pricing: PricingBlockRenderer,
  stats: StatsBlockRenderer,
  logoCloud: LogoCloudBlockRenderer,
  gallery: GalleryBlockRenderer,
  team: TeamBlockRenderer,
  blogCards: BlogCardsBlockRenderer,
}

export function BlockRenderer({
  block,
  index,
  registry,
  options,
}: {
  block: Block
  index: number
  registry?: BlockRegistry
  options?: Partial<Omit<BlockRenderOptions, "index">>
}) {
  const renderers = { ...defaultBlockRegistry, ...registry }
  const Renderer = getSourceBackedVariantRenderer(block) ?? renderers[block.blockType]

  if (!Renderer) {
    return (
      <section className="cms-block cms-block--unknown" data-block-index={index}>
        Unknown block type: <code>{String(block.blockType)}</code>
      </section>
    )
  }

  return <Renderer block={block} options={{ ...options, index }} />
}

export {
  BlogCardsBlockRenderer,
  CTABlockRenderer,
  ContactSectionBlockRenderer,
  FAQBlockRenderer,
  FeatureListBlockRenderer,
  GalleryBlockRenderer,
  HeroBlockRenderer,
  LogoCloudBlockRenderer,
  PricingBlockRenderer,
  RichTextBlockRenderer,
  StatsBlockRenderer,
  TeamBlockRenderer,
  TestimonialsBlockRenderer,
}
