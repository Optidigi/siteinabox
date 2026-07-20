import { describe, expect, it } from "vitest"
import {
  appendArrayItem,
  getArrayItems,
  removeArrayItem,
  reorderArrayItems,
  updateArrayItem,
  updateArrayItemField,
} from "@/lib/editor/arrayItemOps"
import type { EditorArrayItem } from "@/lib/editor/blockFieldValues"

describe("arrayItemOps", () => {
  const items: EditorArrayItem[] = [
    { id: "a", label: "One" },
    { id: "b", label: "Two" },
    { id: "c", label: "Three" },
  ]

  it("normalizes missing arrays", () => {
    expect(getArrayItems(null)).toEqual([])
    expect(getArrayItems(undefined)).toEqual([])
  })

  it("updates a single item", () => {
    const next = updateArrayItem(items, 1, { id: "b", label: "Updated" })
    expect(next[1]?.label).toBe("Updated")
    expect(items[1]?.label).toBe("Two")
  })

  it("removes an item by index", () => {
    expect(removeArrayItem(items, 1).map((item) => item.id)).toEqual(["a", "c"])
  })

  it("reorders items", () => {
    expect(reorderArrayItems(items, 0, 2).map((item) => item.id)).toEqual(["b", "c", "a"])
  })

  it("updates a nested field on an item", () => {
    const next = updateArrayItemField(items, 0, "label", "First")
    expect(next[0]?.label).toBe("First")
  })

  it("appends a new item with a wire id", () => {
    const { items: next, insertedIndex } = appendArrayItem(items, { label: "Four" })
    expect(insertedIndex).toBe(3)
    expect(next).toHaveLength(4)
    expect(typeof next[3]?.id).toBe("string")
    expect(next[3]?.label).toBe("Four")
  })
})
