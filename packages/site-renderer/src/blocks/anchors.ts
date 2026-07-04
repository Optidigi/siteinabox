import type { Block } from "@siteinabox/contracts"

export type BlockAnchorResolveContext = {
  tenantRendererKey?: "amicare" | null
  surface?: "canvas" | "live"
}

function ctaIsContact(block: Extract<Block, { blockType: "cta" }>) {
  const href = block.primary?.href?.trim()
  return Boolean(href?.startsWith("mailto:") || href?.startsWith("tel:"))
}

export function resolveBlockAnchor(block: Block, context: BlockAnchorResolveContext = {}) {
  const anchor = typeof block.anchor === "string" && block.anchor.trim() ? block.anchor.trim() : undefined
  if (anchor) return anchor

  const isAmicare = context.tenantRendererKey === "amicare"

  switch (block.blockType) {
    case "hero":
      return isAmicare ? "top" : undefined
    case "featureList":
      return isAmicare ? "werkwijze" : context.surface === "canvas" ? "features" : undefined
    case "richText":
      return isAmicare ? "over" : undefined
    case "cta":
      if (ctaIsContact(block)) return "contact"
      return isAmicare ? "wat-telt" : context.surface === "canvas" ? "cta" : undefined
    default:
      return undefined
  }
}
