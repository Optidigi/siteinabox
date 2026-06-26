import {
  SITE_GENERATION_BLOCK_CATALOG_BY_SLUG,
  SITE_GENERATION_BLOCK_SLUGS,
  type AnalyticsBlockMetadata,
  type SiteBlockCatalogVariant,
  type SiteGenerationBlockSlug,
} from "@siteinabox/contracts"

type VariantResolvedBlock = {
  blockType: string
  variant?: string | null
  analytics?: AnalyticsBlockMetadata | null
}

type ResolvedBlockVariant = {
  variant?: string
  rendererClassName?: string
}

const generationBlockSlugs = new Set<string>(SITE_GENERATION_BLOCK_SLUGS)

function cleanVariant(value: string | null | undefined) {
  const variant = value?.trim()
  return variant ? variant : undefined
}

function isGenerationBlockSlug(blockType: string): blockType is SiteGenerationBlockSlug {
  return generationBlockSlugs.has(blockType)
}

export function resolveBlockVariant(block: VariantResolvedBlock): ResolvedBlockVariant {
  if (!isGenerationBlockSlug(block.blockType)) return {}

  const catalogEntry = SITE_GENERATION_BLOCK_CATALOG_BY_SLUG[block.blockType]
  const requestedVariant = cleanVariant(block.variant)
  if (requestedVariant) {
    const catalogVariant = (catalogEntry.variants as readonly SiteBlockCatalogVariant[]).find(
      (variant) => variant.variant === requestedVariant,
    )
    if (!catalogVariant) return {}
    return {
      variant: catalogVariant.variant,
      rendererClassName: catalogVariant?.rendererClassName,
    }
  }

  const legacySectionVariant = cleanVariant(block.analytics?.sectionVariant)
  if (!legacySectionVariant) return {}

  const catalogVariant = (catalogEntry.variants as readonly SiteBlockCatalogVariant[]).find(
    (variant) => variant.sectionVariant === legacySectionVariant,
  )
  return {
    variant: catalogVariant?.variant,
    rendererClassName: catalogVariant?.rendererClassName,
  }
}

export function rendererVariantClassName(block: VariantResolvedBlock) {
  return resolveBlockVariant(block).rendererClassName ?? ""
}

export function runtimeVariantDataAttribute(block: VariantResolvedBlock) {
  return resolveBlockVariant(block).variant
}
