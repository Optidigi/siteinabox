import { describe, expect, it } from "vitest"
import { themeSchema } from "@/lib/theme/schema"
import { DEFAULT_THEME_TOKEN_SPEC } from "@siteinabox/contracts"

describe("themeSchema", () => {
  it("accepts ThemeTokenSpec V2 preset selections", () => {
    expect(themeSchema.safeParse(DEFAULT_THEME_TOKEN_SPEC).success).toBe(true)
  })

  it("rejects legacy raw theme fields", () => {
    for (const theme of [
      { palette: { accent: "#ff0000" } },
      { darkPalette: { accent: "#ffffff" } },
      { fonts: { title: "Inter" } },
      { radius: "0.5rem" },
      { stylePreset: "catalog-clean" },
      { borderStyle: "solid" },
      { generatedStyle: true },
      { "generated-style": true },
      { css: ".x{}" },
      { ...DEFAULT_THEME_TOKEN_SPEC, appearance: { mode: "system", defaultMode: "dark" } },
    ]) {
      expect(themeSchema.safeParse(theme).success).toBe(false)
    }
  })

  it("rejects unknown preset IDs", () => {
    expect(themeSchema.safeParse({
      ...DEFAULT_THEME_TOKEN_SPEC,
      colors: { schemeId: "unknown" },
    }).success).toBe(false)
    expect(themeSchema.safeParse({
      ...DEFAULT_THEME_TOKEN_SPEC,
      fonts: { schemeId: "generated-style" },
    }).success).toBe(false)
    expect(themeSchema.safeParse({
      ...DEFAULT_THEME_TOKEN_SPEC,
      colors: { schemeId: "tailwind-default" },
    }).success).toBe(false)
    expect(themeSchema.safeParse({
      ...DEFAULT_THEME_TOKEN_SPEC,
      colors: { schemeId: "slate-indigo" },
    }).success).toBe(false)
    expect(themeSchema.safeParse({
      ...DEFAULT_THEME_TOKEN_SPEC,
      fonts: { schemeId: "bold-confident" },
    }).success).toBe(false)
  })
})
