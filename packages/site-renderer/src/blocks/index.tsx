import * as React from "react"
import type { Block } from "@siteinabox/contracts"
import { BeforeAfterGalleryBlockRenderer } from "./BeforeAfterGallery"
import { CTABlockRenderer } from "./CTA"
import { ContactSectionBlockRenderer } from "./ContactSection"
import { ContactDetailsBlockRenderer } from "./ContactDetails"
import { FAQBlockRenderer } from "./FAQ"
import { FeatureListBlockRenderer } from "./FeatureList"
import { HeroBlockRenderer } from "./Hero"
import { InfoCardListBlockRenderer } from "./InfoCardList"
import { MediaHeroBlockRenderer } from "./MediaHero"
import { RichTextBlockRenderer } from "./RichText"
import { ServiceCarouselBlockRenderer } from "./ServiceCarousel"
import { TestimonialsBlockRenderer } from "./Testimonials"
import type { BlockRegistry, BlockRenderOptions } from "./types"

export * from "./types"

export const defaultBlockRegistry: Required<BlockRegistry> = {
  hero: HeroBlockRenderer,
  mediaHero: MediaHeroBlockRenderer,
  featureList: FeatureListBlockRenderer,
  infoCardList: InfoCardListBlockRenderer,
  serviceCarousel: ServiceCarouselBlockRenderer,
  beforeAfterGallery: BeforeAfterGalleryBlockRenderer,
  contactDetails: ContactDetailsBlockRenderer,
  testimonials: TestimonialsBlockRenderer,
  faq: FAQBlockRenderer,
  cta: CTABlockRenderer,
  richText: RichTextBlockRenderer,
  contactSection: ContactSectionBlockRenderer,
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
  BeforeAfterGalleryBlockRenderer,
  CTABlockRenderer,
  ContactSectionBlockRenderer,
  ContactDetailsBlockRenderer,
  FAQBlockRenderer,
  FeatureListBlockRenderer,
  HeroBlockRenderer,
  InfoCardListBlockRenderer,
  MediaHeroBlockRenderer,
  RichTextBlockRenderer,
  ServiceCarouselBlockRenderer,
  TestimonialsBlockRenderer,
}
