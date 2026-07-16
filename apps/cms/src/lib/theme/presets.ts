import {
  COLOR_SCHEME_PRESETS,
  FONT_SCHEME_PRESETS,
  SHAPE_SCHEME_PRESETS,
} from "@siteinabox/contracts"
import { colorSchemes, fontSchemes } from "@siteinabox/site-renderer/theme/resolve"
import type { ColorSchemeId, FontSchemeId, ShapeSchemeId } from "@siteinabox/contracts"

export type ColorPreset = {
  id: ColorSchemeId
  label: string
  swatch: {
    accent: string
    surface: string
  }
}

export type FontPreset = {
  id: FontSchemeId
  label: string
  previewFont: string
}

export type ShapePreset = {
  id: ShapeSchemeId
  label: string
  icon: "square" | "squircle" | "circle"
}

export const PALETTE_PRESETS: ColorPreset[] = COLOR_SCHEME_PRESETS.map((preset) => {
  const scheme = colorSchemes[preset.id]
  return {
    id: preset.id,
    label: preset.label,
    swatch: {
      accent: scheme.light.accent[600],
      surface: scheme.light.surface,
    },
  }
})

export const FONT_PRESETS: FontPreset[] = FONT_SCHEME_PRESETS.map((preset) => ({
  id: preset.id,
  label: preset.label,
  previewFont: fontSchemes[preset.id].roles.display ?? fontSchemes[preset.id].roles.heading,
}))

export const RADIUS_PRESETS: ShapePreset[] = SHAPE_SCHEME_PRESETS.map((preset) => ({
  id: preset.id,
  label: preset.label,
  icon: preset.id === "sharp" ? "square" : preset.id === "rounded" ? "circle" : "squircle",
}))
