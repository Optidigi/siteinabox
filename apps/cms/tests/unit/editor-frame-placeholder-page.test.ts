import { describe, expect, it } from "vitest"
import { createEditorFrameNewPagePlaceholder } from "@/lib/editor/editorFramePlaceholderPage"

describe("createEditorFrameNewPagePlaceholder", () => {
  it("returns an empty draft page the parent can replace via render.snapshot", () => {
    const page = createEditorFrameNewPagePlaceholder()

    expect(page.id).toBe("new")
    expect(page.slug).toBe("")
    expect(page.title).toBe("")
    expect(page.status).toBe("draft")
    expect(page.blocks).toEqual([])
    expect(page.seo).toEqual({})
    expect(typeof page.updatedAt).toBe("string")
  })
})
