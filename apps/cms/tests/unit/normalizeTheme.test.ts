import { describe, expect, it } from "vitest"
import { mergeThemePatch, normalizePreviewThemeForSave, normalizeThemeForSave } from "@/lib/theme/normalizeTheme"
import { DEFAULT_THEME_TOKEN_SPEC } from "@siteinabox/contracts"

describe("normalizeThemeForSave", () => {
  it("fills missing preset selections with V3 defaults", () => {
    expect(normalizeThemeForSave({ version: 2 })).toEqual(DEFAULT_THEME_TOKEN_SPEC)
  })

  it("preserves selected preset IDs only", () => {
    expect(normalizeThemeForSave({
      version: 3,
      appearance: { mode: "dark", backgroundMode: "image" },
      colors: { schemeId: "emerald-calm" },
      fonts: { schemeId: "classic-editorial" },
      shape: { schemeId: "soft" },
    })).toEqual({
      version: 3,
      appearance: { mode: "dark", backgroundMode: "image" },
      colors: { schemeId: "emerald-calm" },
      fonts: { schemeId: "classic-editorial" },
      shape: { schemeId: "soft" },
    })
  })

  it("uses the same canonical theme shape for preview", () => {
    expect(normalizePreviewThemeForSave({
      version: 3,
      appearance: { mode: "dark", backgroundMode: "image" },
      colors: { schemeId: "emerald-calm" },
      fonts: { schemeId: "classic-editorial" },
      shape: { schemeId: "soft" },
    })).toEqual({
      version: 3,
      appearance: { mode: "dark", backgroundMode: "image" },
      colors: { schemeId: "emerald-calm" },
      fonts: { schemeId: "classic-editorial" },
      shape: { schemeId: "soft" },
    })
  })

  it("preserves the selected Hero 01 background mode and nested theme fields", () => {
    const current = normalizeThemeForSave({
      ...DEFAULT_THEME_TOKEN_SPEC,
      appearance: { mode: "dark", backgroundMode: "animation" },
    })
    expect(current?.appearance).toEqual({ mode: "dark", backgroundMode: "animation" })
    expect(mergeThemePatch(current, { appearance: { backgroundMode: "grid" } })?.appearance).toEqual({
      mode: "dark",
      backgroundMode: "grid",
    })
    expect(mergeThemePatch(current, { appearance: { backgroundMode: "ambient" } })?.appearance).toEqual({
      mode: "dark",
      backgroundMode: "ambient",
    })
  })
})
