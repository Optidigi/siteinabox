import { describe, expect, it } from "vitest"
import { resolvePreviewNavigationTarget } from "@/components/preview/PreviewCustomizer"

const pages = [
  { id: 1, slug: "index", title: "Home" },
  { id: 2, slug: "diensten", title: "Diensten" },
]

describe("preview site navigation", () => {
  it("maps known tenant links onto grant preview routes", () => {
    const access = { type: "grant", clientSlug: "demo" } as const
    expect(resolvePreviewNavigationTarget({ access, pages, href: "/", origin: "https://preview.test" })).toBe("/demo")
    expect(resolvePreviewNavigationTarget({ access, pages, href: "/diensten", origin: "https://preview.test" })).toBe("/demo/pages/diensten")
  })

  it("fails closed for links that are not pages in the current preview", () => {
    const access = { type: "grant", clientSlug: "demo" } as const
    expect(resolvePreviewNavigationTarget({ access, pages, href: "/unknown", origin: "https://preview.test" })).toBeNull()
  })

  it("uses the first fixture page as the root when the fixture intentionally has no index slug", () => {
    const access = { type: "grant", clientSlug: "sitegen-review" } as const
    const fixturePages = [
      { id: "hero-01", slug: "hero-01", title: "Hero 01" },
      { id: "hero-02", slug: "hero-02", title: "Hero 02" },
    ]
    expect(resolvePreviewNavigationTarget({ access, pages: fixturePages, href: "/", origin: "https://preview.test" })).toBe(
      "/sitegen-review/pages/hero-01",
    )
  })
})
