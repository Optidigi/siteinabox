import type { IframeEditorSelection } from "@siteinabox/contracts/iframe-editor"
import type { ElementPath } from "@/components/editor/elementPath"
import { blockWireId } from "@/lib/editor/ensureBlockIds"

/** Build an ElementPath from a canvas `[data-siab-field]` marker. */
export function elementPathFromFieldElement(blockIndex: number, el: HTMLElement): ElementPath {
  const field = el.dataset.siabField ?? ""
  const rawItemIndex = el.dataset.siabItemIndex
  const parsedItemIndex = rawItemIndex != null ? Number.parseInt(rawItemIndex, 10) : Number.NaN
  const subField = el.dataset.siabSubField
  return {
    blockIndex,
    field,
    ...(Number.isFinite(parsedItemIndex) && parsedItemIndex >= 0 ? { itemIndex: parsedItemIndex } : {}),
    ...(subField ? { subField } : {}),
  }
}

export function iframeSelectionToElementPath(
  selection: IframeEditorSelection | null | undefined,
  blocks: unknown[],
): ElementPath | null {
  if (!selection) return null

  if (selection.fieldPath?.[0] === "blocks") {
    const rawIndex = selection.fieldPath[1]
    const parsedIndex = rawIndex != null ? Number.parseInt(String(rawIndex), 10) : Number.NaN
    if (Number.isFinite(parsedIndex) && parsedIndex >= 0) {
      const rawItemIndex = selection.fieldPath[3]
      const parsedItemIndex = rawItemIndex != null ? Number.parseInt(String(rawItemIndex), 10) : Number.NaN
      return {
        blockIndex: parsedIndex,
        field: selection.fieldPath[2] ?? "",
        ...(Number.isFinite(parsedItemIndex) && parsedItemIndex >= 0 ? { itemIndex: parsedItemIndex } : {}),
        ...(selection.fieldPath[4] ? { subField: selection.fieldPath[4] } : {}),
      }
    }
  }

  if (selection.blockId) {
    for (let index = 0; index < blocks.length; index += 1) {
      const block = blocks[index]
      if (!block || typeof block !== "object") continue
      if (blockWireId(block as Record<string, unknown>) === selection.blockId) {
        const rawItemIndex = selection.fieldPath?.[3]
        const parsedItemIndex = rawItemIndex != null ? Number.parseInt(String(rawItemIndex), 10) : Number.NaN
        return {
          blockIndex: index,
          field: selection.fieldPath?.[2] ?? "",
          ...(Number.isFinite(parsedItemIndex) && parsedItemIndex >= 0 ? { itemIndex: parsedItemIndex } : {}),
          ...(selection.fieldPath?.[4] ? { subField: selection.fieldPath[4] } : {}),
        }
      }
    }
  }

  return null
}

export function elementPathToIframeSelection(
  selected: ElementPath | null,
  blocks: unknown[],
  pageId: string | number,
): IframeEditorSelection | null {
  if (!selected || selected.blockIndex == null || selected.blockIndex < 0) return null
  const block = blocks[selected.blockIndex]
  const blockId = block && typeof block === "object"
    ? blockWireId(block as Record<string, unknown>) ?? undefined
    : undefined
  return {
    pageId: String(pageId),
    ...(blockId ? { blockId } : {}),
    fieldPath: [
      "blocks",
      String(selected.blockIndex),
      ...(selected.field ? [selected.field] : []),
      ...(selected.itemIndex != null ? [String(selected.itemIndex)] : []),
      ...(selected.subField ? [selected.subField] : []),
    ],
  }
}
