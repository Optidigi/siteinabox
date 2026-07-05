import { describe, expect, it } from "vitest"
import { toCssVars } from "@/lib/theme/toCssVars"

describe("toCssVars", () => {
  it("returns empty string for undefined", () => {
    expect(toCssVars(undefined)).toBe("")
  })

  it("returns empty string for null", () => {
    expect(toCssVars(null)).toBe("")
  })

  it("returns empty string for empty object", () => {
    expect(toCssVars({})).toBe("")
  })

  it("returns empty string for object with all-empty sub-objects", () => {
    expect(toCssVars({ palette: {}, fonts: {} })).toBe("")
  })

  it("does NOT emit role tokens when fonts.* is unset/empty (OBS-46)", () => {
    // Falling back to var(--font-serif) etc. would resolve to ui-serif system
    // inside .rt-canvas (raw tenant CSS bundle). Tokens stay unset so canvas
    // elements inherit the admin chrome font cascade until OBS-46 ships the
    // compiled tenant CSS.
    const css = toCssVars({ fonts: { title: "", heading: undefined, text: "" } })
    expect(css).not.toContain("--font-title")
    expect(css).not.toContain("--font-heading")
    expect(css).not.toContain("--font-text")
    expect(css).not.toContain("--font-sans:")
    expect(css).not.toContain("--font-serif")
  })

  it("produces a .rt-canvas rule with mapped custom properties", () => {
    const css = toCssVars({
      palette: { accent: "#f00" },
      fonts: { title: "Inter" },
      radius: "0.5rem",
    })
    expect(css).toContain(".rt-canvas")
    expect(css).toContain("--color-accent:#f00")
    expect(css).toContain("--color-on-accent:#ffffff")
    expect(css).toContain("--font-title:Inter")
    expect(css).toContain("--radius-md:0.5rem")
  })

  it("maps all palette keys", () => {
    const css = toCssVars({
      palette: { accent: "#111", bg: "#222", ink: "#333", muted: "#444" },
    })
    expect(css).toContain("--color-accent:#111")
    expect(css).toContain("--color-bg:#222")
    expect(css).toContain("--color-ink:#333")
    expect(css).toContain("--color-ink-muted:#444")
  })

  it("maps all font keys", () => {
    const css = toCssVars({
      fonts: { title: "Inter", heading: "Georgia", text: "Dancing Script" },
    })
    expect(css).toContain("--font-title:Inter")
    expect(css).toContain("--font-heading:Georgia")
    expect(css).toContain("--font-text:Dancing Script")
    expect(css).toContain("--font-sans:Dancing Script")
    expect(css).toContain("--font-serif:Georgia")
  })

  it("maps radius and borderStyle", () => {
    const css = toCssVars({ radius: "4px", borderStyle: "dashed" })
    expect(css).toContain("--radius-md:4px")
    expect(css).toContain("--border-style:dashed")
  })

  it("maps density and style preset", () => {
    const css = toCssVars({ density: "spacious", stylePreset: "bold" })
    expect(css).toContain("--site-density:spacious")
    expect(css).toContain("--site-section-padding-y:7rem")
    expect(css).toContain("--site-section-padding-y-sm:9rem")
    expect(css).toContain("--site-style-preset:bold")
    expect(css).toContain(':where([data-provider-block="tailwindplus"]):is(.py-24,.py-32)')
  })

  it("does NOT emit unset properties", () => {
    const css = toCssVars({ palette: { accent: "#f00" } })
    expect(css).not.toContain("--font-title")
    expect(css).not.toContain("--radius-md")
    expect(css).not.toContain("--border-style")
    expect(css).not.toContain("--color-bg")
  })

  it("only emits set palette sub-keys, not absent ones", () => {
    const css = toCssVars({ palette: { accent: "#f00" } })
    expect(css).toContain("--color-accent:#f00")
    expect(css).not.toContain("--color-ink")
    expect(css).not.toContain("--color-ink-muted")
  })
})

