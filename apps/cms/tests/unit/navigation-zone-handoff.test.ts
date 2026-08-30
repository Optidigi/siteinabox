import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (path: string) => readFileSync(path, "utf8")

describe("navigation zone handoff", () => {
  it("passes the requested zone from the route query into NavigationManager", () => {
    const page = read("src/app/(frontend)/(admin)/sites/[slug]/navigation/page.tsx")

    expect(page).toContain("searchParams?: Promise<{ zone?: string | string[] }>")
    expect(page).toContain('const initialZone: NavZone = zoneParam === "footer" ? "footer" : "navbar"')
    expect(page).toContain("initialZone={initialZone}")
  })

  it("uses the provided initial zone as the first selected navigation tab", () => {
    const manager = read("src/components/navigation/NavigationManager.tsx")

    expect(manager).toContain('initialZone = "navbar"')
    expect(manager).toContain("initialZone?: NavZone")
    expect(manager).toContain("const [zone, setZone] = React.useState<NavZone>(initialZone)")
  })

  it("keeps visible Dutch navigation zone labels literal as Navbar and Footer", () => {
    const nl = JSON.parse(read("src/locales/nl.json")) as {
      navigation: { header: string; footer: string }
      editor: { includeNavbarNavigation: string; includeFooterNavigation: string }
    }

    expect(nl.navigation.header).toBe("Navbar")
    expect(nl.navigation.footer).toBe("Footer")
    expect(nl.editor.includeNavbarNavigation).toContain("Navbar")
    expect(nl.editor.includeFooterNavigation).toContain("Footer")
    expect(nl.editor.includeNavbarNavigation).not.toContain("bovenmenu")
    expect(nl.editor.includeFooterNavigation).not.toContain("voetmenu")
  })
})
