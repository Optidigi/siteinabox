import type { Block } from "@siteinabox/contracts"

export type BlockAnchorResolveContext = {
  surface?: "canvas" | "live"
}

function ctaIsContact(block: Extract<Block, { blockType: "cta" }>) {
  const href = block.primary?.href?.trim()
  return Boolean(href?.startsWith("mailto:") || href?.startsWith("tel:"))
}

export function resolveBlockAnchor(block: Block, context: BlockAnchorResolveContext = {}) {
  const anchor = typeof block.anchor === "string" && block.anchor.trim() ? block.anchor.trim() : undefined
  if (anchor) return anchor

  switch (block.blockType) {
    case "hero":
      return undefined
    case "featureList":
      return context.surface === "canvas" ? "features" : undefined
    case "richText":
      return undefined
    case "cta":
      if (ctaIsContact(block)) return "contact"
      return context.surface === "canvas" ? "cta" : undefined
    default:
      return undefined
  }
}
