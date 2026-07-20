import { describe, expect, it } from "vitest"
import { cloneEditorBlock, cloneEditorValue } from "@/lib/editor/cloneEditorBlock"
import type { EditorBlock } from "@/lib/editor/editorBlock"
import { blockWireId } from "@/lib/editor/ensureBlockIds"
import {
  createEditorArrayItem,
  ensureBlockItemIds,
  ensureEditorBlocks,
  ensureItemId,
  itemWireId,
} from "@/lib/editor/ensureItemIds"
import {
  appendEditorBlock,
  cloneEditorBlockAt,
  insertEditorBlock,
  removeEditorBlock,
  reorderEditorBlocks,
  replaceEditorBlocks,
  updateEditorBlockField,
} from "@/lib/editor/pageEditorCommands"

import { asMockDoc } from "../_helpers/cast"
const heroBlock = (id: string): EditorBlock => ({
  id,
  blockType: "hero",
  headline: { t: "root", variant: "block", children: [] },
} as EditorBlock)

describe("itemWireId / ensureItemId", () => {
  it("normalizes existing ids and mints when missing", () => {
    expect(itemWireId({ id: " item-1 " })).toBe("item-1")
    const item: Record<string, unknown> = {}
    const id = ensureItemId(item)
    expect(item.id).toBe(id)
    expect(typeof id).toBe("string")
  })

  it("remints when requested", () => {
    const item = { id: "keep-unless-remint" }
    ensureItemId(item, true)
    expect(item.id).not.toBe("keep-unless-remint")
  })
})

describe("ensureBlockItemIds", () => {
  it("assigns ids to faq items and pricing plan features", () => {
    const block: Record<string, unknown> = {
      blockType: "faq",
      items: [{ question: { t: "root", variant: "block", children: [] }, answer: { t: "root", variant: "block", children: [] } }],
    }
    ensureBlockItemIds(block)
    const items = block.items as Array<Record<string, unknown>>
    expect(typeof items[0]!.id).toBe("string")

    const pricing: Record<string, unknown> = {
      blockType: "pricing",
      plans: [{
        title: { t: "root", variant: "block", children: [] },
        features: [{ label: { t: "root", variant: "block", children: [] } }],
      }],
    }
    ensureBlockItemIds(pricing)
    const plans = pricing.plans as Array<Record<string, unknown>>
    expect(typeof plans[0]!.id).toBe("string")
    const features = plans[0]!.features as Array<Record<string, unknown>>
    expect(typeof features[0]!.id).toBe("string")
  })
})

describe("ensureEditorBlocks", () => {
  it("ensures block and nested item ids without mutating originals", () => {
    const source = [{ blockType: "stats", items: [{ value: "1", label: "One" }] }] as EditorBlock[]
    const result = ensureEditorBlocks(source)
    expect((result[0] as Record<string, unknown>).id).toBeTruthy()
    const items = (result[0] as Record<string, unknown>).items as Array<Record<string, unknown>>
    expect(items[0]!.id).toBeTruthy()
    expect((source[0] as Record<string, unknown>).id).toBeUndefined()
  })
})

describe("cloneEditorBlock", () => {
  it("deep-clones content and mints fresh block and item ids", () => {
    const source: EditorBlock = {
      id: "block-a",
      blockType: "featureList",
      features: [{
        id: "feature-a",
        title: { t: "root", variant: "block", children: [{ t: "paragraph", children: [] }] },
      }],
    } as EditorBlock

    const cloned = cloneEditorBlock(source)
    expect(cloned).not.toBe(source)
    expect(asMockDoc(cloned).id).not.toBe("block-a")
    const features = asMockDoc(cloned).features as Array<Record<string, unknown>>
    expect(features[0]!.id).not.toBe("feature-a")
    expect(cloneEditorValue(asMockDoc(source)).features).not.toBe(asMockDoc(source).features)
  })
})

describe("pageEditorCommands", () => {
  const blocks = [
    heroBlock("a"),
    heroBlock("b"),
    heroBlock("c"),
  ]

  it("reorders, removes, inserts, and appends blocks", () => {
    expect(reorderEditorBlocks(blocks, 0, 2).map((b) => blockWireId(asMockDoc(b)))).toEqual(["b", "c", "a"])
    expect(removeEditorBlock(blocks, 1).map((b) => blockWireId(asMockDoc(b)))).toEqual(["a", "c"])
    const inserted = insertEditorBlock(blocks, 1, { blockType: "hero", headline: { t: "root", variant: "block", children: [] } })
    expect(inserted).toHaveLength(4)
    expect(blockWireId(inserted[1] as Record<string, unknown>)).toBeTruthy()
    const appended = appendEditorBlock(blocks, { blockType: "cta", headline: { t: "root", variant: "block", children: [] } })
    expect(appended).toHaveLength(4)
  })

  it("clones a block after the source index with fresh ids", () => {
    const result = cloneEditorBlockAt(blocks, 1)
    expect(result?.insertedIndex).toBe(2)
    expect(result?.blocks).toHaveLength(4)
    const ids = result!.blocks.map((b) => blockWireId(asMockDoc(b)))
    expect(ids[1]).toBe("b")
    expect(ids[2]).not.toBe("b")
    expect(ids[2]).toBeTruthy()
  })

  it("replaces and updates a single block field", () => {
    const next = replaceEditorBlocks(blocks, 1, { ...blocks[1]!, anchor: "updated" })
    expect((next[1] as Record<string, unknown>).anchor).toBe("updated")
    const updated = updateEditorBlockField(blocks, 0, "anchor", "hero-anchor")
    expect((updated[0] as Record<string, unknown>).anchor).toBe("hero-anchor")
  })
})

describe("createEditorArrayItem", () => {
  it("returns a new item with a stable id", () => {
    const item = createEditorArrayItem({ label: "Pill" })
    expect(item.label).toBe("Pill")
    expect(typeof item.id).toBe("string")
  })
})
