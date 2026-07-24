import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (path: string) => readFileSync(path, "utf8")

describe("page-editor theme toolbar", () => {
  it("exposes only color, font and shape controls", () => {
    const themeBar = read("src/components/editor/theme/editor-theme-toolbar.tsx")
    const radiusControl = read("src/components/editor/theme/radius-control.tsx")
    const pageForm = read("src/components/forms/PageForm.tsx")

    expect(themeBar).toContain('type Segment = "colors" | "fonts" | "shape"')
    expect(themeBar).not.toContain("DensityControl")
    expect(themeBar).not.toContain("densityLevels")
    expect(themeBar).not.toContain("stylePresetLevels")
    expect(pageForm).not.toContain("DENSITY_PRESETS")
    expect(pageForm).not.toContain("stylePresetLevels={STYLE_PRESETS}")
    expect(radiusControl).toContain("export const ShapeControl")
    expect(radiusControl).not.toContain("export const DensityControl")
    expect(radiusControl).toContain("shapeId")
    expect(radiusControl).not.toContain("densityId")
  })

  it("uses functional theme updates so quick toolbar patches merge with the latest state", () => {
    const themeBar = read("src/components/editor/theme/editor-theme-toolbar.tsx")

    expect(themeBar).toContain("React.Dispatch<React.SetStateAction<ThemeTokens | null>>")
    expect(themeBar).toContain("onThemeChange((current) => normalizeThemeForSave")
  })

  it("renders mobile shuffle/default controls from approved theme presets only", () => {
    const themeBar = read("src/components/editor/theme/editor-theme-toolbar.tsx")

    expect(themeBar).toContain("DEFAULT_THEME_TOKEN_SPEC")
    expect(themeBar).toContain("MOBILE_RANDOM_MODES")
    expect(themeBar).toContain("pickRandom(palettes)")
    expect(themeBar).toContain("pickRandom(fonts)")
    expect(themeBar).toContain("pickRandom(radiusLevels ?? [])")
    expect(themeBar).not.toContain("densityLevels")
    expect(themeBar).toContain('className="flex justify-center py-2 md:hidden"')
    expect(themeBar).toContain("<Dices")
    expect(themeBar).toContain("<RotateCcw")
    expect(themeBar).toContain('t("shuffle")')
    expect(themeBar).toContain('t("default")')
    expect(themeBar).toContain('className="hidden md:block"')
    expect(themeBar).not.toContain('size="lg"')
    expect(themeBar).toContain("onClick={() => setOpenSegment((current) => (current === segment ? null : segment))}")
    expect(themeBar).toContain("onPointerDownOutside={() => setOpenSegment(null)}")
    expect(themeBar).toContain("onFocusOutside={() => setOpenSegment(null)}")
  })

  it("mounts and centers the page-editor toolbar over the canvas column only", () => {
    const pageForm = read("src/components/forms/PageForm.tsx")

    expect(pageForm).toContain("{!readOnly && isDesktop && (")
    expect(pageForm).toContain("EditorThemeToolbar")
    expect(pageForm).toContain('className="pointer-events-none sticky top-[6.5rem] z-20 grid w-full grid-cols-[minmax(0,1fr)_360px] gap-3"')
    expect(pageForm).toContain('className="pointer-events-auto flex justify-center"')
    expect(pageForm).not.toContain("SegmentedPill")
    expect(pageForm).not.toContain("FLOATING_PILL_CLASS")
    expect(pageForm).not.toContain('className={`sticky z-20 flex justify-center pointer-events-none ${isDesktop ? "top-[6.5rem]" : "top-0"}`}')
  })

  it("uses the shared soft-corner container without coupling preview or mobile toolbars", () => {
    const themeBar = read("src/components/editor/theme/editor-theme-toolbar.tsx")
    const floatingPill = read("src/components/editor/floating-pill.ts")
    const navigation = read("src/components/navigation/NavigationManager.tsx")
    const settings = read("src/components/forms/SettingsForm.tsx")
    const desktopPreview = read("src/components/preview/preview-desktop-theme-toolbar.tsx")
    const mobilePreview = read("src/components/preview/preview-mobile-theme-bar.tsx")
    const mobileFloatingPill = read("src/components/common/mobile-floating-pill.tsx")

    expect(floatingPill).toContain('"rounded-lg border border-border/80')
    expect(floatingPill).not.toContain('"rounded-full border border-border/80')
    expect(themeBar).toContain('className={cn(FLOATING_PILL_CLASS, "inline-flex")}')
    expect(themeBar).toContain("inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 p-0.5")
    expect(themeBar).toContain('className="rounded-lg border border-border bg-background/95 p-1 shadow-lg backdrop-blur-sm"')
    expect(navigation).toContain('className={cn(FLOATING_PILL_CLASS, "inline-flex")}')
    expect(settings).toContain('className={cn(FLOATING_PILL_CLASS, "inline-flex")}')
    expect(desktopPreview).not.toContain("FLOATING_PILL_CLASS")
    expect(mobilePreview).not.toContain("FLOATING_PILL_CLASS")
    expect(mobileFloatingPill).not.toContain("FLOATING_PILL_CLASS")
  })
})
