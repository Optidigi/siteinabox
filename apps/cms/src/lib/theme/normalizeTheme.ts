import {
  COLOR_SCHEME_IDS,
  DEFAULT_THEME_TOKEN_SPEC,
  FONT_SCHEME_IDS,
  SHAPE_SCHEME_IDS,
  type ColorSchemeId,
  type FontSchemeId,
  type ShapeSchemeId,
  type ThemeMode,
} from "@siteinabox/contracts"
import type { ThemeTokens } from "@/lib/theme/schema"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value))

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === "string" && (allowed as readonly string[]).includes(value) ? value as T : fallback

const normalizeMode = (theme: Record<string, unknown>): ThemeMode => {
  const appearance = isRecord(theme.appearance) ? theme.appearance : null
  return oneOf(appearance?.mode ?? theme.mode, ["light", "dark", "system"] as const, DEFAULT_THEME_TOKEN_SPEC.appearance.mode)
}

const normalizeColorScheme = (theme: Record<string, unknown>): ColorSchemeId => {
  const colors = isRecord(theme.colors) ? theme.colors : null
  const legacyStylePreset = typeof theme.stylePreset === "string" ? theme.stylePreset : null
  const mappedLegacyPreset = legacyStylePreset === "warm-care" ? "emerald-calm" : undefined
  return oneOf(colors?.schemeId ?? mappedLegacyPreset, COLOR_SCHEME_IDS, DEFAULT_THEME_TOKEN_SPEC.colors.schemeId)
}

const normalizeFontScheme = (theme: Record<string, unknown>): FontSchemeId => {
  const fonts = isRecord(theme.fonts) ? theme.fonts : null
  return oneOf(fonts?.schemeId, FONT_SCHEME_IDS, DEFAULT_THEME_TOKEN_SPEC.fonts.schemeId)
}

const normalizeShapeScheme = (theme: Record<string, unknown>): ShapeSchemeId => {
  const shape = isRecord(theme.shape) ? theme.shape : null
  const radius = typeof theme.radius === "string" ? Number.parseFloat(theme.radius) : null
  const legacyShape = radius == null || Number.isNaN(radius)
    ? undefined
    : radius <= 0
      ? "sharp"
      : radius >= 1
        ? "rounded"
        : "soft"
  return oneOf(shape?.schemeId ?? legacyShape, SHAPE_SCHEME_IDS, DEFAULT_THEME_TOKEN_SPEC.shape.schemeId)
}

export const normalizeThemeForSave = (theme: unknown): ThemeTokens | null => {
  if (!theme) return null
  if (!isRecord(theme)) return null
  return {
    version: 3,
    appearance: { mode: normalizeMode(theme) },
    colors: { schemeId: normalizeColorScheme(theme) },
    fonts: { schemeId: normalizeFontScheme(theme) },
    shape: { schemeId: normalizeShapeScheme(theme) },
  }
}

export const normalizePreviewThemeForSave = normalizeThemeForSave
