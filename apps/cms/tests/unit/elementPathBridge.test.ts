import { describe, expect, it } from "vitest"
import {
  elementPathFromFieldElement,
  elementPathToIframeSelection,
  iframeSelectionToElementPath,
} from "@/lib/editor/elementPathBridge"

describe("elementPathBridge", () => {
  it("round-trips block + field + item + subField", () => {
    const blocks = [{ id: "blk-a", blockType: "hero" }, { id: "blk-b", blockType: "cta" }]
    const selected = {
      blockIndex: 1,
      field: "features",
      itemIndex: 2,
      subField: "title",
    }
    const iframe = elementPathToIframeSelection(selected, blocks, "page-1")
    expect(iframe).toEqual({
      pageId: "page-1",
      blockId: "blk-b",
      fieldPath: ["blocks", "1", "features", "2", "title"],
    })
    expect(iframeSelectionToElementPath(iframe, blocks)).toEqual(selected)
  })

  it("parses field markers from DOM dataset", () => {
    const el = {
      dataset: {
        siabField: "headline",
        siabItemIndex: "3",
        siabSubField: "label",
      },
    } as unknown as HTMLElement
    expect(elementPathFromFieldElement(4, el)).toEqual({
      blockIndex: 4,
      field: "headline",
      itemIndex: 3,
      subField: "label",
    })
  })

  it("omits item/subField when markers are absent", () => {
    const el = { dataset: { siabField: "cta" } } as unknown as HTMLElement
    expect(elementPathFromFieldElement(0, el)).toEqual({
      blockIndex: 0,
      field: "cta",
    })
  })
})
