export const COLOR_SCHEME_IDS = [
  "shadcn-neutral",
  "blue-professional",
  "red-confident",
  "emerald-calm",
  "amber-warm",
] as const

export const FONT_SCHEME_IDS = [
  "shadcn-geist",
  "clear-modern",
  "classic-editorial",
  "friendly-organic",
] as const

export const SHAPE_SCHEME_IDS = [
  "shadcn-default",
  "rounded",
  "soft",
  "sharp",
] as const

export type ColorSchemeId = (typeof COLOR_SCHEME_IDS)[number]
export type FontSchemeId = (typeof FONT_SCHEME_IDS)[number]
export type ShapeSchemeId = (typeof SHAPE_SCHEME_IDS)[number]

export type ThemePresetOption<TId extends string> = {
  id: TId
  label: string
}

export const COLOR_SCHEME_PRESETS = [
  { id: "shadcn-neutral", label: "Shadcn Neutral" },
  { id: "blue-professional", label: "Blue Professional" },
  { id: "red-confident", label: "Red Confident" },
  { id: "emerald-calm", label: "Emerald Calm" },
  { id: "amber-warm", label: "Amber Warm" },
] as const satisfies readonly ThemePresetOption<ColorSchemeId>[]

export const FONT_SCHEME_PRESETS = [
  { id: "shadcn-geist", label: "Shadcn Geist" },
  { id: "clear-modern", label: "Clear Modern" },
  { id: "classic-editorial", label: "Classic Editorial" },
  { id: "friendly-organic", label: "Friendly Organic" },
] as const satisfies readonly ThemePresetOption<FontSchemeId>[]

export const SHAPE_SCHEME_PRESETS = [
  { id: "shadcn-default", label: "Shadcn Default" },
  { id: "rounded", label: "Rounded" },
  { id: "soft", label: "Soft" },
  { id: "sharp", label: "Sharp" },
] as const satisfies readonly ThemePresetOption<ShapeSchemeId>[]

export const DEFAULT_THEME_TOKEN_SPEC = {
  version: 3,
  appearance: { mode: "light" },
  colors: { schemeId: "shadcn-neutral" },
  fonts: { schemeId: "shadcn-geist" },
  shape: { schemeId: "shadcn-default" },
} as const
