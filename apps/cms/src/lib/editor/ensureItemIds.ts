import {
  BLOCK_TOP_LEVEL_ARRAYS,
  NESTED_ARRAY_FIELDS,
} from "@/lib/editor/blockArrayFields"
import { ensureBlockId, ensurePageBlockIds } from "@/lib/editor/ensureBlockIds"
import type { EditorBlock } from "@/lib/editor/editorBlock"

export function itemWireId(item: Record<string, unknown>): string | null {
  const raw = item.id
  if (typeof raw === "string" && raw.trim()) return raw.trim()
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw)
  return null
}

export function ensureItemId(item: Record<string, unknown>, remint = false): string {
  if (!remint) {
    const existing = itemWireId(item)
    if (existing) {
      item.id = existing
      return existing
    }
  }
  const id = crypto.randomUUID()
  item.id = id
  return id
}

const ensureArrayItemIds = (
  items: unknown[],
  remint: boolean,
): unknown[] =>
  items.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry
    const copy = { ...(entry as Record<string, unknown>) }
    ensureItemId(copy, remint)
    return copy
  })

const ensureNestedArrayItemIds = (
  block: Record<string, unknown>,
  remint: boolean,
): void => {
  const blockType = typeof block.blockType === "string" ? block.blockType : null
  if (!blockType) return
  const nested = NESTED_ARRAY_FIELDS[blockType]
  if (!nested) return

  for (const [parentField, childFields] of Object.entries(nested)) {
    const parentValue = block[parentField]
    if (!Array.isArray(parentValue)) continue
    block[parentField] = parentValue.map((parentItem) => {
      if (!parentItem || typeof parentItem !== "object" || Array.isArray(parentItem)) return parentItem
      const parentCopy = { ...(parentItem as Record<string, unknown>) }
      ensureItemId(parentCopy, remint)
      for (const childField of childFields) {
        const childValue = parentCopy[childField]
        if (!Array.isArray(childValue)) continue
        parentCopy[childField] = ensureArrayItemIds(childValue, remint)
      }
      return parentCopy
    })
  }
}

export function ensureBlockItemIds(
  block: Record<string, unknown>,
  options: { remint?: boolean } = {},
): void {
  const remint = options.remint ?? false
  const blockType = typeof block.blockType === "string" ? block.blockType : null
  if (!blockType) return

  const arrayFields = BLOCK_TOP_LEVEL_ARRAYS[blockType] ?? []
  for (const field of arrayFields) {
    const value = block[field]
    if (!Array.isArray(value)) continue
    block[field] = ensureArrayItemIds(value, remint)
  }

  ensureNestedArrayItemIds(block, remint)
}

export function ensureEditorBlock(block: EditorBlock, options: { remint?: boolean } = {}): EditorBlock {
  const copy = { ...(block as Record<string, unknown>) }
  ensureBlockId(copy)
  ensureBlockItemIds(copy, options)
  return copy as EditorBlock
}

export function ensureEditorBlocks(
  blocks: EditorBlock[],
  options: { remint?: boolean } = {},
): EditorBlock[] {
  return ensurePageBlockIds(blocks).map((block) => {
    if (!block || typeof block !== "object") return block
    const copy = { ...(block as Record<string, unknown>) }
    ensureBlockItemIds(copy, options)
    return copy as EditorBlock
  })
}

/** Mint a stable id for a newly appended array row in mobile drill-down. */
export function createEditorArrayItem<T extends Record<string, unknown>>(seed: T = {} as T): T & { id: string } {
  const item = { ...seed }
  ensureItemId(item)
  return item as T & { id: string }
}
