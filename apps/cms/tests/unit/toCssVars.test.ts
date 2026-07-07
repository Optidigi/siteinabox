import { describe, expect, it } from "vitest"
import { toCssVars } from "@/lib/theme/toCssVars"
import { DEFAULT_THEME_TOKEN_SPEC } from "@siteinabox/contracts"

describe("toCssVars", () => {
  it("resolves missing themes to product V2 defaults", () => {
    const css = toCssVars(undefined)

    expect(css).toContain(".rt-canvas{")
    expect(css).toContain("--color-accent:#2563eb")
    expect(css).toContain("--siab-accent-600:#2563eb")
    expect(css).toContain("--siab-neutral-900:#111827")
    expect(css).not.toMatch(/--color-indigo-\d+:/)
    expect(css).not.toMatch(/--color-gray-\d+:/)
    expect(css).toContain("--font-sans:Inter Variable")
    expect(css).toContain("--radius-3xl:1.5rem")
    expect(css).toContain("--site-density:comfortable")
    expect(css).not.toContain("--site-style-preset")
  })

  it("maps V2 preset IDs through approved token variables", () => {
    const css = toCssVars({
      version: 2,
      appearance: { mode: "dark" },
      colors: { schemeId: "emerald-calm" },
      fonts: { schemeId: "classic-editorial" },
      shape: { schemeId: "soft" },
      density: { schemeId: "spacious" },
    })

    expect(css).toContain("--color-accent:#059669")
    expect(css).toContain("--siab-accent-600:#059669")
    expect(css).not.toMatch(/--color-indigo-\d+:/)
    expect(css).toContain("--font-heading:Fraunces Variable")
    expect(css).toContain("--radius-md:0.375rem")
    expect(css).toContain("--site-density:spacious")
    expect(css).toContain("--site-section-padding-y:8rem")
    expect(css).toContain('.rt-canvas[data-rt-mode="dark"]{')
  })

  it('emits :root scope when scope=":root"', () => {
    const css = toCssVars(DEFAULT_THEME_TOKEN_SPEC, ":root")

    expect(css).toContain("html:root{")
    expect(css).toContain('html:root[data-rt-mode="dark"]{')
    expect(css).not.toContain(".rt-canvas")
  })
})
