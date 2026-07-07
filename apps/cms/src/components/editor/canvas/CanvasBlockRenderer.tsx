"use client"
import * as React from "react"
import {
  SITE_GENERATION_BLOCK_CATALOG_BY_SLUG,
  SITE_GENERATION_BLOCK_SLUGS,
  type SiteBlockCatalogVariant,
  type SiteGenerationBlockSlug,
} from "@siteinabox/contracts"
import { getSourceBackedVariantRenderer, isProviderVariantIdentifier, resolveBlockVariant } from "@siteinabox/site-renderer"
import type { RtManifest } from "@/lib/richText/manifest"
import { HeroCanvas as HeroLazy } from "@/components/editor/canvas/blocks/Hero"
import { FeatureListCanvas as FeatureListLazy } from "@/components/editor/canvas/blocks/FeatureList"
import { CTACanvas as CTALazy } from "@/components/editor/canvas/blocks/CTA"
import { RichTextCanvas as RichTextLazy } from "@/components/editor/canvas/blocks/RichText"
import { ContactSectionCanvas } from "@/components/editor/canvas/blocks/ContactSection"
import { FAQCanvas } from "@/components/editor/canvas/blocks/FAQ"
import { TestimonialsCanvas } from "@/components/editor/canvas/blocks/Testimonials"
import { AmicareCanvasBlockRenderer } from "@/components/editor/canvas/AmicareCanvasBlockRenderer"
import { RendererCanvasBlockRenderer } from "@/components/editor/canvas/RendererCanvasBlockRenderer"
import {
  BentoGridCanvas,
  BlogCardsCanvas,
  ContentSectionCanvas,
  GalleryCanvas,
  LogoCloudCanvas,
  NewsletterCanvas,
  PricingCanvas,
  StatsCanvas,
  TeamCanvas,
} from "@/components/editor/canvas/blocks/GenerationBlocks"
import { cn } from "@siteinabox/ui/lib/utils"

type DataAttributes = {
  [key: `data-${string}`]: string | number | boolean | undefined
}

type CanvasSectionBaseProps = React.ComponentPropsWithoutRef<"section"> & DataAttributes

export type CanvasSectionChromeProps = React.ComponentPropsWithRef<"section"> & DataAttributes

type SourceVariantContext = {
  tenantRendererKey?: "amicare" | null
}

const generationBlockSlugs = new Set<string>(SITE_GENERATION_BLOCK_SLUGS)

export interface CanvasBlockRendererProps {
  block: any
  index: number
  isActive: boolean
  manifest: RtManifest
  onActivate: () => void
  onUpdate: (next: any) => void
  tenantId?: number | string | null
  tenantRendererKey?: "amicare" | null
  sectionChromeProps?: CanvasSectionChromeProps
}

function mergeSyntheticEventHandlers<Event extends React.SyntheticEvent>(
  base?: (event: Event) => void,
  chrome?: (event: Event) => void,
) {
  if (!base) return chrome
  if (!chrome) return base
  return (event: Event) => {
    base(event)
    chrome(event)
  }
}

function mergeClickHandler(
  base?: React.MouseEventHandler<HTMLElement>,
  chrome?: React.MouseEventHandler<HTMLElement>,
) {
  return chrome ?? base
}

export function mergeCanvasSectionProps(
  baseProps: CanvasSectionBaseProps,
  chromeProps?: CanvasSectionChromeProps,
): CanvasSectionChromeProps {
  if (!chromeProps) return baseProps

  const {
    className: baseClassName,
    onClick: baseOnClick,
    onMouseEnter: baseOnMouseEnter,
    onMouseLeave: baseOnMouseLeave,
    onFocusCapture: baseOnFocusCapture,
    onBlurCapture: baseOnBlurCapture,
    ...baseRest
  } = baseProps
  const {
    className: chromeClassName,
    onClick: chromeOnClick,
    onMouseEnter: chromeOnMouseEnter,
    onMouseLeave: chromeOnMouseLeave,
    onFocusCapture: chromeOnFocusCapture,
    onBlurCapture: chromeOnBlurCapture,
    ...chromeRest
  } = chromeProps

  return {
    ...chromeRest,
    ...baseRest,
    className: cn(baseClassName, chromeClassName),
    onClick: mergeClickHandler(baseOnClick, chromeOnClick),
    onMouseEnter: mergeSyntheticEventHandlers(baseOnMouseEnter, chromeOnMouseEnter),
    onMouseLeave: mergeSyntheticEventHandlers(baseOnMouseLeave, chromeOnMouseLeave),
    onFocusCapture: mergeSyntheticEventHandlers(baseOnFocusCapture, chromeOnFocusCapture),
    onBlurCapture: mergeSyntheticEventHandlers(baseOnBlurCapture, chromeOnBlurCapture),
  }
}

