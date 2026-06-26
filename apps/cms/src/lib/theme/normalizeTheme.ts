import type { ThemeTokens } from "@/lib/theme/schema"

const hasValue = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0

const pruneRecord = <T extends Record<string, string | undefined>>(value: T | undefined): T | undefined => {
  if (!value) return undefined
  const entries = Object.entries(value).filter(([, entry]) => hasValue(entry))
  if (entries.length === 0) return undefined
  return Object.fromEntries(entries) as T
}

export const normalizeThemeForSave = (theme: ThemeTokens | null | undefined): ThemeTokens | null => {
  if (!theme) return null

  const normalized: ThemeTokens = {}
  const palette = pruneRecord(theme.palette)
  const darkPalette = pruneRecord(theme.darkPalette)
  const fonts = pruneRecord(theme.fonts)

  if (palette) normalized.palette = palette
  if (darkPalette) normalized.darkPalette = darkPalette
  if (fonts) normalized.fonts = fonts
  if (hasValue(theme.radius)) normalized.radius = theme.radius
  if (theme.density) normalized.density = theme.density
  if (hasValue(theme.stylePreset)) normalized.stylePreset = theme.stylePreset
  if (theme.borderStyle) normalized.borderStyle = theme.borderStyle

  const hasConcreteTokens = Object.keys(normalized).length > 0
  if (theme.mode && hasConcreteTokens) normalized.mode = theme.mode

  return hasConcreteTokens ? normalized : null
}
