import { describe, expect, it } from "vitest"
import { FONT_PRESETS, PALETTE_PRESETS, RADIUS_PRESETS } from "@/lib/theme/presets"

describe("theme presets", () => {
  it("exposes exactly the fixed toolbar presets", () => {
    expect(FONT_PRESETS.map((preset) => [preset.id, preset.label])).toEqual([
      ["clear-modern", "Clear Modern"],
      ["classic-editorial", "Classic Editorial"],
      ["friendly-organic", "Friendly Organic"],
    ])
    expect(PALETTE_PRESETS.map((preset) => [preset.id, preset.label])).toEqual([
      ["monochrome", "Monochrome"],
      ["blue-professional", "Blue Professional"],
      ["red-confident", "Red Confident"],
      ["emerald-calm", "Emerald Calm"],
      ["amber-warm", "Amber Warm"],
    ])
    expect(RADIUS_PRESETS.map((preset) => [preset.id, preset.label])).toEqual([
      ["rounded", "Round"],
      ["soft", "Soft"],
      ["sharp", "Sharp"],
    ])
  })

  it("does not expose generated or custom presets", () => {
    const labels = [
      ...FONT_PRESETS,
      ...PALETTE_PRESETS,
      ...RADIUS_PRESETS,
    ].map((preset) => preset.label)
    expect(labels).not.toContain("Generated Style")
    expect(labels.join(" ").toLowerCase()).not.toContain("generated")
  })
})
