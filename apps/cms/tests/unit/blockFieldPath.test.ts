import { describe, expect, it } from "vitest"
import {
  blockArrayItemFieldName,
  blockFieldName,
  blockFieldPathFromElementPath,
  elementPathFieldName,
} from "@/lib/editor/blockFieldPath"

describe("blockFieldPath", () => {
  it("builds top-level block field names", () => {
    expect(blockFieldName({ blockIndex: 2, field: "headline" })).toBe("blocks.2.headline")
  })

  it("builds nested array item field names", () => {
    expect(
      blockArrayItemFieldName({
        blockIndex: 1,
        field: "items",
        itemIndex: 3,
        subField: "question",
      }),
    ).toBe("blocks.1.items.3.question")
  })

  it("maps element paths to RHF names", () => {
    expect(
      elementPathFieldName({ blockIndex: 0, field: "features", itemIndex: 1, subField: "title" }),
    ).toBe("blocks.0.features.1.title")
    expect(blockFieldPathFromElementPath({ blockIndex: 4, field: "image" })).toEqual({
      blockIndex: 4,
      field: "image",
    })
  })
})
