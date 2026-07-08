import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const root = join(__dirname, "..", "..")
const read = (file: string) => readFileSync(join(root, file), "utf8")

describe("preview desktop theme toolbar", () => {
  it("renders inline theme controls for desktop preview without popovers", () => {
    const toolbar = read("src/components/preview/preview-desktop-theme-toolbar.tsx")
    const customizer = read("src/components/preview/PreviewCustomizer.tsx")

    expect(toolbar).toContain("PreviewDesktopThemeToolbar")
    expect(toolbar).toContain('layout="inline"')
    expect(toolbar).toContain('layout="pill"')
    expect(toolbar).toContain('layout="glyph"')
    expect(toolbar).toContain('layout="spacing"')
    expect(toolbar).toContain("PalettePicker")
    expect(toolbar).toContain("ShapeControl")
    expect(toolbar).toContain("FontPicker")
    expect(toolbar).toContain("DensityControl")
    expect(toolbar).toContain("Separator")
    expect(toolbar).toContain("PREVIEW_DESKTOP_INLINE_CONTROL_SIZE")
    expect(toolbar).toContain("hidden md:inline-flex")
    expect(toolbar).not.toContain("Popover")

    expect(customizer).toContain("PreviewDesktopThemeToolbar")
    expect(customizer).not.toContain("PreviewThemeToolbar")
    expect(customizer).not.toContain("<SegmentedPill")
    expect(customizer).not.toContain("PopoverContent")
  })
})
