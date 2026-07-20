import type * as React from "react"
import type { EditorBlock } from "@/lib/editor/editorBlock"

/** Block-list operations shared by the parent-owned mobile editor. */
export interface MobileBlocksApi {
  blocks: EditorBlock[]
  activeIndex: number | null
  setActiveIndex: React.Dispatch<React.SetStateAction<number | null>>
  updateBlock: (i: number) => (next: EditorBlock) => void
  insertBlockAt: (i: number, slug: string, seed?: Record<string, unknown>) => void
  deleteBlock: (i: number) => void
  duplicateBlock: (i: number) => void
  reorderBlocks: (from: number, to: number) => void
}
