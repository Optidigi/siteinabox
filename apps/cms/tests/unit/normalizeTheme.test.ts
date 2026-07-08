import { describe, expect, it } from "vitest"
import { normalizePreviewThemeForSave, normalizeThemeForSave } from "@/lib/theme/normalizeTheme"
import { DEFAULT_THEME_TOKEN_SPEC } from "@siteinabox/contracts"

describe("normalizeThemeForSave", () => {
  it("fills missing V2 preset selections with defaults", () => {
    expect(normalizeThemeForSave({ version: 2 } as any)).toEqual(DEFAULT_THEME_TOKEN_SPEC)
  })

  it("preserves selected preset IDs only", () => {
    expect(normalizeThemeForSave({
      version: 2,
      appearance: { mode: "dark" },
      colors: { schemeId: "emerald-calm" },
      fonts: { schemeId: "classic-editorial" },
      shape: { schemeId: "soft" },
      density: { schemeId: "spacious" },
    })).toEqual({
      version: 2,
      appearance: { mode: "dark" },
      colors: { schemeId: "emerald-calm" },
      fonts: { schemeId: "classic-editorial" },
      shape: { schemeId: "soft" },
      density: { schemeId: "spacious" },
    })
  })

  it("pins preview themes to the comfortable density preset", () => {
    expect(normalizePreviewThemeForSave({
      version: 2,
      appearance: { mode: "dark" },
      colors: { schemeId: "emerald-calm" },
      fonts: { schemeId: "classic-editorial" },
      shape: { schemeId: "soft" },
      density: { schemeId: "compact" },
    })).toEqual({
      version: 2,
      appearance: { mode: "dark" },
      colors: { schemeId: "emerald-calm" },
      fonts: { schemeId: "classic-editorial" },
      shape: { schemeId: "soft" },
      density: { schemeId: "comfortable" },
    })
  })
})
