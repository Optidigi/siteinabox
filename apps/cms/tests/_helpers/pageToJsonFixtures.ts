import type { pageToJson } from "@/lib/projection/pageToJson"

export type JsonBlock = Record<string, unknown>
export type PageJson = ReturnType<typeof pageToJson>

/** The projector explicitly accepts raw record sources as well as generated pages. */
export function asPageSource(value: Record<string, unknown>): Parameters<typeof pageToJson>[0] {
  return value
}

export function jsonBlocks(json: PageJson): JsonBlock[] {
  const blocks = json.blocks
  return Array.isArray(blocks) ? (blocks as JsonBlock[]) : []
}

export function jsonBlockAt(json: PageJson, index: number): JsonBlock {
  const block = jsonBlocks(json)[index]
  if (!block) throw new Error(`Expected json.blocks[${index}]`)
  return block
}
