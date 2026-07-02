import { describe, expect, it } from "vitest"
import { normalizeThemeForSave } from "@/lib/theme/normalizeTheme"

describe("normalizeThemeForSave", () => {
  it("keeps mode-only theme overrides", () => {
    expect(normalizeThemeForSave({ mode: "dark" })).toEqual({ mode: "dark" })
    expect(normalizeThemeForSave({ mode: "light" })).toEqual({ mode: "light" })
    expect(normalizeThemeForSave({ mode: "dark", palette: {}, darkPalette: {}, fonts: {} })).toEqual({ mode: "dark" })
  })

  it("keeps mode when concrete theme tokens exist", () => {
    expect(normalizeThemeForSave({ mode: "dark", radius: "0.5rem" })).toEqual({
      mode: "dark",
      radius: "0.5rem",
    })
    expect(normalizeThemeForSave({ mode: "dark", darkPalette: { accent: "#fff" } })).toEqual({
      mode: "dark",
      darkPalette: { accent: "#fff" },
    })
  })

  it("prunes empty nested token groups", () => {
    expect(normalizeThemeForSave({
      mode: "dark",
      palette: { accent: "", bg: "#fff" },
      fonts: { title: "Inter", heading: "", text: undefined },
    })).toEqual({
      mode: "dark",
      palette: { bg: "#fff" },
      fonts: { title: "Inter" },
    })
  })

  it("keeps shape tokens", () => {
    expect(normalizeThemeForSave({
      radius: "1.5rem",
      density: "spacious",
      stylePreset: "bold",
      borderStyle: "dashed",
    })).toEqual({
      radius: "1.5rem",
      density: "spacious",
      stylePreset: "bold",
      borderStyle: "dashed",
    })
  })
})
