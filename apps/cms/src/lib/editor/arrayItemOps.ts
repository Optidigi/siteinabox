import { createEditorArrayItem } from "@/lib/editor/ensureItemIds"
import type { EditorArrayItem } from "@/lib/editor/blockFieldValues"

export const getArrayItems = <T extends EditorArrayItem>(items: T[] | null | undefined): T[] =>
  Array.isArray(items) ? items : []

export const updateArrayItem = <T extends EditorArrayItem>(
  items: T[],
  itemIndex: number,
  next: T,
): T[] => {
  if (itemIndex < 0 || itemIndex >= items.length) return items
  const copy = [...items]
  copy[itemIndex] = next
  return copy
}

export const removeArrayItem = <T extends EditorArrayItem>(items: T[], itemIndex: number): T[] => {
  if (itemIndex < 0 || itemIndex >= items.length) return items
  return items.filter((_, index) => index !== itemIndex)
}

export const reorderArrayItems = <T extends EditorArrayItem>(
  items: T[],
  from: number,
  to: number,
): T[] => {
  if (from === to) return items
  if (from < 0 || to < 0 || from >= items.length || to >= items.length) return items
  const copy = [...items]
  const [moved] = copy.splice(from, 1)
  if (moved == null) return items
  copy.splice(to, 0, moved)
  return copy
}

export const appendArrayItem = <T extends EditorArrayItem>(
  items: T[],
  seed: Partial<T> = {},
): { items: T[]; insertedIndex: number } => {
  const item = createEditorArrayItem(seed) as T
  const next = [...items, item]
  return { items: next, insertedIndex: next.length - 1 }
}

export const updateArrayItemField = <T extends EditorArrayItem>(
  items: T[],
  itemIndex: number,
  field: string,
  value: unknown,
): T[] => {
  if (itemIndex < 0 || itemIndex >= items.length) return items
  const current = items[itemIndex]
  if (!current || typeof current !== "object") return items
  return updateArrayItem(items, itemIndex, { ...current, [field]: value })
}
