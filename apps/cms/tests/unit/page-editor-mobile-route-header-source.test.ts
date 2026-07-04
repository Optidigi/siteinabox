import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(process.cwd(), process.cwd().endsWith(`${path.sep}apps${path.sep}cms`) ? "../.." : ".")

function read(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8")
}

describe("page editor mobile route header source contract", () => {
  it("hides the page title route header on mobile editor routes", () => {
    const routes = [
      "apps/cms/src/app/(frontend)/(admin)/pages/[id]/page.tsx",
      "apps/cms/src/app/(frontend)/(admin)/pages/new/page.tsx",
      "apps/cms/src/app/(frontend)/(admin)/sites/[slug]/pages/[id]/page.tsx",
      "apps/cms/src/app/(frontend)/(admin)/sites/[slug]/pages/new/page.tsx",
    ]

    for (const route of routes) {
      const source = read(route)
      expect(source).toContain('<div className="max-md:hidden">')
      expect(source).toContain("<PageHeader")
      expect(source.indexOf('<div className="max-md:hidden">')).toBeLessThan(source.indexOf("<PageHeader"))
      expect(source.indexOf("<PageHeader")).toBeLessThan(source.indexOf("<PageForm"))
    }
  })
})
