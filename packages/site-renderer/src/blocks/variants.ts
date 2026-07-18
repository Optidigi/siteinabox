import {
  getProviderBlockVariant,
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
  tenantSlug?: string | null
}

function cleanVariant(value: string | null | undefined) {
  const variant = value?.trim()
  return variant ? variant : undefined
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

  return {}
}

export function rendererVariantClassName(block: VariantResolvedBlock, context?: BlockVariantResolveContext) {
  return resolveBlockVariant(block, context).rendererClassName ?? ""
}

export function runtimeVariantDataAttribute(block: VariantResolvedBlock, context?: BlockVariantResolveContext) {
  return resolveBlockVariant(block, context).variant
}
