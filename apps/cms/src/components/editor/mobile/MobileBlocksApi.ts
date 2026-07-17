import type * as React from "react"

/** Block-list operations shared by the parent-owned mobile editor. */
export interface MobileBlocksApi {
  blocks: any[]
  activeIndex: number | null
  setActiveIndex: React.Dispatch<React.SetStateAction<number | null>>
  updateBlock: (i: number) => (next: any) => void
  insertBlockAt: (i: number, slug: string, seed?: Record<string, unknown>) => void
  deleteBlock: (i: number) => void
  duplicateBlock: (i: number) => void
  reorderBlocks: (from: number, to: number) => void
}
