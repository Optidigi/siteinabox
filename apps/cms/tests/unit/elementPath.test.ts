import { describe, it, expect } from "vitest"
import {
  elementPathEq,
  describeElementPath,
  remapSelectionAfterReorder,
  remapSelectionAfterDelete,
  remapSelectionAfterInsert,
  type ElementPath,
} from "@/components/editor/elementPath"

describe("elementPath", () => {
  it("eq matches identical paths incl. optional fields", () => {
    const a: ElementPath = { blockIndex: 0, field: "headline" }
    expect(elementPathEq(a, { blockIndex: 0, field: "headline" })).toBe(true)
    expect(elementPathEq(a, { blockIndex: 1, field: "headline" })).toBe(false)
    expect(elementPathEq(
      { blockIndex: 2, field: "items", itemIndex: 1, subField: "question" },
      { blockIndex: 2, field: "items", itemIndex: 1, subField: "question" },
    )).toBe(true)
  })
  it("eq is null-safe", () => {
    expect(elementPathEq(null, null)).toBe(true)
    expect(elementPathEq(null, { blockIndex: 0, field: "x" })).toBe(false)
  })
  it("describe produces a human label", () => {
    expect(describeElementPath({ blockIndex: 0, field: "headline" })).toMatch(/headline/i)
  })
})

// ---------------------------------------------------------------------------
// remapSelectionAfterReorder
// ---------------------------------------------------------------------------
describe("remapSelectionAfterReorder", () => {
  // Setup: blocks at [A=0, B=1, C=2, D=3]
  // Reorder from=1, to=3 → [A=0, C=1, D=2, B=3]

  it("selection on the moved block follows it (from < to)", () => {
    const sel: ElementPath = { blockIndex: 1, field: "headline" }
    const result = remapSelectionAfterReorder(sel, 1, 3)
    expect(result?.blockIndex).toBe(3)
    expect(result?.field).toBe("headline")
  })

  it("selection on the moved block follows it (from > to)", () => {
    // from=3, to=1 → [A=0, D=1, B=2, C=3]
    const sel: ElementPath = { blockIndex: 3, field: "title" }
    const result = remapSelectionAfterReorder(sel, 3, 1)
    expect(result?.blockIndex).toBe(1)
  })

  it("selection on unaffected block before range is unchanged", () => {
    const sel: ElementPath = { blockIndex: 0, field: "body" }
    const result = remapSelectionAfterReorder(sel, 1, 3)
    expect(result?.blockIndex).toBe(0)
  })

  it("selection on block in shift zone shifts down (from < to)", () => {
    // Blocks at [A=0, B=1, C=2, D=3], move B(1) to 3 → [A=0, C=1, D=2, B=3]
    // C was at 2, now at 1 → shifts down
    const sel: ElementPath = { blockIndex: 2, field: "intro" }
    const result = remapSelectionAfterReorder(sel, 1, 3)
    expect(result?.blockIndex).toBe(1)
  })

  it("selection on block in shift zone shifts up (from > to)", () => {
    // Blocks at [A=0, B=1, C=2, D=3], move D(3) to 1 → [A=0, D=1, B=2, C=3]
    // B was at 1, now at 2 → shifts up
    const sel: ElementPath = { blockIndex: 1, field: "intro" }
    const result = remapSelectionAfterReorder(sel, 3, 1)
    expect(result?.blockIndex).toBe(2)
  })

  it("preserves itemIndex and subField on the moved block", () => {
    const sel: ElementPath = { blockIndex: 2, field: "features", itemIndex: 0, subField: "icon" }
    const result = remapSelectionAfterReorder(sel, 2, 0)
    expect(result?.blockIndex).toBe(0)
    expect(result?.field).toBe("features")
    expect(result?.itemIndex).toBe(0)
    expect(result?.subField).toBe("icon")
  })

  it("returns null unchanged when selected is null", () => {
    expect(remapSelectionAfterReorder(null, 0, 2)).toBeNull()
  })

  it("same from/to is a no-op", () => {
    const sel: ElementPath = { blockIndex: 1, field: "headline" }
    const result = remapSelectionAfterReorder(sel, 1, 1)
    expect(result?.blockIndex).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// remapSelectionAfterDelete
// ---------------------------------------------------------------------------
describe("remapSelectionAfterDelete", () => {
  it("selection on the deleted block clears to null", () => {
    const sel: ElementPath = { blockIndex: 1, field: "headline" }
    expect(remapSelectionAfterDelete(sel, 1)).toBeNull()
  })

  it("selection on a block before the deleted one is unchanged", () => {
    const sel: ElementPath = { blockIndex: 0, field: "headline" }
    expect(remapSelectionAfterDelete(sel, 1)?.blockIndex).toBe(0)
  })

  it("selection on a block after the deleted one shifts down by one", () => {
    const sel: ElementPath = { blockIndex: 2, field: "intro" }
    const result = remapSelectionAfterDelete(sel, 1)
    expect(result?.blockIndex).toBe(1)
  })

  it("preserves field/itemIndex/subField when shifting down", () => {
    const sel: ElementPath = { blockIndex: 3, field: "features", itemIndex: 2, subField: "title" }
    const result = remapSelectionAfterDelete(sel, 1)
    expect(result?.blockIndex).toBe(2)
    expect(result?.field).toBe("features")
    expect(result?.itemIndex).toBe(2)
    expect(result?.subField).toBe("title")
  })

  it("returns null unchanged when selected is null", () => {
    expect(remapSelectionAfterDelete(null, 0)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// remapSelectionAfterInsert
// ---------------------------------------------------------------------------
describe("remapSelectionAfterInsert", () => {
  it("selection on a block at or after the inserted index shifts up by one", () => {
    const sel: ElementPath = { blockIndex: 1, field: "headline" }
    const result = remapSelectionAfterInsert(sel, 1)
    expect(result?.blockIndex).toBe(2)
  })

  it("selection on a block before the inserted index is unchanged", () => {
    const sel: ElementPath = { blockIndex: 0, field: "headline" }
    const result = remapSelectionAfterInsert(sel, 1)
    expect(result?.blockIndex).toBe(0)
  })

  it("preserves field and sub-fields when shifting up", () => {
    const sel: ElementPath = { blockIndex: 2, field: "items", itemIndex: 0, subField: "question" }
    const result = remapSelectionAfterInsert(sel, 1)
    expect(result?.blockIndex).toBe(3)
    expect(result?.field).toBe("items")
    expect(result?.itemIndex).toBe(0)
    expect(result?.subField).toBe("question")
  })

  it("returns null unchanged when selected is null", () => {
    expect(remapSelectionAfterInsert(null, 0)).toBeNull()
  })

  it("inserting at the end of the array shifts nothing", () => {
    // blocks: [A, B, C] → insert at index 3 → [A, B, C, NEW]; selection on B (index 1) unchanged.
    expect(remapSelectionAfterInsert({ blockIndex: 1, field: "headline" }, 3))
      .toEqual({ blockIndex: 1, field: "headline" })
  })

  it("inserting at index 0 shifts all selections up by 1", () => {
    expect(remapSelectionAfterInsert({ blockIndex: 0, field: "headline" }, 0))
      .toEqual({ blockIndex: 1, field: "headline" })
  })
})
