import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const root = join(__dirname, "..", "..")
const read = (file: string) => readFileSync(join(root, file), "utf8")

describe("preview desktop theme toolbar", () => {
  it("renders inline theme controls for desktop preview without popovers", () => {
    const toolbar = read("src/components/preview/preview-desktop-theme-toolbar.tsx")
    const customizer = read("src/components/preview/PreviewCustomizer.tsx")
    const inlineGroup = read("src/components/common/inline-toolbar-group.tsx")
    const palettePicker = read("src/components/editor/theme/palette-picker.tsx")

    expect(toolbar).toContain("PreviewDesktopThemeToolbar")
    expect(toolbar).toContain('layout="inline"')
    expect(toolbar).toContain('layout="segment"')
    expect(toolbar).not.toContain("DensityControl")
    expect(toolbar).not.toContain("Separator")
    expect(toolbar).toContain("PalettePicker")
    expect(toolbar).toContain("ShapeControl")
    expect(toolbar).toContain("FontPicker")
    expect(toolbar).toContain("hidden md:inline-flex")
    expect(toolbar).not.toContain('layout="pill"')
    expect(toolbar).not.toContain('layout="glyph"')

    expect(inlineGroup).toContain("InlineToolbarGroup")
    expect(inlineGroup).toContain("InlineToolbarOption")
    expect(inlineGroup).toContain("bg-muted/30")
    expect(inlineGroup).toContain("rounded-md")
    expect(palettePicker).toContain("InlineToolbarGroup")
    expect(palettePicker).toContain('layout === "inline"')
    expect(palettePicker).toContain("rounded-full")
    expect(read("src/components/editor/theme/radius-control.tsx")).toContain('layout === "segment"')
    expect(read("src/components/editor/theme/font-picker.tsx")).toContain('layout === "segment"')
    expect(read("src/components/preview/PreviewCustomizer.tsx")).toContain("normalizePreviewThemeForSave")

    expect(customizer).toContain("PreviewDesktopThemeToolbar")
    expect(customizer).not.toContain("PreviewThemeToolbar")
    expect(customizer).not.toContain("<SegmentedPill")
    expect(customizer).not.toContain("PopoverContent")
  })
})
