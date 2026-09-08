import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (path: string) => readFileSync(path, "utf8")

describe("site header mobile page editor chrome", () => {
  it("shows a header menu button on mobile except on page-editor routes", () => {
    const siteHeader = read("src/components/layout/SiteHeader.tsx")

    expect(siteHeader).toContain('"use client"')
    expect(siteHeader).toContain("export function isPageEditorPath")
    expect(siteHeader).toContain("const onPageEditor = isPageEditorPath(pathname)")
    expect(siteHeader).toContain("<SidebarTrigger")
    expect(siteHeader).toContain('className="md:hidden"')
    expect(siteHeader).toContain("{!onPageEditor ? (")
    expect(siteHeader).not.toContain("SidebarPeekTrigger")
    expect(siteHeader).toContain("h-16 items-center")
    expect(siteHeader).not.toContain("h-14")
    expect(siteHeader).toContain('onPageEditor ? "hidden min-[1280px]:block"')
  })
})
