import { describe, expect, it } from "vitest"
import { toCssVars } from "@/lib/theme/toCssVars"

describe("toCssVars", () => {
  it("resolves missing themes to Tailwind default CSS variables", () => {
    const css = toCssVars(undefined)

    expect(css).toContain(".rt-canvas{")
    expect(css).toContain("--color-indigo-600:#4f46e5")
    expect(css).toContain("--color-gray-900:#111827")
    expect(css).toContain("--font-sans:Inter Variable")
    expect(css).toContain("--radius-3xl:1.5rem")
    expect(css).toContain("--site-section-padding-y:6rem")
    expect(css).toContain('.rt-canvas[data-rt-mode="dark"]{')
  })

  it("treats null and empty CMS themes as Tailwind defaults", () => {
    expect(toCssVars(null)).toContain("--color-indigo-600:#4f46e5")
    expect(toCssVars({})).toContain("--color-indigo-600:#4f46e5")
    expect(toCssVars({ palette: {}, fonts: {} })).toContain("--color-indigo-600:#4f46e5")
  })

  it("maps legacy CMS palette values into the resolved provider bridge", () => {
    const css = toCssVars({
      palette: { accent: "#111", bg: "#222", ink: "#333", muted: "#444" },
    })

    expect(css).toContain("--color-accent:#111")
    expect(css).toContain("--color-on-accent:#ffffff")
    expect(css).toContain("--color-bg:#222")
    expect(css).toContain("--color-ink:#333")
    expect(css).toContain("--color-ink-muted:#444")
    expect(css).toContain("--color-indigo-50:#111")
    expect(css).toContain("--color-indigo-600:#111")
  })

  it("maps supported legacy CMS font roles and compatibility aliases", () => {
    const css = toCssVars({
      fonts: { title: "Inter", heading: "Georgia", text: "Dancing Script", script: "Caveat Variable" },
    })

    expect(css).toContain("--font-title:Inter")
    expect(css).toContain("--font-heading:Georgia")
    expect(css).toContain("--font-text:Dancing Script")
    expect(css).toContain("--font-sans:Dancing Script")
    expect(css).toContain("--font-serif:Georgia")
    expect(css).not.toContain("--font-script:")
  })

  it("maps legacy radius to the full Tailwind Plus radius bridge", () => {
    const css = toCssVars({ radius: "4px", borderStyle: "dashed" })

    expect(css).toContain("--radius-none:0")
    expect(css).toContain("--radius-sm:4px")
    expect(css).toContain("--radius-md:4px")
    expect(css).toContain("--radius-lg:4px")
    expect(css).toContain("--radius-xl:4px")
    expect(css).toContain("--radius-2xl:4px")
    expect(css).toContain("--radius-3xl:4px")
    expect(css).toContain("--radius-full:9999px")
    expect(css).not.toContain("--border-style:")
  })

  it("maps legacy density and sanitized style preset compatibility", () => {
    const css = toCssVars({ density: "spacious", stylePreset: "bold" })

    expect(css).toContain("--site-density:comfortable")
    expect(css).toContain("--site-section-padding-y:7rem")
    expect(css).toContain("--site-section-padding-y-sm:9rem")
    expect(css).toContain("--site-inter-block-gap:0")
    expect(css).toContain("--site-style-preset:bold")
    expect(css).toContain(':where([data-provider-block="tailwindplus"]):is(.py-24,.py-32)')
  })

  it("emits a dark overlay rule using darkPalette when provided", () => {
    const css = toCssVars({
      palette: { accent: "#3b82f6", bg: "#f8fafc", ink: "#1e293b", muted: "#64748b" },
      darkPalette: { accent: "#60a5fa", bg: "#0f172a", ink: "#e2e8f0", muted: "#94a3b8" },
    })

    expect(css).toContain(".rt-canvas{")
    expect(css).toContain("--color-accent:#3b82f6")
    expect(css).toContain('.rt-canvas[data-rt-mode="dark"]{')
    expect(css).toContain("--color-accent:#60a5fa")
    expect(css).toContain("--color-bg:#0f172a")
    expect(css).toContain("--color-ink:#e2e8f0")
  })

  it('emits :root scope when scope=":root"', () => {
    const css = toCssVars({ palette: { accent: "#f00" }, radius: "0.5rem" }, ":root")

    expect(css).toContain(":root{")
    expect(css).toContain('[data-rt-mode="dark"]{')
    expect(css).not.toContain(".rt-canvas")
    expect(css).toContain("--color-accent:#f00")
    expect(css).toContain("--radius-md:0.5rem")
  })
})
