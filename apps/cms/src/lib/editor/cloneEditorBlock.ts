import type { EditorBlock } from "@/lib/editor/editorBlock"
import { ensureEditorBlock } from "@/lib/editor/ensureItemIds"

const clonePrimitive = (value: unknown): unknown => value

const cloneArray = (value: unknown[]): unknown[] => value.map(cloneEditorValue)

const cloneObject = (value: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    out[key] = cloneEditorValue(entry)
  }
  return out
}

/** Typed deep clone for editor block graphs (RtRoot JSON, media refs, nested arrays). */
export function cloneEditorValue<T>(value: T): T {
  if (value == null || typeof value !== "object") return clonePrimitive(value) as T
  if (Array.isArray(value)) return cloneArray(value) as T
  return cloneObject(value as Record<string, unknown>) as T
}

/** Deep-clone a block and mint fresh wire ids for the block and nested collection rows. */
export function cloneEditorBlock(block: EditorBlock): EditorBlock {
  const cloned = cloneEditorValue(block) as Record<string, unknown>
  delete cloned.id
  return ensureEditorBlock(cloned as EditorBlock, { remint: true })
}
