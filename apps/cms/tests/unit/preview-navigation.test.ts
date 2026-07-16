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

  it("keeps legacy-token navigation inside the token preview", () => {
    const access = { type: "legacy-token", token: "token", exp: 1 } as const
    expect(resolvePreviewNavigationTarget({ access, pages, href: "/diensten", origin: "https://preview.test" })).toBe("/preview/token?page=diensten")
  })

  it("fails closed for links that are not pages in the current preview", () => {
    const access = { type: "grant", clientSlug: "demo" } as const
    expect(resolvePreviewNavigationTarget({ access, pages, href: "/unknown", origin: "https://preview.test" })).toBeNull()
  })
})
