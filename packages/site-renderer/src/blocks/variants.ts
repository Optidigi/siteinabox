import {
  getProviderBlockVariant,
  SITE_BLOCK_CATALOG_BY_SLUG,
  type SiteBlockCatalogVariant,
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

function cleanVariant(value: string | null | undefined) {
  const variant = value?.trim()
  return variant ? variant : undefined
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

export function resolveBlockVariant(
  block: VariantResolvedBlock,
  context: BlockVariantResolveContext = {},
): ResolvedBlockVariant {
  const requestedVariant = cleanVariant(block.designVariant)
  if (!requestedVariant) return {}

  const providerVariant = getProviderBlockVariant({ blockType: block.blockType as never, designVariant: requestedVariant })
  if (providerVariant) {
    return {
      variant: providerVariant.id,
      rendererClassName: `cms-block--source-shadcnui-blocks-${providerVariant.upstreamName}`,
    }
  }

  // Amicare is the sole tenant-specific renderer. Keep that compatibility
  // isolated instead of routing every generated-site block through the CMS
  // editor catalog.
  const catalogEntry = SITE_BLOCK_CATALOG_BY_SLUG[block.blockType as keyof typeof SITE_BLOCK_CATALOG_BY_SLUG]
  const tenantVariant = catalogEntry?.variants.find(
    (variant) => variant.variant === requestedVariant && variant.scope.kind === "tenant-exclusive",
  )
  if (!tenantVariant || !isTenantExclusiveRendererVariantAllowed(tenantVariant, context)) return {}
  return { variant: tenantVariant.variant, rendererClassName: tenantVariant.rendererClassName }
}

export function rendererVariantClassName(block: VariantResolvedBlock, context?: BlockVariantResolveContext) {
  return resolveBlockVariant(block, context).rendererClassName ?? ""
}

export function runtimeVariantDataAttribute(block: VariantResolvedBlock, context?: BlockVariantResolveContext) {
  return resolveBlockVariant(block, context).variant
}
