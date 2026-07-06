export const COLOR_SCHEME_IDS = [
  "tailwind-default",
  "slate-indigo",
  "blue-professional",
  "emerald-calm",
  "amber-warm",
] as const

export const FONT_SCHEME_IDS = [
  "clear-modern",
  "classic-editorial",
  "friendly-organic",
  "bold-confident",
] as const

export const SHAPE_SCHEME_IDS = [
  "tailwind-default",
  "sharp",
  "soft",
  "rounded",
] as const

export const DENSITY_SCHEME_IDS = [
  "tailwind-default",
  "compact",
  "comfortable",
  "spacious",
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
  { id: "tailwind-default", label: "Tailwind Native" },
  { id: "slate-indigo", label: "Slate Indigo" },
  { id: "blue-professional", label: "Blue Professional" },
  { id: "emerald-calm", label: "Emerald Calm" },
  { id: "amber-warm", label: "Amber Warm" },
] as const satisfies readonly ThemePresetOption<ColorSchemeId>[]

export const FONT_SCHEME_PRESETS = [
  { id: "clear-modern", label: "Clear Modern" },
  { id: "classic-editorial", label: "Classic Editorial" },
  { id: "friendly-organic", label: "Friendly Organic" },
  { id: "bold-confident", label: "Bold Confident" },
] as const satisfies readonly ThemePresetOption<FontSchemeId>[]

export const SHAPE_SCHEME_PRESETS = [
  { id: "tailwind-default", label: "Tailwind Native" },
  { id: "sharp", label: "Sharp" },
  { id: "soft", label: "Soft" },
  { id: "rounded", label: "Rounded" },
] as const satisfies readonly ThemePresetOption<ShapeSchemeId>[]

export const DENSITY_SCHEME_PRESETS = [
  { id: "tailwind-default", label: "Tailwind Native" },
  { id: "compact", label: "Compact" },
  { id: "comfortable", label: "Comfortable" },
  { id: "spacious", label: "Spacious" },
] as const satisfies readonly ThemePresetOption<DensitySchemeId>[]

export const DEFAULT_THEME_TOKEN_SPEC = {
  version: 2,
  appearance: { mode: "light" },
  colors: { schemeId: "tailwind-default" },
  fonts: { schemeId: "clear-modern" },
  shape: { schemeId: "tailwind-default" },
  density: { schemeId: "tailwind-default" },
} as const
