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

  it("renders mobile shuffle/default controls from approved theme presets only", () => {
    const themeBar = read("src/components/editor/theme/theme-bar.tsx")

    expect(themeBar).toContain("DEFAULT_THEME_TOKEN_SPEC")
    expect(themeBar).toContain("MOBILE_RANDOM_MODES")
    expect(themeBar).toContain("pickRandom(palettes)")
    expect(themeBar).toContain("pickRandom(fonts)")
    expect(themeBar).toContain("pickRandom(radiusLevels ?? [])")
    expect(themeBar).toContain("pickRandom(densityLevels ?? [])")
    expect(themeBar).toContain('className="flex justify-center py-2 md:hidden"')
    expect(themeBar).toContain("<Dices")
    expect(themeBar).toContain("<RotateCcw")
    expect(themeBar).toContain('t("shuffle")')
    expect(themeBar).toContain('t("default")')
    expect(themeBar).toContain('className="hidden md:block"')
    expect(themeBar).toContain('size="lg"')
    expect(themeBar).toContain("onPointerDownOutside={() => setOpenSegment(null)}")
    expect(themeBar).toContain("onFocusOutside={() => setOpenSegment(null)}")
  })

  it("mounts the page-editor ThemeBar on desktop only", () => {
    const pageForm = read("src/components/forms/PageForm.tsx")

    expect(pageForm).toContain("{!readOnly && isDesktop && (")
    expect(pageForm).toContain("desktop editor only")
    expect(pageForm).toContain('className="sticky top-[6.5rem] z-20 flex justify-center pointer-events-none"')
    expect(pageForm).not.toContain('className={`sticky z-20 flex justify-center pointer-events-none ${isDesktop ? "top-[6.5rem]" : "top-0"}`}')
  })
})
