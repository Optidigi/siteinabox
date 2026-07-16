import type { ThemeTokenSpec } from "@siteinabox/contracts"
import { resolveThemeTokens } from "./resolve"
import { resolveColorMode, themePreference } from "./color-mode"

export const PUBLIC_RENDERER_THEME_SCOPE = ".site-renderer[data-siab-site-renderer] .rt-canvas" as const
export type ThemeCssVarScope = ".rt-canvas" | ":root" | typeof PUBLIC_RENDERER_THEME_SCOPE
const set = (parts: string[], name: string, value: string | undefined | null) => { if (value) parts.push(`${name}:${value}`) }
const rootSelector = (scope: ThemeCssVarScope) => scope === ":root" ? "html:root" : scope
const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const
const neutralFamilies = ["slate", "gray", "zinc", "neutral", "stone"] as const
const accentFamilies = ["sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose", "cyan", "teal"] as const
const statusFamilies = { red: "destructive", orange: "warning", amber: "warning", yellow: "rating", lime: "success", green: "success", emerald: "success" } as const
const statusShade = (token: string, shade: number) => shade < 500
  ? `color-mix(in oklab, var(--${token}) ${Math.max(12, shade / 5)}%, var(--background))`
  : shade > 600
    ? `color-mix(in oklab, var(--${token}) ${Math.max(45, 110 - shade / 10)}%, var(--foreground))`
    : `var(--${token})`
export function themeMode(theme: ThemeTokenSpec | null | undefined): "light" | "dark" { return resolveColorMode(themePreference(theme), null, false) }

