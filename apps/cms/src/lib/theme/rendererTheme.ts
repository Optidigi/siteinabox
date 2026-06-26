import type { ThemeTokenSpec } from "@siteinabox/contracts"
import type { ThemeTokens } from "@/lib/theme/schema"

export function cmsThemeToRendererTheme(theme: ThemeTokens | null | undefined): ThemeTokenSpec | null {
  if (!theme) return null
  return {
    colors: theme.palette,
    darkColors: theme.darkPalette,
    fonts: theme.fonts,
    radius: theme.radius,
    density: theme.density,
    stylePreset: theme.stylePreset,
    borderStyle: theme.borderStyle,
    mode: theme.mode,
  }
}
