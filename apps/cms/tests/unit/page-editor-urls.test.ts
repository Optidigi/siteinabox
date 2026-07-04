import { describe, expect, it } from "vitest"
import { pageEditorHref } from "@/lib/pageEditorUrls"

describe("page editor URL helpers", () => {
  it("prefers slug edit routes for normal page editor links", () => {
    expect(pageEditorHref("/pages", { id: 24, slug: "index" })).toBe("/pages/edit/index")
    expect(pageEditorHref("/sites/ami-care/pages", { id: 24, slug: "index" })).toBe("/sites/ami-care/pages/edit/index")
  })

  it("falls back to numeric compatibility routes when a slug is unavailable", () => {
    expect(pageEditorHref("/pages", { id: 24, slug: null })).toBe("/pages/24")
  })
})
