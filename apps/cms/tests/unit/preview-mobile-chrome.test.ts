import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const root = join(__dirname, "..", "..")
const read = (file: string) => readFileSync(join(root, file), "utf8")

describe("preview mobile chrome", () => {
  it("stacks edit above launch at bottom-right with a left-aligned theme bar", () => {
    const chrome = read("src/components/preview/preview-mobile-chrome.tsx")
    const themeBar = read("src/components/preview/preview-mobile-theme-bar.tsx")
    const tone = read("src/components/preview/preview-mobile-chrome-tone.ts")

    expect(chrome).toContain("PreviewMobileChrome")
    expect(chrome).toContain("MobileFloatingPill")
    expect(chrome).toContain('surface="theme"')
    expect(chrome).toContain("previewMobileChromeWrapperClass")
    expect(chrome).toContain('position="bottom-right"')
    expect(chrome).toContain("PREVIEW_MOBILE_CHROME_STACK_OFFSET")
    expect(chrome).toContain("verticalOffset={PREVIEW_MOBILE_CHROME_STACK_OFFSET}")
    expect(chrome).not.toContain('position="top-left"')
    expect(chrome).not.toContain('position="top-right"')
    expect(chrome).toContain("SquarePen")
    expect(chrome).toContain("Rocket")
    expect(chrome).toContain("CheckCircle2")
    expect(chrome).toContain('variant="success"')
    expect(chrome.match(/\bcontrastBorder\b/g)?.length).toBeGreaterThanOrEqual(3)
    expect(chrome).toContain("PreviewMobileThemeBar")
    expect(chrome).toContain("md:hidden")

    expect(chrome.match(/verticalOffset=\{PREVIEW_MOBILE_CHROME_STACK_OFFSET\}/g)?.length).toBe(1)
    expect(chrome.indexOf("verticalOffset={PREVIEW_MOBILE_CHROME_STACK_OFFSET}")).toBeLessThan(
      chrome.indexOf('"data-mobile-preview-review"'),
    )
    expect(chrome.indexOf('"data-mobile-preview-review"')).toBeLessThan(
      chrome.indexOf('"data-mobile-preview-launch"'),
    )
    expect(chrome.indexOf('"data-mobile-preview-launch"')).toBeLessThan(
      chrome.indexOf('"data-mobile-preview-payment-complete"'),
    )
    expect(chrome).toContain('icon={<SquarePen')
    expect(chrome).toContain('icon={<Rocket')
    expect(chrome).toContain('icon={<CheckCircle2')

    expect(tone).toContain("previewMobileChromeToneClass")
    expect(tone).not.toContain("previewMobileChromeShineColor")
    expect(tone).toContain("resolveColorMode")
    expect(tone).toContain("systemPrefersDark")
    expect(tone).toContain("preview-mobile-chrome-light")
    expect(tone).toContain("PREVIEW_MOBILE_CHROME_STACK_OFFSET")
    expect(tone).toContain('"4rem"')

    expect(themeBar).toContain("MobileInlinePill")
    expect(themeBar).toContain("contrastBorder")

    const floatingPill = read("src/components/common/mobile-floating-pill.tsx")
    const inlinePill = read("src/components/common/mobile-inline-pill.tsx")
    for (const pill of [floatingPill, inlinePill]) {
      expect(pill).toContain('contrastBorder && "border-foreground"')
      expect(pill).not.toContain("ShineBorder")
    }
    expect(floatingPill).toContain("verticalOffset")
    expect(floatingPill).toContain("edgeVerticalOffset")
    expect(themeBar).toContain("justify-start gap-3")
    expect(themeBar).not.toContain("justify-center gap-3")
    expect(themeBar).not.toContain("justify-between")
    expect(themeBar).toContain("pointer-events-none absolute top-0 left-0 h-px w-px")
    expect(themeBar).not.toContain("left-1/2")
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
    expect(themeBar).toContain('align="start"')
    expect(themeBar).not.toContain('align="center"')
    expect(themeBar).toContain("md:hidden")
    expect(themeBar).toContain("PREVIEW_THEME_TOOLBAR_CLOSE_EVENT")
    expect(themeBar).toContain("@/lib/preview/preview-theme-events")
    expect(themeBar).toContain("previewMobileChromeToneClass")
  })
})
