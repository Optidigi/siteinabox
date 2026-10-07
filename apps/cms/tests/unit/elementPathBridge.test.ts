// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import {
  elementPathFromFieldElement,
  elementPathFromInspectorElement,
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
    const el = document.createElement("div")
    Object.assign(el.dataset, { siabField: "headline", siabItemIndex: "3", siabSubField: "label" })
    expect(elementPathFromFieldElement(4, el)).toEqual({
      blockIndex: 4,
      field: "headline",
      itemIndex: 3,
      subField: "label",
    })
  })

  it("omits item/subField when markers are absent", () => {
    const el = document.createElement("div")
    el.dataset.siabField = "cta"
    expect(elementPathFromFieldElement(0, el)).toEqual({
      blockIndex: 0,
      field: "cta",
    })
  })

  it("parses nested array-item inspector controls", () => {
    const field = document.createElement("div")
    field.dataset.siabInspectorField = "features"
    const item = document.createElement("div")
    item.dataset.siabInspectorItemIndex = "2"
    const subField = document.createElement("div")
    subField.dataset.siabInspectorSubField = "title"
    const el = document.createElement("input")
    field.append(item)
    item.append(subField)
    subField.append(el)

    expect(elementPathFromInspectorElement(1, el)).toEqual({
      blockIndex: 1,
      field: "features",
      itemIndex: 2,
      subField: "title",
    })
  })
})
