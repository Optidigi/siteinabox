import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const root = join(__dirname, "..", "..")
const read = (file: string) => readFileSync(join(root, file), "utf8")

describe("preview mobile chrome", () => {
  it("uses corner nav pills and a bottom theme bar on phone preview", () => {
    const chrome = read("src/components/preview/preview-mobile-chrome.tsx")
    const themeBar = read("src/components/preview/preview-mobile-theme-bar.tsx")
    const tone = read("src/components/preview/preview-mobile-chrome-tone.ts")

    expect(chrome).toContain("PreviewMobileChrome")
    expect(chrome).toContain("MobileFloatingPill")
    expect(chrome).toContain('surface="theme"')
    expect(chrome).toContain("previewMobileChromeWrapperClass")
    expect(chrome).toContain('position="top-left"')
    expect(chrome).toContain('position="top-right"')
    expect(chrome).toContain("SquarePen")
    expect(chrome).toContain("Rocket")
    expect(chrome).toContain("CheckCircle2")
    expect(chrome).toContain('variant="success"')
    expect(chrome.match(/\bshine\b/g)?.length).toBeGreaterThanOrEqual(3)
    expect(chrome).toContain("PreviewMobileThemeBar")
    expect(chrome).toContain("md:hidden")

    expect(tone).toContain("previewMobileChromeToneClass")
    expect(tone).toContain("previewMobileChromeShineColor")
    expect(tone).toContain('=== "dark" ? "black" : "white"')
    expect(tone).toContain('=== "light" ? "dark"')
    expect(tone).toContain("preview-mobile-chrome-light")

    expect(themeBar).toContain("MobileInlinePill")
    expect(themeBar).toContain("shine")
    expect(themeBar).toContain("shineColor={shineColor}")

    const floatingPill = read("src/components/common/mobile-floating-pill.tsx")
    const inlinePill = read("src/components/common/mobile-inline-pill.tsx")
    for (const pill of [floatingPill, inlinePill]) {
      expect(pill).toContain("borderWidth={2}")
      expect(pill).toContain("duration={10}")
      expect(pill).toContain("shineColor, shineColor, shineColor")
    }
    expect(themeBar).toContain("justify-center gap-3")
    expect(themeBar).not.toContain("justify-between")
    expect(themeBar).toContain("pointer-events-none absolute top-0 left-1/2 h-px w-px")
    const popoverAnchorBlock = themeBar.match(/<PopoverAnchor[\s\S]*?<\/PopoverAnchor>/)?.[0] ?? ""
    expect(popoverAnchorBlock).not.toContain("MobileInlinePill")
    expect(themeBar).toContain("isThemePillTarget")
    expect(themeBar).toContain("PREVIEW_MOBILE_CHROME_INSET")
    expect(themeBar).toContain("data-mobile-preview-theme-pill")
    expect(themeBar).toContain("PalettePicker")
    expect(themeBar).toContain('layout="mobile"')
    expect(themeBar).toContain('layout="glyph"')
    expect(themeBar).toContain("FontPicker")
    expect(themeBar).toContain("ShapeControl")
    expect(themeBar).toContain('layout="pill"')
    expect(themeBar).not.toContain("DensityControl")
    expect(themeBar).not.toContain('"density"')
    expect(themeBar).toContain("rounded-2xl")
    expect(themeBar).toContain("justify-center")
    expect(themeBar).toContain('side="top"')
    expect(themeBar).toContain("md:hidden")
    expect(themeBar).toContain("PREVIEW_THEME_TOOLBAR_CLOSE_EVENT")
    expect(themeBar).toContain("@/lib/preview/preview-theme-events")
    expect(themeBar).toContain("previewMobileChromeToneClass")
  })
})
