/** Stable address of one editable element inside a page's blocks. */
export interface ElementPath {
  blockIndex: number
  field: string          // e.g. "headline", "image", "pills", "items"
  itemIndex?: number     // for array fields (features[], items[], pills[])
  subField?: string      // for array-item sub-fields (items[i].question)
}
export const elementPathEq = (a: ElementPath | null, b: ElementPath | null): boolean => {
  if (a === b) return true
  if (!a || !b) return false
  return a.blockIndex === b.blockIndex && a.field === b.field
    && (a.itemIndex ?? null) === (b.itemIndex ?? null)
    && (a.subField ?? null) === (b.subField ?? null)
}
export const describeElementPath = (p: ElementPath): string =>
  [p.field, p.itemIndex != null ? `#${p.itemIndex + 1}` : "", p.subField].filter(Boolean).join(" ")
/** RHF field name for this path's value, e.g. `blocks.0.items.1.question`. */
export const elementPathToName = (p: ElementPath): string =>
  ["blocks", p.blockIndex, p.field, p.itemIndex, p.subField].filter((x) => x != null && x !== "").join(".")

// ---------------------------------------------------------------------------
// Selection remap helpers — keep `selected` coherent after array mutations.
// All helpers are pure and unit-tested in tests/unit/elementPath.test.ts.
// ---------------------------------------------------------------------------

/**
 * Remap a selection after a block-array reorder (dnd drag from → to).
 * Mirrors the same splice semantics used by useCanvasBlocks.reorderBlocks
 * and PageForm.reorderBlocks:
 *   const copy = [...arr]; const [m] = copy.splice(from, 1); copy.splice(to, 0, m)
 *
 * Returns the remapped path (new object), or null if selected was null.
 */
export const remapSelectionAfterReorder = (
  selected: ElementPath | null,
  from: number,
  to: number,
): ElementPath | null => {
  if (selected === null) return null
  if (from === to) return selected
  const i = selected.blockIndex
  let next = i
  if (i === from) {
    next = to
  } else if (from < to) {
    // Moving forward: blocks between (from+1)…to shift down by one.
    if (i > from && i <= to) next = i - 1
  } else {
    // Moving backward: blocks between to…(from-1) shift up by one.
    if (i >= to && i < from) next = i + 1
  }
  if (next === i) return selected
  return { ...selected, blockIndex: next }
}

/**
 * Remap a selection after a block at `deletedIndex` is removed.
 * - Selection on the deleted block → null (cleared).
 * - Selection on a block after the deleted one → shift down by one.
 * - Selection on a block before the deleted one → unchanged.
 */
export const remapSelectionAfterDelete = (
  selected: ElementPath | null,
  deletedIndex: number,
): ElementPath | null => {
  if (selected === null) return null
  const i = selected.blockIndex
  if (i === deletedIndex) return null
  if (i > deletedIndex) return { ...selected, blockIndex: i - 1 }
  return selected
}

/**
 * Remap a selection after a new block is inserted at `insertedIndex`.
 * Blocks at or after the inserted position shift up by one.
 */
export const remapSelectionAfterInsert = (
  selected: ElementPath | null,
  insertedIndex: number,
): ElementPath | null => {
  if (selected === null) return null
  const i = selected.blockIndex
  if (i >= insertedIndex) return { ...selected, blockIndex: i + 1 }
  return selected
}
