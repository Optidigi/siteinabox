import { describe, expect, it } from "vitest"
import { DEFAULT_THEME_TOKEN_SPEC } from "@siteinabox/contracts"
import { resolvePreviewSiteMode } from "@/components/preview/preview-mobile-chrome-tone"

describe("resolvePreviewSiteMode", () => {
  it("resolves explicit light and dark without consulting the OS", () => {
    expect(resolvePreviewSiteMode({ ...DEFAULT_THEME_TOKEN_SPEC, appearance: { mode: "light" } }, true)).toBe("light")
    expect(resolvePreviewSiteMode({ ...DEFAULT_THEME_TOKEN_SPEC, appearance: { mode: "dark" } }, false)).toBe("dark")
  })

  it("resolves system against the provided OS preference", () => {
    const theme = { ...DEFAULT_THEME_TOKEN_SPEC, appearance: { mode: "system" as const } }
    expect(resolvePreviewSiteMode(theme, true)).toBe("dark")
    expect(resolvePreviewSiteMode(theme, false)).toBe("light")
  })
})
