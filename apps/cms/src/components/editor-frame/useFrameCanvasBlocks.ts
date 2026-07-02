"use client"
import * as React from "react"
import {
  IFRAME_EDITOR_PROTOCOL_NAME,
  IFRAME_EDITOR_PROTOCOL_VERSION,
  type IframeEditorMessage,
} from "@siteinabox/contracts/iframe-editor"
import type { RtManifest } from "@/lib/richText/manifest"
import { blockWireId, ensureBlockId } from "@/lib/editor/ensureBlockIds"
import type { CanvasBlocksApi } from "@/components/editor/canvas/CanvasBlocksApi"

/** Distributes `Omit` over each member of a union instead of collapsing to
 *  the intersection of common keys (the default `Omit<Union, K>` behavior). */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

const jsonEqual = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b)

/** Shallow top-level key diff between two block objects, excluding `id`. */
function diffBlockKeys(prev: Record<string, unknown> | undefined, next: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(prev ?? {}), ...Object.keys(next)])
  keys.delete("id")
  const changed: string[] = []
  for (const key of keys) {
    if (!jsonEqual(prev?.[key], next[key])) changed.push(key)
  }
  return changed
}

export interface UseFrameCanvasBlocksArgs {
  /** Wire page id addressed by outbound mutation messages. */
  pageId: string
  /** Authoritative blocks from the parent CMS (via `page.replace`). Re-syncs
   *  the local optimistic mirror whenever this changes. */
  blocks: unknown[]
  manifest?: RtManifest
  /** Current revision known to the frame; stamped on outbound revisioned
   *  messages. The parent does not enforce this for inbound mutation
   *  messages (see `PageEditorFrameHost`), so it only needs to be a
   *  reasonable, monotonically-nondecreasing value. */
  revision: number
  emit: (message: IframeEditorMessage) => void
}

/**
 * postMessage-backed implementation of `CanvasBlocksApi` for the iframe
 * editor frame. Mirrors `blocks` locally for optimistic UI (so drag/insert/
 * delete/edit feel instant inside the frame), then reports the mutation to
 * the parent CMS — the source of truth, which owns the RHF form and echoes
 * confirmed state back via `page.replace`.
 */
export function useFrameCanvasBlocks({
  pageId,
  blocks: incomingBlocks,
  manifest,
  revision,
  emit,
}: UseFrameCanvasBlocksArgs): CanvasBlocksApi {
  const [blocks, setBlocks] = React.useState<any[]>(incomingBlocks)
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null)

  React.useEffect(() => {
    setBlocks(incomingBlocks)
  }, [incomingBlocks])

  const emitMessage = React.useCallback((message: DistributiveOmit<IframeEditorMessage, "protocol" | "schemaVersion" | "messageId">) => {
    emit({
      protocol: IFRAME_EDITOR_PROTOCOL_NAME,
      schemaVersion: IFRAME_EDITOR_PROTOCOL_VERSION,
      messageId: crypto.randomUUID(),
      ...message,
    } as IframeEditorMessage)
  }, [emit])

  const updateBlock = React.useCallback((i: number) => (next: any) => {
    const prev = blocks[i]
    setBlocks((current) => {
      const copy = [...current]
      copy[i] = next
      return copy
    })

    const blockId = prev ? blockWireId(prev) : null
    if (!blockId) return

    const changedKeys = diffBlockKeys(prev, next)
    if (changedKeys.length === 0) return

    if (changedKeys.length === 1) {
      const field = changedKeys[0]!
      emitMessage({
        type: "field.commit",
        expectedRevision: revision,
        pageId,
        blockId,
        fieldPath: ["blocks", String(i), field],
        value: next[field],
      })
      return
    }

    const patch: Record<string, unknown> = {}
    for (const key of changedKeys) patch[key] = next[key]
    emitMessage({
      type: "block.patch",
      expectedRevision: revision,
      pageId,
      blockId,
      patch: patch as any,
    })
  }, [blocks, emitMessage, pageId, revision])

  /** Insert a minimal new block of the given type at position i. Mirrors
   *  `useCanvasBlocks.insertBlockAt` (same anchor-default + seed-merge
   *  behavior) but reports the insert to the parent instead of calling
   *  `setValue` directly. */
  const insertBlockAt = React.useCallback((i: number, slug: string, seed?: Record<string, unknown>) => {
    const defaultAnchor = manifest?.blocks?.find((m) => m.slug === slug)?.defaultAnchor
    const block: Record<string, unknown> = {
      blockType: slug,
      ...(defaultAnchor ? { anchor: defaultAnchor } : {}),
      ...seed,
    }
    ensureBlockId(block)
    setBlocks((current) => {
      const next = [...current]
      next.splice(i, 0, block)
      return next
    })
    setActiveIndex(i)
    emitMessage({
      type: "blocks.insert",
      expectedRevision: revision,
      pageId,
      block: block as any,
      index: i,
    })
  }, [emitMessage, manifest, pageId, revision])

  const deleteBlock = React.useCallback((i: number) => {
    const blockId = blocks[i] ? blockWireId(blocks[i]) : null
    setBlocks((current) => {
      const next = [...current]
      next.splice(i, 1)
      return next
    })
    setActiveIndex((prev) => {
      if (prev === null) return null
      if (prev === i) return null
      if (prev > i) return prev - 1
      return prev
    })
    if (!blockId) return
    emitMessage({
      type: "blocks.delete",
      expectedRevision: revision,
      pageId,
      blockId,
    })
  }, [blocks, emitMessage, pageId, revision])

  const duplicateBlock = React.useCallback((i: number) => {
    const source = blocks[i]
    if (!source) return
    const clone: Record<string, unknown> = JSON.parse(JSON.stringify(source))
    delete clone.id
    ensureBlockId(clone)
    setBlocks((current) => {
      const next = [...current]
      next.splice(i + 1, 0, clone)
      return next
    })
    setActiveIndex(i + 1)
    emitMessage({
      type: "blocks.insert",
      expectedRevision: revision,
      pageId,
      block: clone as any,
      index: i + 1,
    })
  }, [blocks, emitMessage, pageId, revision])

  const reorderBlocks = React.useCallback((from: number, to: number) => {
    const reordered = [...blocks]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)

    setBlocks(reordered)
    setActiveIndex((prev) => {
      if (prev === from) return to
      if (prev === null) return null
      if (from < to) {
        if (prev > from && prev <= to) return prev - 1
      } else {
        if (prev >= to && prev < from) return prev + 1
      }
      return prev
    })

    const blockIds = reordered.map((block) => (block ? blockWireId(block) : null))
    if (blockIds.some((id) => !id)) return
    emitMessage({
      type: "blocks.reorder",
      expectedRevision: revision,
      pageId,
      blockIds: blockIds as string[],
    })
  }, [blocks, emitMessage, pageId, revision])

  return {
    blocks,
    activeIndex,
    setActiveIndex,
    updateBlock,
    insertBlockAt,
    deleteBlock,
    duplicateBlock,
    reorderBlocks,
  }
}
