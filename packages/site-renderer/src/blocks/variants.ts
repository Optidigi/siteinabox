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

export type BlockVariantResolveContext = {
  legacyTenant?: "amicare" | null
  tenantSlug?: string | null
}

const generationBlockSlugs = new Set<string>(SITE_GENERATION_BLOCK_SLUGS)

function cleanVariant(value: string | null | undefined) {
  const variant = value?.trim()
  return variant ? variant : undefined
}

function isGenerationBlockSlug(blockType: string): blockType is SiteGenerationBlockSlug {
  return generationBlockSlugs.has(blockType)
}

function isGenericRendererVariant(variant: SiteBlockCatalogVariant) {
  if (variant.rendererSupportStatus !== "supported") return false
  if (variant.scope.kind !== "global") return false

  const sourceName = variant.provenance.sourceName.toLowerCase()
  return (
    sourceName === "siab" ||
    sourceName === "tailwind plus" ||
    sourceName === "tailblocks" ||
    sourceName === "preline ui"
  )
}

function isTenantExclusiveRendererVariantAllowed(variant: SiteBlockCatalogVariant, context: BlockVariantResolveContext) {
  if (variant.rendererSupportStatus !== "supported") return false
  if (variant.scope.kind !== "tenant-exclusive") return false

  const tenantSlug = context.tenantSlug?.trim()
  return (
    context.legacyTenant === "amicare" ||
    Boolean(tenantSlug && variant.scope.tenantSlugs.includes(tenantSlug))
  )
}

function isRendererVariantAllowed(variant: SiteBlockCatalogVariant, context: BlockVariantResolveContext) {
  return isGenericRendererVariant(variant) || isTenantExclusiveRendererVariantAllowed(variant, context)
}

export function resolveBlockVariant(
  block: VariantResolvedBlock,
  context: BlockVariantResolveContext = {},
): ResolvedBlockVariant {
  if (!isGenerationBlockSlug(block.blockType)) return {}

  const catalogEntry = SITE_GENERATION_BLOCK_CATALOG_BY_SLUG[block.blockType]
  const requestedVariant = cleanVariant(block.variant)
  if (requestedVariant) {
    const catalogVariant = (catalogEntry.variants as readonly SiteBlockCatalogVariant[]).find(
      (variant) => variant.variant === requestedVariant,
    )
    if (!catalogVariant) return {}
    if (!isRendererVariantAllowed(catalogVariant, context)) return {}
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
  if (!catalogVariant || !isRendererVariantAllowed(catalogVariant, context)) return {}
  return {
    variant: catalogVariant.variant,
    rendererClassName: catalogVariant.rendererClassName,
  }
}

export function rendererVariantClassName(block: VariantResolvedBlock, context?: BlockVariantResolveContext) {
  return resolveBlockVariant(block, context).rendererClassName ?? ""
}

export function runtimeVariantDataAttribute(block: VariantResolvedBlock, context?: BlockVariantResolveContext) {
  return resolveBlockVariant(block, context).variant
}
