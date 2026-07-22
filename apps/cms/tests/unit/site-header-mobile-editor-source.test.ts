import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (path: string) => readFileSync(path, "utf8")

describe("site header mobile page editor chrome", () => {
  it("hides the sidebar nav trigger on mobile page editor routes only", () => {
    const siteHeader = read("src/components/layout/SiteHeader.tsx")

    expect(siteHeader).toContain('"use client"')
    expect(siteHeader).toContain('import { usePathname } from "next/navigation"')
    expect(siteHeader).toContain("function isPageEditorPath")
    expect(siteHeader).toContain('/^\\/pages\\/(?:new|\\d+|edit\\/[^/]+)$/.test(pathname)')
    expect(siteHeader).toContain('/^\\/sites\\/[^/]+\\/pages\\/(?:new|\\d+|edit\\/[^/]+)$/.test(pathname)')
    expect(siteHeader).toContain("const onPageEditor = isPageEditorPath(pathname)")
    expect(siteHeader).toContain("const hideMobileNavTrigger = onPageEditor")
    expect(siteHeader).toContain('const mobileNavClass = hideMobileNavTrigger ? "max-md:hidden" : undefined')
    expect(siteHeader).toContain("<SidebarTrigger />")
    expect(siteHeader).toContain('className={mobileNavClass}')
  })
})