export function resolvedCanvasSourceVariant(block: any, context: SourceVariantContext = {}): SiteBlockCatalogVariant | undefined {
  if (!generationBlockSlugs.has(block?.blockType)) return undefined
  if (isProviderVariantIdentifier(block?.designVariant) && !getSourceBackedVariantRenderer(block)) return undefined
  const catalog = SITE_GENERATION_BLOCK_CATALOG_BY_SLUG[block.blockType as SiteGenerationBlockSlug]
  const resolved = resolveBlockVariant(block, context)
  if (!resolved.variant) return undefined
  const entry = (catalog.variants as readonly SiteBlockCatalogVariant[]).find((candidate) =>
    candidate.variant === resolved.variant || candidate.providerVariantId === resolved.variant
  )
  return entry ? { ...entry, variant: resolved.variant } : undefined
}

export function canvasSourceVariantDataAttribute(block: any, tenantRendererKey?: "amicare" | null) {
  return resolveBlockVariant(block, { tenantRendererKey }).variant
}

export function canvasSourceVariantClassName(
  block: any,
  tenantRendererKey?: "amicare" | null,
  options: { rendererDom?: "native" | "canvas-fallback" } = {},
) {
  if (options.rendererDom === "canvas-fallback") return ""
  return resolveBlockVariant(block, { tenantRendererKey }).rendererClassName ?? ""
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
  if (
    isProviderVariantIdentifier(block?.designVariant) &&
    !getSourceBackedVariantRenderer(blockWithIndex)
  ) {
    const providerErrorSectionProps = mergeCanvasSectionProps(
      {
        className: "cms-block cms-block--provider-error rounded-md border border-destructive bg-destructive/5 p-4 text-sm text-destructive my-2",
        "data-block-index": index,
        "data-active": props.isActive || undefined,
        "data-source-variant": block?.designVariant,
        "data-provider-error": "unresolved",
        onClick: props.onActivate,
      },
      props.sectionChromeProps,
    )

    return (
      <section {...providerErrorSectionProps}>
        Unresolved provider block variant: <code>{String(block?.designVariant ?? "?")}</code>
      </section>
    )
  }

  if (getSourceBackedVariantRenderer(blockWithIndex)) {
    return <RendererCanvasBlockRenderer {...augmented} />
  }

  if (
    props.tenantRendererKey === "amicare" &&
    (
      block?.blockType === "hero" ||
      block?.blockType === "featureList" ||
      block?.blockType === "richText" ||
      block?.blockType === "cta" ||
      block?.blockType === "testimonials" ||
      block?.blockType === "faq" ||
      block?.blockType === "contactSection"
    )
  ) {
    return <AmicareCanvasBlockRenderer {...augmented} />
  }
  if (
    props.tenantRendererKey !== "amicare" &&
    (block?.blockType === "hero" || block?.blockType === "featureList" || block?.blockType === "richText" || block?.blockType === "cta")
  ) {
    return <RendererCanvasBlockRenderer {...augmented} />
  }
  const unknownSectionProps = mergeCanvasSectionProps(
    {
      className: "cms-block cms-block--unknown rounded-md border border-destructive bg-destructive/5 p-4 text-sm text-destructive my-2",
      "data-block-index": index,
      "data-active": props.isActive || undefined,
      onClick: props.onActivate,
    },
    props.sectionChromeProps,
  )

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
    case "newsletter":     return <NewsletterCanvas {...augmented} />
    case "bentoGrid":      return <BentoGridCanvas {...augmented} />
    case "contentSection": return <ContentSectionCanvas {...augmented} />
    case "team":           return <TeamCanvas {...augmented} />
    case "blogCards":      return <BlogCardsCanvas {...augmented} />
    default:
      return (
        <section {...unknownSectionProps}>
          Unknown block type: <code>{String(block?.blockType ?? "?")}</code>
        </section>
      )
  }
}
