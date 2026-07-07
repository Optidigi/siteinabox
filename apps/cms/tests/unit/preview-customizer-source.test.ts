import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

describe("preview customizer source contract", () => {
  it("hosts customer preview through an embedded renderer iframe contract", () => {
    const componentSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/components/preview/PreviewCustomizer.tsx"),
      "utf8",
    )
    const routeSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/(frontend)/(site-preview)/preview/[token]/page.tsx"),
      "utf8",
    )

    expect(componentSource).toContain("/renderer-frame/preview/")
    expect(componentSource).toContain("data-siab-renderer-frame")
    expect(componentSource).toMatch(/<iframe\b/i)
    expect(componentSource.includes("@/components/editor/canvas/CanvasMode")).toBe(false)
    expect(componentSource.includes("<CanvasMode")).toBe(false)
    expect(componentSource).toContain("@siteinabox/contracts")
    expect(componentSource).toContain("IFRAME_EDITOR_PROTOCOL_NAME")
    expect(componentSource).toContain('type: "page.replace"')
    expect(componentSource).toContain('type: "theme.patch"')
    expect(componentSource).not.toContain("siab.renderer.")
    expect(componentSource).toContain("theme={themeState}")
    expect(componentSource).toContain("onThemeChange={handleThemeChange}")
    expect(componentSource).toContain("onShuffleTheme={handleShuffleTheme}")
    expect(componentSource).toContain("onDefaultTheme={handleDefaultTheme}")
    expect(componentSource).toContain("grid-cols-[1fr_auto_1fr]")
    expect(componentSource).toContain("justify-self-start")
    expect(componentSource).toContain("justify-self-end")
    expect(componentSource).toContain("<SegmentedPill<PreviewThemeSegment>")
    expect(componentSource).toContain("PalettePicker")
    expect(componentSource).toContain("FontPicker")
    expect(componentSource).toContain("ShapeControl")
    expect(componentSource).toContain("DensityControl")
    expect(componentSource).toContain("side=\"top\"")
    expect(componentSource).toContain('ariaLabel={previewT("themeControls")}')
    expect(componentSource).toContain("<Dices")
    expect(componentSource).toContain("<RotateCcw")
    expect(componentSource).toContain("radiusLevels={RADIUS_PRESETS}")
    expect(componentSource).toContain("levels={DENSITY_PRESETS}")
    expect(componentSource).not.toContain("stylePresetLevels={STYLE_PRESETS}")
    expect(componentSource.includes('view="preview"')).toBe(false)
    expect(componentSource).not.toContain('aria-label={t("pagesNav")}')
    expect(componentSource).toContain('access.type === "grant"')
    expect(componentSource).toContain('const checkoutHref = access.type === "grant" ? `/${access.clientSlug}/checkout` : "#"')
    expect(componentSource).toContain('const reviewHref = access.type === "grant" ? `/${access.clientSlug}/review` : "#"')
    expect(componentSource).toContain("checkoutHref={checkoutHref}")
    expect(componentSource).toContain("reviewHref={reviewHref}")
    expect(componentSource).toContain('t("launchWebsite")')
    expect(componentSource).toContain('t("paymentComplete")')
    expect(componentSource).toContain("paymentSatisfied={paymentSatisfied}")
    expect(componentSource).toContain("<CheckCircle2")
    expect(componentSource).toContain('t("reviewChanges")')
    expect(componentSource).toContain("paymentState?.status")
    expect(componentSource).not.toContain("Approve & Pay")
    expect(componentSource).not.toContain('t("approvePreview")')
    expect(componentSource.includes("@siteinabox/site-renderer")).toBe(false)
    expect(/<iframe\b/i.test(routeSource)).toBe(false)
  })
})
