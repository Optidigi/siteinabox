import type * as React from "react"

/**
 * Shape of the block-array mutation surface consumed by `CanvasSurface`.
 * `useCanvasBlocks` (RHF-backed, in-process CMS canvas) and
 * `useFrameCanvasBlocks` (postMessage-backed, iframe editor-frame canvas)
 * both implement this interface so `CanvasSurface` never has to know which
 * transport is behind block mutations.
 */
export interface CanvasBlocksApi {
  blocks: any[]
  activeIndex: number | null
  setActiveIndex: React.Dispatch<React.SetStateAction<number | null>>
  updateBlock: (i: number) => (next: any) => void
  insertBlockAt: (i: number, slug: string, seed?: Record<string, unknown>) => void
  deleteBlock: (i: number) => void
  duplicateBlock: (i: number) => void
  reorderBlocks: (from: number, to: number) => void
}
