import { describe, expect, it } from "vitest"
import { toCssVars } from "@/lib/theme/toCssVars"
import { DEFAULT_THEME_TOKEN_SPEC } from "@siteinabox/contracts"

describe("toCssVars", () => {
  it("resolves missing themes to canonical product defaults", () => {
    const css = toCssVars(undefined)

    expect(css).toContain(".rt-canvas{")
    expect(css).toContain("--primary:oklch(0.205 0 0)")
    expect(css).toContain("--background:oklch(1 0 0)")
    expect(css).not.toMatch(/--color-indigo-\d+:/)
    expect(css).not.toMatch(/--color-gray-\d+:/)
    expect(css).toContain("--siab-font-body:Geist Variable")
    expect(css).toContain("--font-sans:var(--siab-font-body)")
    expect(css).toContain("--siab-radius-3xl:1.5rem")
    expect(css).not.toContain("--site-density")
    expect(css).not.toContain("--site-section-padding")
    expect(css).not.toContain("--site-style-preset")
  })

  it("maps V3 preset IDs through approved token variables", () => {
    const css = toCssVars({
      version: 3,
      appearance: { mode: "dark" },
      colors: { schemeId: "emerald-calm" },
      fonts: { schemeId: "classic-editorial" },
      shape: { schemeId: "soft" },
    })

    expect(css).toContain("--color-accent:#059669")
    expect(css).toContain("--siab-accent-600:#059669")
    expect(css).toContain("--color-indigo-600:#059669")
    expect(css).toContain("--siab-font-heading:Fraunces Variable")
    expect(css).toContain("--font-heading:var(--siab-font-heading)")
    expect(css).toContain("--siab-radius-md:0.375rem")
    expect(css).toContain('.rt-canvas[data-rt-mode="dark"],html[data-siab-color-mode="dark"] .rt-canvas{')
  })

  it('emits :root scope when scope=":root"', () => {
    const css = toCssVars(DEFAULT_THEME_TOKEN_SPEC, ":root")

    expect(css).toContain("html:root{")
    expect(css).toContain('html:root[data-rt-mode="dark"],html:root[data-siab-color-mode="dark"]{')
    expect(css).not.toContain(".rt-canvas")
  })
})
