import { describe, it, expect } from "vitest"
import { DENSITY_PRESETS, FONT_PRESETS, PALETTE_PRESETS, RADIUS_PRESETS, STYLE_PRESETS } from "@/lib/theme/presets"

const channelAvg = (hex: string) => {
  const h = hex.replace("#", "")
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (r + g + b) / 3
}

describe("PALETTE_PRESETS", () => {
  it("exposes the five reusable alternatives shown next to the generated/default palette", () => {
    expect(PALETTE_PRESETS.map((preset) => preset.id)).toEqual([
      "red",
      "blue",
      "green",
      "amber-gold",
      "mono-slate",
    ])
  })

  it("each preset has both a light and a dark palette", () => {
    for (const preset of PALETTE_PRESETS) {
      expect(preset.light).toBeDefined()
      expect(preset.dark).toBeDefined()
      for (const slot of ["accent", "bg", "ink", "muted"] as const) {
        expect(preset.light[slot]).toMatch(/^#[0-9a-fA-F]{3,8}$/)
        expect(preset.dark[slot]).toMatch(/^#[0-9a-fA-F]{3,8}$/)
      }
    }
  })

  it("dark variants have darker backgrounds than their light twins", () => {
    for (const preset of PALETTE_PRESETS) {
      expect(channelAvg(preset.dark.bg!)).toBeLessThan(channelAvg(preset.light.bg!))
    }
  })
})

describe("FONT_PRESETS", () => {
  it("exposes five semantic font schemes", () => {
    expect(FONT_PRESETS.map((preset) => preset.id)).toEqual([
      "default",
      "clear-modern",
      "classic-editorial",
      "friendly-organic",
      "bold-confident",
    ])
  })

  it("the default preset has empty fonts to signal manifest fallback", () => {
    const def = FONT_PRESETS.find((preset) => preset.id === "default")
    expect(def?.label).toBe("Generated Style")
    expect(def?.fonts).toEqual({})
  })

  it("each non-default preset sets title, heading, and text font families", () => {
    for (const preset of FONT_PRESETS) {
      if (preset.id === "default") continue
      expect(preset.fonts.title).toBeTruthy()
      expect(preset.fonts.heading).toBeTruthy()
      expect(preset.fonts.text).toBeTruthy()
    }
  })

  it("only exposes font families loaded by CMS and the renderer", () => {
    const loadedFamilies = new Set(["Inter Variable", "Fraunces Variable", "Caveat Variable"])
    for (const preset of FONT_PRESETS) {
      for (const family of Object.values(preset.fonts)) {
        expect(loadedFamilies.has(family)).toBe(true)
      }
    }
  })
})

describe("RADIUS_PRESETS", () => {
  it("exposes rounded, soft, subtle, and square shape presets", () => {
    expect(RADIUS_PRESETS.map((preset) => preset.id)).toEqual(["rounded", "soft", "subtle", "square"])
    expect(RADIUS_PRESETS.map((preset) => preset.value)).toEqual(["1.25rem", "0.75rem", "0.25rem", "0"])
  })

  it("uses radius 0 for the square preset", () => {
    expect(RADIUS_PRESETS.find((preset) => preset.id === "square")).toMatchObject({
      label: "Square",
      value: "0",
      icon: "square",
    })
  })
})

describe("shape token presets", () => {
  it("exposes the contract density choices", () => {
    expect(DENSITY_PRESETS.map((preset) => preset.id)).toEqual(["compact", "comfortable", "spacious"])
  })

  it("exposes renderer-backed style preset tokens", () => {
    expect(STYLE_PRESETS.map((preset) => preset.id)).toEqual(["catalog-clean", "industrial-cleaning"])
    expect(STYLE_PRESETS.map((preset) => preset.id)).not.toContain("warm-care")
    for (const preset of STYLE_PRESETS) {
      expect(preset.id).toMatch(/^[a-z0-9-]+$/)
    }
  })
})
