import type { IframeEditorSelection } from "@siteinabox/contracts/iframe-editor"
import type { ElementPath } from "@/components/editor/canvas/elementPath"
import { blockWireId } from "@/lib/editor/ensureBlockIds"

export function iframeSelectionToElementPath(
  selection: IframeEditorSelection | null | undefined,
  blocks: unknown[],
): ElementPath | null {
  if (!selection) return null

  if (selection.fieldPath?.[0] === "blocks") {
    const rawIndex = selection.fieldPath[1]
    const parsedIndex = rawIndex != null ? Number.parseInt(String(rawIndex), 10) : Number.NaN
    if (Number.isFinite(parsedIndex) && parsedIndex >= 0) {
      return { blockIndex: parsedIndex, field: selection.fieldPath[2] ?? "" }
    }
  }

  if (selection.blockId) {
    for (let index = 0; index < blocks.length; index += 1) {
      const block = blocks[index]
      if (!block || typeof block !== "object") continue
      if (blockWireId(block as Record<string, unknown>) === selection.blockId) {
        return { blockIndex: index, field: selection.fieldPath?.[2] ?? "" }
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
    fieldPath: ["blocks", String(selected.blockIndex), ...(selected.field ? [selected.field] : [])],
  }
}
