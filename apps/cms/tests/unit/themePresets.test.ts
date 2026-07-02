import { describe, it, expect } from "vitest"
import { DENSITY_PRESETS, FONT_PRESETS, PALETTE_PRESETS, RADIUS_PRESETS, STYLE_PRESETS } from "@/lib/theme/presets"

describe("PALETTE_PRESETS (round 4)", () => {
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

  it("dark variants have darker background than their light twin", () => {
    const channelAvg = (hex: string) => {
      const h = hex.replace("#", "")
      const r = parseInt(h.slice(0, 2), 16)
      const g = parseInt(h.slice(2, 4), 16)
      const b = parseInt(h.slice(4, 6), 16)
      return (r + g + b) / 3
    }
    for (const preset of PALETTE_PRESETS) {
      // For all presets EXCEPT "mono" (which inverts white↔near-black), dark bg < light bg.
      if (preset.id === "mono") continue
      expect(channelAvg(preset.dark.bg!)).toBeLessThan(channelAvg(preset.light.bg!))
    }
  })
})

describe("FONT_PRESETS (round 3)", () => {
  it("has exactly 4 presets: default, sans, serif, display", () => {
    expect(FONT_PRESETS).toHaveLength(4)
    expect(FONT_PRESETS.map((p) => p.id).sort()).toEqual(["default", "display", "sans", "serif"])
  })

  it("each non-default preset sets title/heading/text font-families", () => {
    for (const preset of FONT_PRESETS) {
      if (preset.id === "default") continue
      expect(preset.fonts.title).toBeTruthy()
      expect(preset.fonts.heading).toBeTruthy()
      expect(preset.fonts.text).toBeTruthy()
    }
  })

  it("preset labels are human-readable single words", () => {
    expect(FONT_PRESETS.find((p) => p.id === "sans")?.label).toBe("Sans")
    expect(FONT_PRESETS.find((p) => p.id === "serif")?.label).toBe("Serif")
    expect(FONT_PRESETS.find((p) => p.id === "display")?.label).toBe("Display")
  })
})

describe("FONT_PRESETS (round 4)", () => {
  it("has exactly 4 presets: default, sans, serif, display", () => {
    expect(FONT_PRESETS).toHaveLength(4)
    expect(FONT_PRESETS.map((p) => p.id).sort()).toEqual(["default", "display", "sans", "serif"])
  })

  it("each non-default preset sets title/heading/text font families", () => {
    for (const preset of FONT_PRESETS) {
      if (preset.id === "default") continue
      expect(preset.fonts.title).toBeTruthy()
      expect(preset.fonts.heading).toBeTruthy()
      expect(preset.fonts.text).toBeTruthy()
    }
  })

  it("the default preset has empty fonts (signals manifest fallback)", () => {
    const def = FONT_PRESETS.find((p) => p.id === "default")
    expect(def?.fonts).toEqual({})
  })

  it("only exposes font families loaded by CMS and the renderer", () => {
    const loadedFamilies = new Set(["Inter Variable", "Fraunces Variable", "Caveat Variable"])
    for (const preset of FONT_PRESETS) {
      for (const family of Object.values(preset.fonts)) {
        expect(loadedFamilies.has(family)).toBe(true)
      }
    }
  })

  it("labels are human-readable", () => {
    expect(FONT_PRESETS.find((p) => p.id === "default")?.label).toBe("Default")
    expect(FONT_PRESETS.find((p) => p.id === "sans")?.label).toBe("Sans")
    expect(FONT_PRESETS.find((p) => p.id === "serif")?.label).toBe("Serif")
    expect(FONT_PRESETS.find((p) => p.id === "display")?.label).toBe("Display")
  })
})

describe("RADIUS_PRESETS", () => {
  it("has the same sharp/soft/round shape tiers as the ThemeBar", () => {
    expect(RADIUS_PRESETS.map((p) => p.id)).toEqual(["sharp", "soft", "round"])
    expect(RADIUS_PRESETS.map((p) => p.value)).toEqual(["0", "0.5rem", "1.5rem"])
  })

  it("carries registry icon ids for the data-driven RadiusControl", () => {
    expect(RADIUS_PRESETS.map((p) => p.icon)).toEqual(["square", "squircle", "circle"])
  })
})

describe("shape token presets", () => {
  it("exposes the contract density choices", () => {
    expect(DENSITY_PRESETS.map((preset) => preset.id)).toEqual(["compact", "comfortable", "spacious"])
  })

  it("exposes renderer-backed style preset tokens", () => {
    expect(STYLE_PRESETS.map((preset) => preset.id)).toEqual(["warm-care", "industrial-cleaning"])
    for (const preset of STYLE_PRESETS) {
      expect(preset.id).toMatch(/^[a-z0-9-]+$/)
    }
  })
})
