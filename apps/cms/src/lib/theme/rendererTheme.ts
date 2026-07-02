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

/**
 * Inverse of `cmsThemeToRendererTheme`. The iframe editor frame only ever
 * receives the already-renderer-shaped `ThemeTokenSpec` over `postMessage`
 * (the parent CMS converts once, in `PageEditorFrameHost`); `CanvasSurface`
 * expects the CMS-shaped `ThemeTokens` so it can compute both the renderer
 * theme and the `.rt-canvas` CSS-var override from the same value. Converting
 * back here keeps `CanvasSurface` itself transport-agnostic.
 */
export function rendererThemeToCmsTheme(theme: ThemeTokenSpec | null | undefined): ThemeTokens | null {
  if (!theme) return null
  return {
    palette: theme.colors,
    darkPalette: theme.darkColors,
    fonts: theme.fonts,
    radius: theme.radius,
    density: theme.density,
    stylePreset: theme.stylePreset,
    borderStyle: theme.borderStyle,
    mode: theme.mode,
  }
}
