import { DEFAULT_THEME_TOKEN_SPEC, type ThemeTokenSpec } from "@siteinabox/contracts"
import { resolveColorMode, SYSTEM_DARK_QUERY, themePreference } from "./color-mode"

export function normalizeThemeAttributes(theme: ThemeTokenSpec | null | undefined) {
  const value = theme ?? DEFAULT_THEME_TOKEN_SPEC
  const preference = themePreference(value)
  return {
    color: value.colors?.schemeId ?? DEFAULT_THEME_TOKEN_SPEC.colors.schemeId,
    font: value.fonts?.schemeId ?? DEFAULT_THEME_TOKEN_SPEC.fonts.schemeId,
    shape: value.shape?.schemeId ?? DEFAULT_THEME_TOKEN_SPEC.shape.schemeId,
    preference,
  }
}

export function themeMode(theme: ThemeTokenSpec | null | undefined): "light" | "dark" {
  return resolveColorMode(themePreference(theme), null, false)
}

export function themeAttributeProps(theme: ThemeTokenSpec | null | undefined, systemDark = false) {
  const value = normalizeThemeAttributes(theme)
  return {
    "data-theme-color": value.color,
    "data-theme-font": value.font,
    "data-theme-shape": value.shape,
    "data-siab-theme-mode": value.preference,
    "data-rt-mode": resolveColorMode(value.preference, null, systemDark),
  } as const
}

export function applyThemeAttributes(document: Document, theme: ThemeTokenSpec | null | undefined) {
  const value = normalizeThemeAttributes(theme)
  const media = window.matchMedia(SYSTEM_DARK_QUERY)
  const apply = () => {
    const attributes = themeAttributeProps(theme, media.matches)
    document.documentElement.dataset.siabThemeMode = value.preference
    document.documentElement.dataset.siabColorMode = attributes["data-rt-mode"]
    document.documentElement.dataset.rtMode = attributes["data-rt-mode"]
    for (const root of document.querySelectorAll<HTMLElement>(".rt-canvas,[data-siab-theme-scope]")) {
      root.dataset.themeColor = value.color
      root.dataset.themeFont = value.font
      root.dataset.themeShape = value.shape
      root.dataset.siabThemeMode = value.preference
      root.dataset.rtMode = attributes["data-rt-mode"]
    }
  }
  apply()
  if (value.preference !== "system") return () => undefined
  media.addEventListener("change", apply)
  return () => media.removeEventListener("change", apply)
}
