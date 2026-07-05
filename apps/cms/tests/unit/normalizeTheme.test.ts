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
      fonts: { title: "Inter Variable" },
    })
  })

  it("normalizes font aliases and CSS stacks to renderer-loaded families", () => {
    expect(normalizeThemeForSave({
      fonts: {
        title: "Fraunces Variable, Georgia, serif",
        heading: "Georgia",
        text: "Inter",
        script: "Dancing Script",
      },
    })).toEqual({
      fonts: {
        title: "Fraunces Variable",
        heading: "Fraunces Variable",
        text: "Inter Variable",
        script: "Caveat Variable",
      },
    })
  })

  it("falls back unknown font values to the loaded renderer family for each role", () => {
    expect(normalizeThemeForSave({
      fonts: {
        title: "Unknown Display",
        heading: "Unknown Heading",
        text: "Unknown Sans",
        script: "Unknown Script",
      },
    })).toEqual({
      fonts: {
        title: "Fraunces Variable",
        heading: "Fraunces Variable",
        text: "Inter Variable",
        script: "Caveat Variable",
      },
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