export function themeToCssVars(theme: ThemeTokenSpec | null | undefined, scope: ThemeCssVarScope = ".rt-canvas") {
  const resolved = resolveThemeTokens(theme)
  const base: string[] = [], dark: string[] = []
  const write = (parts: string[], mode: typeof resolved.light, semantic: typeof resolved.semantic.light) => {
    set(parts, "--background", mode.surface); set(parts, "--foreground", mode.ink); set(parts, "--card", mode.surface); set(parts, "--card-foreground", mode.ink)
    set(parts, "--popover", mode.surface); set(parts, "--popover-foreground", mode.ink); set(parts, "--primary", mode.accent[600]); set(parts, "--primary-foreground", mode.onAccent)
    set(parts, "--secondary", mode.neutral[100]); set(parts, "--secondary-foreground", mode.ink); set(parts, "--muted", mode.neutral[100]); set(parts, "--muted-foreground", mode.muted)
    set(parts, "--accent", mode.accent[100]); set(parts, "--accent-foreground", mode.ink); set(parts, "--border", mode.rule); set(parts, "--input", mode.rule); set(parts, "--ring", mode.accent[500])
    set(parts, "--destructive", semantic.destructive); set(parts, "--destructive-foreground", semantic.destructiveForeground)
    set(parts, "--success", semantic.success); set(parts, "--success-foreground", semantic.successForeground); set(parts, "--warning", semantic.warning); set(parts, "--warning-foreground", semantic.warningForeground); set(parts, "--rating", semantic.rating)
    set(parts, "--chart-1", semantic.charts[0]); set(parts, "--chart-2", semantic.charts[1]); set(parts, "--chart-3", semantic.charts[2]); set(parts, "--chart-4", semantic.charts[3]); set(parts, "--chart-5", semantic.charts[4])
    set(parts, "--overlay", semantic.overlay); set(parts, "--on-media", semantic.onMedia)
    set(parts, "--color-bg", mode.surface); set(parts, "--color-ink", mode.ink); set(parts, "--color-ink-muted", mode.muted); set(parts, "--color-accent", mode.accent[600])
    for (const shade of shades) {
      set(parts, `--siab-neutral-${shade}`, mode.neutral[shade])
      set(parts, `--siab-accent-${shade}`, mode.accent[shade])
    }
  }
  write(base, resolved.light, resolved.semantic.light); write(dark, resolved.dark, resolved.semantic.dark)
  if (theme?.colors?.schemeId && theme.colors.schemeId !== "shadcn-neutral") {
    const palette = (parts: string[], mode: typeof resolved.light) => {
      for (const shade of shades) {
        set(parts, `--provider-accent-${shade}`, mode.accent[shade])
        for (const family of neutralFamilies) set(parts, `--color-${family}-${shade}`, mode.neutral[shade])
        for (const family of accentFamilies) set(parts, `--color-${family}-${shade}`, mode.accent[shade])
        for (const [family, token] of Object.entries(statusFamilies)) set(parts, `--color-${family}-${shade}`, statusShade(token, shade))
      }
    }
    set(base, "--provider-surface", "var(--background)"); set(dark, "--provider-surface", "var(--background)")
    set(base, "--provider-grid-line", "color-mix(in srgb, var(--border) 45%, transparent)"); set(dark, "--provider-grid-line", "color-mix(in srgb, var(--border) 45%, transparent)")
    set(base, "--provider-grid-dot", "color-mix(in srgb, var(--border) 60%, transparent)"); set(dark, "--provider-grid-dot", "color-mix(in srgb, var(--border) 60%, transparent)")
    palette(base, resolved.light); palette(dark, resolved.dark)
  }
  if (theme?.colors?.schemeId === "shadcn-neutral" || !theme?.colors?.schemeId) {
    const exactLight = {
      "--background": "oklch(1 0 0)", "--foreground": "oklch(0.145 0 0)", "--card": "oklch(1 0 0)", "--card-foreground": "oklch(0.145 0 0)",
      "--popover": "oklch(1 0 0)", "--popover-foreground": "oklch(0.145 0 0)", "--primary": "oklch(0.205 0 0)", "--primary-foreground": "oklch(0.985 0 0)",
      "--secondary": "oklch(0.97 0 0)", "--secondary-foreground": "oklch(0.205 0 0)", "--muted": "oklch(0.97 0 0)", "--muted-foreground": "oklch(0.556 0 0)",
      "--accent": "oklch(0.97 0 0)", "--accent-foreground": "oklch(0.205 0 0)", "--destructive": "oklch(0.58 0.22 27)", "--border": "oklch(0.922 0 0)",
      "--input": "oklch(0.922 0 0)", "--ring": "oklch(0.708 0 0)",
    }
    const exactDark = {
      "--background": "oklch(0.145 0 0)", "--foreground": "oklch(0.985 0 0)", "--card": "oklch(0.205 0 0)", "--card-foreground": "oklch(0.985 0 0)",
      "--popover": "oklch(0.205 0 0)", "--popover-foreground": "oklch(0.985 0 0)", "--primary": "oklch(0.87 0 0)", "--primary-foreground": "oklch(0.205 0 0)",
      "--secondary": "oklch(0.269 0 0)", "--secondary-foreground": "oklch(0.985 0 0)", "--muted": "oklch(0.205 0 0)", "--muted-foreground": "oklch(0.708 0 0)",
      "--accent": "oklch(0.371 0 0)", "--accent-foreground": "oklch(0.985 0 0)", "--destructive": "oklch(0.704 0.191 22.216)", "--border": "oklch(1 0 0 / 10%)",
      "--input": "oklch(1 0 0 / 15%)", "--ring": "oklch(0.556 0 0)",
    }
    for (const [name, value] of Object.entries(exactLight)) set(base, name, value)
    for (const [name, value] of Object.entries(exactDark)) set(dark, name, value)
  }
  set(base, "--siab-font-display", resolved.fonts.roles.display ?? resolved.fonts.roles.heading); set(base, "--siab-font-heading", resolved.fonts.roles.heading); set(base, "--siab-font-body", resolved.fonts.roles.body); set(base, "--siab-font-mono", resolved.fonts.roles.mono)
  set(base, "--font-title", "var(--siab-font-display)"); set(base, "--font-heading", "var(--siab-font-heading)"); set(base, "--font-text", "var(--siab-font-body)"); set(base, "--font-sans", "var(--siab-font-body)"); set(base, "--font-serif", "var(--siab-font-heading)"); set(base, "--font-mono", "var(--siab-font-mono)")
  set(base, "--radius", theme?.shape?.schemeId === "shadcn-default" || !theme?.shape?.schemeId ? resolved.shape.radius.lg : resolved.shape.radius.md); set(base, "--siab-radius-none", resolved.shape.radius.none); set(base, "--siab-radius-sm", resolved.shape.radius.sm); set(base, "--siab-radius-md", resolved.shape.radius.md); set(base, "--siab-radius-lg", resolved.shape.radius.lg); set(base, "--siab-radius-xl", resolved.shape.radius.xl); set(base, "--siab-radius-2xl", resolved.shape.radius["2xl"]); set(base, "--siab-radius-3xl", resolved.shape.radius["3xl"]); set(base, "--siab-radius-4xl", resolved.shape.radius["4xl"]); set(base, "--siab-radius-full", resolved.shape.radius.full)
  if (theme?.shape?.schemeId && theme.shape.schemeId !== "shadcn-default") set(base, "--provider-radius-hero-gradient", resolved.shape.radius.xl)
  const root = rootSelector(scope)
  const canvasDarkRoot = `${root}[data-rt-mode="dark"]`
  const publicDarkRoot = scope === ":root"
    ? `${root}[data-siab-color-mode="dark"]`
    : `html[data-siab-color-mode="dark"] ${root}`
  const darkRoot = `${canvasDarkRoot},${publicDarkRoot}`
  return `${root}{${base.join(";")};background-color:var(--background);color:var(--foreground);color-scheme:light} ${darkRoot}{${dark.join(";")};color-scheme:dark}`
}
