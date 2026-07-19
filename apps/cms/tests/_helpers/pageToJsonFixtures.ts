import type { Page } from "@/payload-types"
import type { pageToJson } from "@/lib/projection/pageToJson"

export type JsonBlock = Record<string, unknown>
export type PageJson = ReturnType<typeof pageToJson>

/** Construct partial page docs for pageToJson without `any`. */
export function asPageSource(value: Record<string, unknown>): Page {
  return value as unknown as Page
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
