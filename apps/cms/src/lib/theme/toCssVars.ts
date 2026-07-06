import type { ThemeTokens } from "./schema"
import { themeToCssVars, type ThemeCssVarScope } from "@siteinabox/site-renderer/theme/css-vars"
import { cmsThemeToRendererTheme } from "@/lib/theme/rendererTheme"

/**
 * Converts a ThemeTokens object to a CSS rule string scoped to `.rt-canvas`.
 *
 * Emits base and dark-mode rules from ThemeTokenSpec V2 preset selections:
 *   .rt-canvas { ... }
 *   .rt-canvas[data-rt-mode="dark"] { ...dark palette overrides... }
 *
 * The iframe editor frame (`FrameCanvasSurface` / `CanvasSurface`) stamps
 * `data-rt-mode="dark"` on the canvas surface when `theme.appearance.mode === "dark"`, so
 * the overlay rule wins.
 *
 * Returns "" if there is nothing to emit.
 *
 * Pure function — no React, no server-only imports. Safe to use in unit tests
 * and anywhere the module graph cannot carry React.
 *
 * Mapping — the property names MUST match the custom properties the compiled
 * tenant bundle (`cms-editor.css`) actually declares and consumes via `var()`,
 * otherwise an override is emitted but nothing reads it. The block renderers
 * in `src/components/editor/canvas/blocks/` consume the role tokens directly
 * via inline style props (`var(--font-title)` etc.).
 *   colors.schemeId    → provider color ramp variables
 *   fonts.schemeId     → role font variables
 *   shape.schemeId     → Tailwind radius-scale variables
 *   density.schemeId   → coarse section rhythm variables
 */

export function toCssVars(
  theme: ThemeTokens | null | undefined,
  scope: Extract<ThemeCssVarScope, ".rt-canvas" | ":root"> = ".rt-canvas"
): string {
  return themeToCssVars(cmsThemeToRendererTheme(theme), scope)
}
