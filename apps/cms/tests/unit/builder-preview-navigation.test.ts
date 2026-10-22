import { describe, expect, it } from "vitest"
import { builderPreviewNavigation } from "@/lib/builder/previewNavigation"

describe("authorized builder preview navigation", () => {
  const origin = "https://admin.siteinabox.nl"
  it("retains same-workspace links and anchors within the private frame route", () => {
    expect(builderPreviewNavigation("/one/pages/contact#form", "one", origin)).toEqual({ pageSlug: "contact", hash: "#form" })
    expect(builderPreviewNavigation("/renderer-frame/preview/one/about", "one", origin)).toEqual({ pageSlug: "about", hash: "" })
    expect(builderPreviewNavigation("/", "one", origin)).toEqual({ pageSlug: "", hash: "" })
  })
  it.each(["https://other.test/", "//other.test/page", "/two/pages/private", "/renderer-frame/preview/two/secret", "/one/pages/a/b", "/one/pages/%2fsecret", "javascript:alert(1)"])("rejects unsafe or foreign navigation %s", href => {
    expect(builderPreviewNavigation(href, "one", origin)).toBeNull()
  })
})
