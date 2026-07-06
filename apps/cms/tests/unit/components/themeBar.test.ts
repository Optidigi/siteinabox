import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (path: string) => readFileSync(path, "utf8")

describe("ThemeBar controls", () => {
  it("keeps shape focused on radius and exposes density as its own theme control", () => {
    const themeBar = read("src/components/editor/theme/theme-bar.tsx")
    const radiusControl = read("src/components/editor/theme/radius-control.tsx")
    const pageForm = read("src/components/forms/PageForm.tsx")

    expect(themeBar).toContain('type Segment = "colors" | "fonts" | "shape" | "density"')
    expect(themeBar).toContain("DensityControl")
    expect(themeBar).toContain("densityLevels")
    expect(themeBar).not.toContain("stylePresetLevels")
    expect(pageForm).toContain("densityLevels={DENSITY_PRESETS}")
    expect(pageForm).not.toContain("stylePresetLevels={STYLE_PRESETS}")
    expect(radiusControl).toContain("export const ShapeControl")
    expect(radiusControl).toContain("export const DensityControl")
    expect(radiusControl).toContain("shapeId")
    expect(radiusControl).toContain("densityId")
  })

  it("uses functional theme updates so quick toolbar patches merge with the latest state", () => {
    const themeBar = read("src/components/editor/theme/theme-bar.tsx")

    expect(themeBar).toContain("React.Dispatch<React.SetStateAction<ThemeTokens | null>>")
    expect(themeBar).toContain("onThemeChange((current) => normalizeThemeForSave")
  })
})
