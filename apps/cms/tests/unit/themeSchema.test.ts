import { describe, it, expect } from "vitest"
import { themeSchema } from "@/lib/theme/schema"

describe("themeSchema", () => {
  it("accepts a fully populated valid theme object", () => {
    const result = themeSchema.safeParse({
      palette: { accent: "#ff0000", bg: "#ffffff", ink: "#333333", muted: "#aaaaaa" },
      fonts: { title: "Inter", heading: "Georgia", text: "Caveat" },
      radius: "0.5rem",
      borderStyle: "solid",
    })
    expect(result.success).toBe(true)
  })

  it("accepts an empty object (all fields optional)", () => {
    const result = themeSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it("accepts oklch() color notation", () => {
    const result = themeSchema.safeParse({
      palette: { accent: "oklch(0.7 0.15 60)", bg: "oklch(1 0 0)" },
    })
    expect(result.success).toBe(true)
  })

  it("accepts rgb() and hsl() color notation", () => {
    const result = themeSchema.safeParse({
      palette: {
        accent: "rgb(255, 0, 0)",
        bg: "rgba(255, 255, 255, 0.5)",
        ink: "hsl(0, 0%, 20%)",
        muted: "hsla(0, 0%, 60%, 0.8)",
      },
    })
    expect(result.success).toBe(true)
  })

  it("accepts CSS named colors and keywords", () => {
    const result = themeSchema.safeParse({
      palette: { accent: "transparent", bg: "currentColor" },
    })
    expect(result.success).toBe(true)
  })

  it("accepts all valid borderStyle values", () => {
    for (const s of ["solid", "dashed", "none"] as const) {
      expect(themeSchema.safeParse({ borderStyle: s }).success).toBe(true)
    }
  })

  it("accepts constrained density and style preset tokens", () => {
    expect(themeSchema.safeParse({ density: "compact", stylePreset: "editorial" }).success).toBe(true)
    expect(themeSchema.safeParse({ density: "busy" }).success).toBe(false)
    expect(themeSchema.safeParse({ stylePreset: "bad;}" }).success).toBe(false)
    expect(themeSchema.safeParse({ stylePreset: "Warm Care" }).success).toBe(false)
  })

  it("rejects a bad hex-like color string", () => {
    const result = themeSchema.safeParse({ palette: { accent: "not-a-color" } })
    expect(result.success).toBe(false)
  })

  it("rejects a color string with spaces that is not a CSS function or keyword", () => {
    const result = themeSchema.safeParse({ palette: { accent: "bright red color" } })
    expect(result.success).toBe(false)
  })

  it("rejects unknown top-level keys (strict mode)", () => {
    const result = themeSchema.safeParse({ bogusKey: 1 })
    expect(result.success).toBe(false)
  })

  it("rejects unknown keys inside palette (strict mode)", () => {
    const result = themeSchema.safeParse({ palette: { unknownProp: "#fff" } })
    expect(result.success).toBe(false)
  })

  it("rejects an invalid borderStyle value", () => {
    const result = themeSchema.safeParse({ borderStyle: "dotted" })
    expect(result.success).toBe(false)
  })
})

describe("themeSchema (round 4)", () => {
  it("accepts fonts.{title, heading, text}", () => {
    const result = themeSchema.safeParse({
      fonts: { title: "Inter", heading: "Lora", text: "Source Sans 3" },
    })
    expect(result.success).toBe(true)
  })

  it("rejects legacy fonts.{sans, serif, script}", () => {
    const result = themeSchema.safeParse({
      fonts: { sans: "Inter", serif: "Lora", script: "Caveat" },
    })
    expect(result.success).toBe(false)
  })

  it("accepts darkPalette as a sibling of palette", () => {
    const result = themeSchema.safeParse({
      palette: { accent: "#3b82f6", bg: "#f8fafc", ink: "#1e293b", muted: "#64748b" },
      darkPalette: { accent: "#60a5fa", bg: "#0f172a", ink: "#e2e8f0", muted: "#94a3b8" },
    })
    expect(result.success).toBe(true)
  })

  it("accepts mode 'light' | 'dark'", () => {
    expect(themeSchema.safeParse({ mode: "light" }).success).toBe(true)
    expect(themeSchema.safeParse({ mode: "dark" }).success).toBe(true)
    expect(themeSchema.safeParse({ mode: "auto" }).success).toBe(false)
  })
})
