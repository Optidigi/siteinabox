import { describe, expect, it } from "vitest"
import {
  DEFAULT_THEME_TOKEN_SPEC,
  BACKGROUND_MODE_IDS,
  ThemeTokenSpecSchema,
} from "./index"

describe("site background modes", () => {
  it("exposes a closed site background mode set with animation as the default", () => {
    expect(BACKGROUND_MODE_IDS).toEqual(["image", "animation", "grid", "ambient", "mesh", "none"])
    expect(DEFAULT_THEME_TOKEN_SPEC.appearance.backgroundMode).toBe("animation")
  })

  it("keeps older V3 themes valid while rejecting unknown background modes", () => {
    const legacyTheme = {
      version: 3,
      appearance: { mode: "light" },
      colors: DEFAULT_THEME_TOKEN_SPEC.colors,
      fonts: DEFAULT_THEME_TOKEN_SPEC.fonts,
      shape: DEFAULT_THEME_TOKEN_SPEC.shape,
    }

    expect(ThemeTokenSpecSchema.safeParse(legacyTheme).success).toBe(true)
    expect(ThemeTokenSpecSchema.safeParse({
      ...DEFAULT_THEME_TOKEN_SPEC,
      appearance: { mode: "light", backgroundMode: "shader" },
    }).success).toBe(false)
    expect(ThemeTokenSpecSchema.safeParse({
      ...DEFAULT_THEME_TOKEN_SPEC,
      appearance: { mode: "light", backgroundMode: "none" },
    }).success).toBe(true)
  })
})
