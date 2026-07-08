import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const root = join(__dirname, "..", "..")
const read = (file: string) => readFileSync(join(root, file), "utf8")

describe("preview mobile chrome", () => {
  it("uses corner nav pills and a bottom theme bar on phone preview", () => {
    const chrome = read("src/components/preview/preview-mobile-chrome.tsx")
    const themeBar = read("src/components/preview/preview-mobile-theme-bar.tsx")

    expect(chrome).toContain("PreviewMobileChrome")
    expect(chrome).toContain("MobileFloatingPill")
    expect(chrome).toContain('position="top-left"')
    expect(chrome).toContain('position="top-right"')
    expect(chrome).toContain("SquarePen")
    expect(chrome).toContain("Rocket")
    expect(chrome).toContain("CheckCircle2")
    expect(chrome).toContain('variant="success"')
    expect(chrome).toContain("PreviewMobileThemeBar")
    expect(chrome).toContain("md:hidden")

    expect(themeBar).toContain("SegmentedPill")
    expect(themeBar).toContain('labelBreakpoint="md"')
    expect(themeBar).toContain("PalettePicker")
    expect(themeBar).toContain('layout="row"')
    expect(themeBar).toContain("FontPicker")
    expect(themeBar).toContain("ShapeControl")
    expect(themeBar).toContain("DensityControl")
    expect(themeBar).toContain('side="top"')
    expect(themeBar).toContain("md:hidden")
    expect(themeBar).toContain("siab:preview-theme-toolbar-close")
  })
})
