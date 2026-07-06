export const COLOR_SCHEME_IDS = [
  "blue-professional",
  "red-confident",
  "emerald-calm",
  "amber-warm",
] as const

export const FONT_SCHEME_IDS = [
  "clear-modern",
  "classic-editorial",
  "friendly-organic",
] as const

export const SHAPE_SCHEME_IDS = [
  "rounded",
  "soft",
  "sharp",
] as const

export const DENSITY_SCHEME_IDS = [
  "spacious",
  "comfortable",
  "compact",
] as const

export type ColorSchemeId = (typeof COLOR_SCHEME_IDS)[number]
export type FontSchemeId = (typeof FONT_SCHEME_IDS)[number]
export type ShapeSchemeId = (typeof SHAPE_SCHEME_IDS)[number]
export type DensitySchemeId = (typeof DENSITY_SCHEME_IDS)[number]

export type ThemePresetOption<TId extends string> = {
  id: TId
  label: string
}

export const COLOR_SCHEME_PRESETS = [
  { id: "blue-professional", label: "Blue Professional" },
  { id: "red-confident", label: "Red Confident" },
  { id: "emerald-calm", label: "Emerald Calm" },
  { id: "amber-warm", label: "Amber Warm" },
] as const satisfies readonly ThemePresetOption<ColorSchemeId>[]

export const FONT_SCHEME_PRESETS = [
  { id: "clear-modern", label: "Clear Modern" },
  { id: "classic-editorial", label: "Classic Editorial" },
  { id: "friendly-organic", label: "Friendly Organic" },
] as const satisfies readonly ThemePresetOption<FontSchemeId>[]

export const SHAPE_SCHEME_PRESETS = [
  { id: "rounded", label: "Rounded" },
  { id: "soft", label: "Soft" },
  { id: "sharp", label: "Sharp" },
] as const satisfies readonly ThemePresetOption<ShapeSchemeId>[]

export const DENSITY_SCHEME_PRESETS = [
  { id: "spacious", label: "Spacious" },
  { id: "comfortable", label: "Comfortable" },
  { id: "compact", label: "Compact" },
] as const satisfies readonly ThemePresetOption<DensitySchemeId>[]

export const DEFAULT_THEME_TOKEN_SPEC = {
  version: 2,
  appearance: { mode: "light" },
  colors: { schemeId: "blue-professional" },
  fonts: { schemeId: "clear-modern" },
  shape: { schemeId: "soft" },
  density: { schemeId: "comfortable" },
} as const
