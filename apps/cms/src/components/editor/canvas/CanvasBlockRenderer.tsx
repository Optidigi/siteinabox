"use client"
import * as React from "react"
import type { RtManifest } from "@/lib/richText/manifest"
import { HeroCanvas as HeroLazy } from "@/components/editor/canvas/blocks/Hero"
import { FeatureListCanvas as FeatureListLazy } from "@/components/editor/canvas/blocks/FeatureList"
import { CTACanvas as CTALazy } from "@/components/editor/canvas/blocks/CTA"
import { RichTextCanvas as RichTextLazy } from "@/components/editor/canvas/blocks/RichText"
import { ContactSectionCanvas } from "@/components/editor/canvas/blocks/ContactSection"
import { FAQCanvas } from "@/components/editor/canvas/blocks/FAQ"
import { TestimonialsCanvas } from "@/components/editor/canvas/blocks/Testimonials"
import {
  BeforeAfterGalleryCanvas,
  BlogCardsCanvas,
  ComparisonCanvas,
  ContactDetailsCanvas,
  GalleryCanvas,
  InfoCardListCanvas,
  LogoCloudCanvas,
  MediaHeroCanvas,
  PricingCanvas,
  ProcessStepsCanvas,
  ServiceCarouselCanvas,
  StatsCanvas,
  TeamCanvas,
} from "@/components/editor/canvas/blocks/GenerationBlocks"

export interface CanvasBlockRendererProps {
  block: any
  index: number
  isActive: boolean
  manifest: RtManifest
  onActivate: () => void
  onUpdate: (next: any) => void
  legacyTenant?: "amicare" | "amblast" | null
}

/** Per-block-type dispatcher for canvas mode. Each block renderer is in
 *  `./blocks/<Name>.tsx`. Unknown block types fall back to a debug panel.
 *
 *  `block.__index` is injected here from `props.index` so the individual
 *  block renderers can derive their ElementPath blockIndex without drilling
 *  a separate prop — they read `block.__index` as the canonical block position.
 *  This is the ONLY place that sets `__index`; block renderers must NOT
 *  derive it any other way.
 */
export const CanvasBlockRenderer: React.FC<CanvasBlockRendererProps> = (props) => {
  const { block, index } = props
  // Stamp __index so block renderers can derive ElementPath without an extra prop.
  const blockWithIndex = { ...block, __index: index }
  const augmented = { ...props, block: blockWithIndex }
  switch (block?.blockType) {
    case "hero":           return <HeroLazy {...augmented} />
    case "featureList":    return <FeatureListLazy {...augmented} />
    case "cta":            return <CTALazy {...augmented} />
    case "richText":       return <RichTextLazy {...augmented} />
    case "contactSection": return <ContactSectionCanvas {...augmented} />
    case "faq":            return <FAQCanvas {...augmented} />
    case "testimonials":   return <TestimonialsCanvas {...augmented} />
    case "pricing":        return <PricingCanvas {...augmented} />
    case "stats":          return <StatsCanvas {...augmented} />
    case "logoCloud":      return <LogoCloudCanvas {...augmented} />
    case "gallery":        return <GalleryCanvas {...augmented} />
    case "team":           return <TeamCanvas {...augmented} />
    case "blogCards":      return <BlogCardsCanvas {...augmented} />
    case "processSteps":   return <ProcessStepsCanvas {...augmented} />
    case "comparison":     return <ComparisonCanvas {...augmented} />
    case "mediaHero":      return <MediaHeroCanvas {...augmented} />
    case "infoCardList":   return <InfoCardListCanvas {...augmented} />
    case "serviceCarousel": return <ServiceCarouselCanvas {...augmented} />
    case "beforeAfterGallery": return <BeforeAfterGalleryCanvas {...augmented} />
    case "contactDetails": return <ContactDetailsCanvas {...augmented} />
    default:
      return (
        <section className="cms-block cms-block--unknown rounded-md border border-destructive bg-destructive/5 p-4 text-sm text-destructive my-2">
          Unknown block type: <code>{String(block?.blockType ?? "?")}</code>
        </section>
      )
  }
}