describe("toCssVars (round 4)", () => {
  it("emits --font-title/--font-heading/--font-text from fonts roles", () => {
    const css = toCssVars({
      fonts: { title: "Pacifico", heading: "Playfair Display", text: "Geist" },
    })
    expect(css).toContain("--font-title:Pacifico")
    expect(css).toContain("--font-heading:Playfair Display")
    expect(css).toContain("--font-text:Geist")
    expect(css).toContain("--font-sans:Geist")
    expect(css).toContain("--font-serif:Playfair Display")
  })

  it("emits compatibility --font-serif from title when heading is unset", () => {
    const css = toCssVars({ fonts: { title: "Fraunces Variable" } })
    expect(css).toContain("--font-title:Fraunces Variable")
    expect(css).toContain("--font-serif:Fraunces Variable")
    expect(css).not.toContain("--font-sans:")
    expect(css).not.toContain("--font-heading:")
  })

  it("emits --font-script role and alias when script font is set", () => {
    const css = toCssVars({ fonts: { script: "Caveat Variable" } })
    expect(css).toContain("--font-script:Caveat Variable")
  })

  it("emits --radius-sm and --radius-lg derived from theme.radius", () => {
    const css = toCssVars({ radius: "0.5rem" })
    expect(css).toContain("--radius-md:0.5rem")
    expect(css).toContain("--radius-sm:0.25rem") // 0.5 - 0.25
    expect(css).toContain("--radius-lg:1rem")    // 0.5 + 0.5
    expect(css).toContain("--radius-xl:1.25rem")
    expect(css).toContain("--radius-2xl:1.5rem")
    expect(css).toContain("--radius-3xl:2rem")
    expect(css).toContain("--radius-4xl:2.5rem")
  })

  it("clamps --radius-sm at 0 when theme.radius is small", () => {
    const css = toCssVars({ radius: "0" })
    expect(css).toContain("--radius-sm:0")
  })

  it("collapses every derived Tailwind radius var for the square shape", () => {
    const css = toCssVars({ radius: "0" })
    for (const prop of [
      "--radius-none",
      "--radius-xs",
      "--radius-sm",
      "--radius-md",
      "--radius-lg",
      "--radius-xl",
      "--radius-2xl",
      "--radius-3xl",
      "--radius-4xl",
    ]) {
      expect(css).toContain(`${prop}:0`)
    }
  })

  it("emits a [data-rt-mode='dark'] overlay rule when darkPalette is set", () => {
    const css = toCssVars({
      palette: { accent: "#3b82f6", bg: "#f8fafc", ink: "#1e293b", muted: "#64748b" },
      darkPalette: { accent: "#60a5fa", bg: "#0f172a", ink: "#e2e8f0", muted: "#94a3b8" },
    })
    expect(css).toContain(".rt-canvas{")
    expect(css).toContain("--color-accent:#3b82f6")
    expect(css).toContain('.rt-canvas[data-rt-mode="dark"]{')
    expect(css).toContain("--color-accent:#60a5fa")
    expect(css).toContain("--color-bg:#0f172a")
  })

  it("emits no overlay block when darkPalette is unset", () => {
    const css = toCssVars({
      palette: { accent: "#3b82f6", bg: "#f8fafc", ink: "#1e293b", muted: "#64748b" },
    })
    expect(css).not.toContain('[data-rt-mode="dark"]')
  })
})

describe("toCssVars (scope param)", () => {
  it('defaults to .rt-canvas scope', () => {
    const css = toCssVars({ palette: { accent: "#f00" } })
    expect(css).toContain(".rt-canvas{")
  })

  it('emits :root scope when scope=":root"', () => {
    const css = toCssVars({ palette: { accent: "#f00" } }, ":root")
    expect(css).toContain(":root{")
    expect(css).not.toContain(".rt-canvas")
  })

  it('emits [data-rt-mode="dark"] without class prefix when scope=":root"', () => {
    const css = toCssVars(
      {
        palette: { accent: "#f00", bg: "#fff", ink: "#000", muted: "#999" },
        darkPalette: { accent: "#60a5fa", bg: "#0f172a", ink: "#e2e8f0", muted: "#94a3b8" },
      },
      ":root"
    )
    expect(css).toContain(':root{')
    expect(css).toContain('[data-rt-mode="dark"]{')
    expect(css).not.toContain('.rt-canvas[data-rt-mode')
  })

  it('still emits correct custom property values under :root scope', () => {
    const css = toCssVars({ palette: { accent: "#abc" }, radius: "0.5rem" }, ":root")
    expect(css).toContain("--color-accent:#abc")
    expect(css).toContain("--radius-md:0.5rem")
  })
})
