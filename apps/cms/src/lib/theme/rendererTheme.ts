import type { ThemeTokenSpec } from "@siteinabox/contracts"
import type { ThemeTokens } from "@/lib/theme/schema"
import { normalizeThemeForSave } from "@/lib/theme/normalizeTheme"

export function cmsThemeToRendererTheme(theme: ThemeTokens | null | undefined): ThemeTokenSpec | null {
  return normalizeThemeForSave(theme)
}

export function rendererThemeToCmsTheme(theme: ThemeTokenSpec | null | undefined): ThemeTokens | null {
  return normalizeThemeForSave(theme)
}
