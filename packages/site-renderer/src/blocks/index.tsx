import * as React from "react"
import type { Block } from "@siteinabox/contracts"
import { CTABlockRenderer } from "./CTA"
import { ContactSectionBlockRenderer } from "./ContactSection"
import { FAQBlockRenderer } from "./FAQ"
import { FeatureListBlockRenderer } from "./FeatureList"
import { HeroBlockRenderer } from "./Hero"
import { RichTextBlockRenderer } from "./RichText"
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
  CTABlockRenderer,
  ContactSectionBlockRenderer,
  FAQBlockRenderer,
  FeatureListBlockRenderer,
  HeroBlockRenderer,
  RichTextBlockRenderer,
  TestimonialsBlockRenderer,
}
