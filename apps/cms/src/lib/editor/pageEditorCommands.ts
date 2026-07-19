import type { EditorBlock } from "@/lib/editor/editorBlock"
import { cloneEditorBlock } from "@/lib/editor/cloneEditorBlock"
import { ensureEditorBlock } from "@/lib/editor/ensureItemIds"

export type EditorBlockSeed = Record<string, unknown> & { blockType: string }

export function reorderEditorBlocks(
  blocks: EditorBlock[],
  from: number,
  to: number,
): EditorBlock[] {
  if (from === to) return blocks
  if (from < 0 || to < 0 || from >= blocks.length || to >= blocks.length) return blocks
  const copy = [...blocks]
  const [moved] = copy.splice(from, 1)
  if (moved == null) return blocks
  copy.splice(to, 0, moved)
  return copy
}

export function removeEditorBlock(blocks: EditorBlock[], index: number): EditorBlock[] {
  if (index < 0 || index >= blocks.length) return blocks
  return blocks.filter((_, i) => i !== index)
}

export function cloneEditorBlockAt(
  blocks: EditorBlock[],
  index: number,
): { blocks: EditorBlock[]; insertedIndex: number } | null {
  const source = blocks[index]
  if (source == null) return null
  const insertedIndex = index + 1
  const dup = cloneEditorBlock(source)
  const next = [...blocks.slice(0, insertedIndex), dup, ...blocks.slice(insertedIndex)]
  return { blocks: next, insertedIndex }
}

export function insertEditorBlock(
  blocks: EditorBlock[],
  index: number,
  seed: EditorBlockSeed,
): EditorBlock[] {
  const clampedIndex = Math.max(0, Math.min(index, blocks.length))
  const block = ensureEditorBlock(seed as EditorBlock)
  const next = [...blocks]
  next.splice(clampedIndex, 0, block)
  return next
}

export function appendEditorBlock(
  blocks: EditorBlock[],
  seed: EditorBlockSeed,
): EditorBlock[] {
  return [...blocks, ensureEditorBlock(seed as EditorBlock)]
}

export function replaceEditorBlocks(
  blocks: EditorBlock[],
  blockIndex: number,
  nextBlock: EditorBlock,
): EditorBlock[] {
  if (blockIndex < 0 || blockIndex >= blocks.length) return blocks
  const copy = [...blocks]
  copy[blockIndex] = ensureEditorBlock(nextBlock)
  return copy
}

export function updateEditorBlockField(
  blocks: EditorBlock[],
  blockIndex: number,
  field: string,
  value: unknown,
): EditorBlock[] {
  if (blockIndex < 0 || blockIndex >= blocks.length) return blocks
  const current = blocks[blockIndex]
  if (!current || typeof current !== "object") return blocks
  const nextBlock = ensureEditorBlock({
    ...(current as Record<string, unknown>),
    [field]: value,
  } as EditorBlock)
  return replaceEditorBlocks(blocks, blockIndex, nextBlock)
}
