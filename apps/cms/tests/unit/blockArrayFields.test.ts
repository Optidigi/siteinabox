import { describe, expect, it } from "vitest"
import {
  BLOCK_TOP_LEVEL_ARRAYS,
  EDITOR_ARRAY_ROW_KEYS,
  NESTED_ARRAY_FIELDS,
  PROJECTION_ONLY_ARRAY_ROW_KEYS,
  editorArrayRowKeys,
} from "@/lib/editor/blockArrayFields"

describe("blockArrayFields", () => {
  it("derives editor array-row keys from canonical maps plus projection-only keys", () => {
    const keys = editorArrayRowKeys()
    expect([...keys].sort()).toEqual([...EDITOR_ARRAY_ROW_KEYS].sort())

    for (const fields of Object.values(BLOCK_TOP_LEVEL_ARRAYS)) {
      for (const field of fields) {
        expect(keys.has(field)).toBe(true)
      }
    }

    for (const nested of Object.values(NESTED_ARRAY_FIELDS)) {
      for (const [parentField, childFields] of Object.entries(nested)) {
        expect(keys.has(parentField)).toBe(true)
        for (const childField of childFields) {
          expect(keys.has(childField)).toBe(true)
        }
      }
    }

    for (const key of PROJECTION_ONLY_ARRAY_ROW_KEYS) {
      expect(keys.has(key)).toBe(true)
    }

    expect(keys.has("blocks")).toBe(true)
  })

  it("covers known editor-stamped array row field names", () => {
    const expected = [
      "plans",
      "tags",
      "logos",
      "images",
      "members",
      "posts",
      "links",
      "features",
      "items",
      "pills",
      "stats",
      "fields",
      "benefits",
    ]
    for (const key of expected) {
      expect(EDITOR_ARRAY_ROW_KEYS.has(key)).toBe(true)
    }
  })
})
