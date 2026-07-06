import { DEFAULT_THEME_TOKEN_SPEC } from "@siteinabox/contracts"
import type { ThemeTokens } from "@/lib/theme/schema"

export const normalizeThemeForSave = (theme: ThemeTokens | null | undefined): ThemeTokens | null => {
  if (!theme) return null
  return {
    version: 2,
    appearance: { mode: theme.appearance?.mode ?? DEFAULT_THEME_TOKEN_SPEC.appearance.mode },
    colors: { schemeId: theme.colors?.schemeId ?? DEFAULT_THEME_TOKEN_SPEC.colors.schemeId },
    fonts: { schemeId: theme.fonts?.schemeId ?? DEFAULT_THEME_TOKEN_SPEC.fonts.schemeId },
    shape: { schemeId: theme.shape?.schemeId ?? DEFAULT_THEME_TOKEN_SPEC.shape.schemeId },
    density: { schemeId: theme.density?.schemeId ?? DEFAULT_THEME_TOKEN_SPEC.density.schemeId },
  }
}
