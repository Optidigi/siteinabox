import { describe, it, expect } from "vitest"
import {
  blockWireId,
  ensureBlockId,
  ensurePageBlockIds,
  findBlockIndexByWireId,
} from "@/lib/editor/ensureBlockIds"

describe("blockWireId", () => {
  it("returns a trimmed string id as-is", () => {
    expect(blockWireId({ id: "abc-123" })).toBe("abc-123")
    expect(blockWireId({ id: "  abc-123  " })).toBe("abc-123")
  })
  it("stringifies a finite numeric id", () => {
    expect(blockWireId({ id: 42 })).toBe("42")
  })
  it("returns null for a missing, blank, or non-finite id", () => {
    expect(blockWireId({})).toBeNull()
    expect(blockWireId({ id: "" })).toBeNull()
    expect(blockWireId({ id: "   " })).toBeNull()
    expect(blockWireId({ id: Number.NaN })).toBeNull()
    expect(blockWireId({ id: null })).toBeNull()
    expect(blockWireId({ id: {} })).toBeNull()
  })
})

describe("ensureBlockId", () => {
  it("keeps an existing string id and normalizes it onto the block", () => {
    const block: Record<string, unknown> = { id: " abc-123 ", blockType: "hero" }
    const id = ensureBlockId(block)
    expect(id).toBe("abc-123")
    expect(block.id).toBe("abc-123")
  })
  it("keeps an existing numeric id, normalized to a string", () => {
    const block: Record<string, unknown> = { id: 7, blockType: "hero" }
    const id = ensureBlockId(block)
    expect(id).toBe("7")
    expect(block.id).toBe("7")
  })
  it("mints a fresh uuid when no id is present, mutating the block in place", () => {
    const block: Record<string, unknown> = { blockType: "hero" }
    const id = ensureBlockId(block)
    expect(typeof id).toBe("string")
    expect(id.length).toBeGreaterThan(0)
    expect(block.id).toBe(id)
  })
  it("mints a new id every call when the block has none (no caching across separate objects)", () => {
    const first = ensureBlockId({ blockType: "hero" })
    const second = ensureBlockId({ blockType: "hero" })
    expect(first).not.toBe(second)
  })
})

describe("ensurePageBlockIds", () => {
  it("assigns ids to every block, preserving existing ids", () => {
    const blocks = [
      { id: "keep-me", blockType: "hero" },
      { blockType: "faq" },
    ]
    const result = ensurePageBlockIds(blocks)
    expect(result[0]!.id).toBe("keep-me")
    expect(typeof (result[1] as Record<string, unknown>).id).toBe("string")
    expect((result[1] as Record<string, unknown>).id).toBeTruthy()
  })
  it("does not mutate the original block objects (copies before assigning)", () => {
    const original = { blockType: "hero" } as Record<string, unknown>
    const [result] = ensurePageBlockIds([original])
    expect(original.id).toBeUndefined()
    expect((result as Record<string, unknown>).id).toBeTruthy()
  })
  it("passes through non-object entries unchanged", () => {
    const blocks = [null, "not-a-block", 5] as unknown[]
    expect(ensurePageBlockIds(blocks)).toEqual(blocks)
  })
})

describe("findBlockIndexByWireId", () => {
  it("finds the index of the block whose wire id matches", () => {
    const blocks = [
      { id: "a", blockType: "hero" },
      { id: "b", blockType: "faq" },
      { id: 3, blockType: "cta" },
    ]
    expect(findBlockIndexByWireId(blocks, "b")).toBe(1)
    expect(findBlockIndexByWireId(blocks, "3")).toBe(2)
  })
  it("returns -1 when no block matches, including empty/non-object entries", () => {
    const blocks = [null, { blockType: "hero" }, { id: "x" }]
    expect(findBlockIndexByWireId(blocks, "missing")).toBe(-1)
    expect(findBlockIndexByWireId([], "anything")).toBe(-1)
  })
})
