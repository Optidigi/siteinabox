import { describe, expect, it } from "vitest"
import { normalizePreviewThemeForSave, normalizeThemeForSave } from "@/lib/theme/normalizeTheme"
import { DEFAULT_THEME_TOKEN_SPEC } from "@siteinabox/contracts"

describe("normalizeThemeForSave", () => {
  it("fills missing preset selections with V3 defaults", () => {
    expect(normalizeThemeForSave({ version: 2 } as any)).toEqual(DEFAULT_THEME_TOKEN_SPEC)
  })

  it("preserves selected preset IDs only", () => {
    expect(normalizeThemeForSave({
      version: 3,
      appearance: { mode: "dark" },
      colors: { schemeId: "emerald-calm" },
      fonts: { schemeId: "classic-editorial" },
      shape: { schemeId: "soft" },
    })).toEqual({
      version: 3,
      appearance: { mode: "dark" },
      colors: { schemeId: "emerald-calm" },
      fonts: { schemeId: "classic-editorial" },
      shape: { schemeId: "soft" },
    })
  })

  it("uses the same canonical theme shape for preview", () => {
    expect(normalizePreviewThemeForSave({
      version: 3,
      appearance: { mode: "dark" },
      colors: { schemeId: "emerald-calm" },
      fonts: { schemeId: "classic-editorial" },
      shape: { schemeId: "soft" },
    })).toEqual({
      version: 3,
      appearance: { mode: "dark" },
      colors: { schemeId: "emerald-calm" },
      fonts: { schemeId: "classic-editorial" },
      shape: { schemeId: "soft" },
    })
  })
})
