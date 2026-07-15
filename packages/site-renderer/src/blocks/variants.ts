import {
  SITE_BLOCK_CATALOG_BY_SLUG,
  SITE_BLOCK_SLUGS,
  type SiteBlockCatalogVariant,
  type SiteBlockSlug,
} from "@siteinabox/contracts"

type VariantResolvedBlock = {
  blockType: string
  designVariant?: string | null
}

type ResolvedBlockVariant = {
  variant?: string
  rendererClassName?: string
}

export type BlockVariantResolveContext = {
  tenantRendererKey?: "amicare" | null
  tenantSlug?: string | null
}

const blockSlugs = new Set<string>(SITE_BLOCK_SLUGS)

function cleanVariant(value: string | null | undefined) {
  const variant = value?.trim()
  return variant ? variant : undefined
}

function isBlockSlug(blockType: string): blockType is SiteBlockSlug {
  return blockSlugs.has(blockType)
}

function isGenericRendererVariant(variant: SiteBlockCatalogVariant) {
  if (variant.rendererSupportStatus !== "supported") return false
  if (variant.scope.kind !== "global") return false

  const sourceName = variant.provenance.sourceName.toLowerCase()
  return sourceName === "akash3444/shadcn-ui-blocks"
}

function isTenantExclusiveRendererVariantAllowed(variant: SiteBlockCatalogVariant, context: BlockVariantResolveContext) {
  if (variant.rendererSupportStatus !== "supported") return false
  if (variant.scope.kind !== "tenant-exclusive") return false

  const tenantSlug = context.tenantSlug?.trim()
  return (
    context.tenantRendererKey === "amicare" ||
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
  if (!isBlockSlug(block.blockType)) return {}

  const catalogEntry = SITE_BLOCK_CATALOG_BY_SLUG[block.blockType]
  const requestedVariant = cleanVariant(block.designVariant)
  if (requestedVariant) {
    const catalogVariant = (catalogEntry.variants as readonly SiteBlockCatalogVariant[]).find(
      (variant) => variant.variant === requestedVariant || variant.providerVariantId === requestedVariant,
    )
    if (!catalogVariant) return {}
    if (!isRendererVariantAllowed(catalogVariant, context)) return {}
    return {
      variant: catalogVariant.providerVariantId ?? catalogVariant.variant,
      rendererClassName: catalogVariant?.rendererClassName,
    }
  }
  return {}
}

export function rendererVariantClassName(block: VariantResolvedBlock, context?: BlockVariantResolveContext) {
  return resolveBlockVariant(block, context).rendererClassName ?? ""
}

export function runtimeVariantDataAttribute(block: VariantResolvedBlock, context?: BlockVariantResolveContext) {
  return resolveBlockVariant(block, context).variant
}
