import * as React from "react"
import type { Block } from "@siteinabox/contracts"
import { BlogCardsBlockRenderer } from "./BlogCards"
import { CTABlockRenderer } from "./CTA"
import { ComparisonBlockRenderer } from "./Comparison"
import { ContactSectionBlockRenderer } from "./ContactSection"
import { FAQBlockRenderer } from "./FAQ"
import { FeatureListBlockRenderer } from "./FeatureList"
import { GalleryBlockRenderer } from "./Gallery"
import { HeroBlockRenderer } from "./Hero"
import { LogoCloudBlockRenderer } from "./LogoCloud"
import { PricingBlockRenderer } from "./Pricing"
import { ProcessStepsBlockRenderer } from "./ProcessSteps"
import { RichTextBlockRenderer } from "./RichText"
import { StatsBlockRenderer } from "./Stats"
import { TeamBlockRenderer } from "./Team"
import { TestimonialsBlockRenderer } from "./Testimonials"
import type { BlockRegistry, BlockRenderOptions } from "./types"

export * from "./types"

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
  processSteps: ProcessStepsBlockRenderer,
  comparison: ComparisonBlockRenderer,
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
  const Renderer = renderers[block.blockType]

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
  ComparisonBlockRenderer,
  ContactSectionBlockRenderer,
  FAQBlockRenderer,
  FeatureListBlockRenderer,
  GalleryBlockRenderer,
  HeroBlockRenderer,
  LogoCloudBlockRenderer,
  PricingBlockRenderer,
  ProcessStepsBlockRenderer,
  RichTextBlockRenderer,
  StatsBlockRenderer,
  TeamBlockRenderer,
  TestimonialsBlockRenderer,
}
