import type { ThemeTokenSpec } from "@siteinabox/contracts"
import { resolveThemeTokens } from "./resolve"
import { resolveColorMode, themePreference } from "./color-mode"

export const PUBLIC_RENDERER_THEME_SCOPE = ".site-renderer[data-siab-site-renderer] .rt-canvas" as const
export type ThemeCssVarScope = ".rt-canvas" | ":root" | typeof PUBLIC_RENDERER_THEME_SCOPE
const set = (parts: string[], name: string, value: string | undefined | null) => { if (value) parts.push(`${name}:${value}`) }
const rootSelector = (scope: ThemeCssVarScope) => scope === ":root" ? "html:root" : scope
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
    for (const shade of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const) {
      set(parts, `--siab-neutral-${shade}`, mode.neutral[shade])
      set(parts, `--siab-accent-${shade}`, mode.accent[shade])
    }
  }
  write(base, resolved.light, resolved.semantic.light); write(dark, resolved.dark, resolved.semantic.dark)
  set(base, "--siab-font-display", resolved.fonts.roles.display ?? resolved.fonts.roles.heading); set(base, "--siab-font-heading", resolved.fonts.roles.heading); set(base, "--siab-font-body", resolved.fonts.roles.body); set(base, "--siab-font-mono", resolved.fonts.roles.mono)
  set(base, "--font-title", "var(--siab-font-display)"); set(base, "--font-heading", "var(--siab-font-heading)"); set(base, "--font-text", "var(--siab-font-body)"); set(base, "--font-sans", "var(--siab-font-body)"); set(base, "--font-serif", "var(--siab-font-heading)"); set(base, "--font-mono", "var(--siab-font-mono)")
  set(base, "--radius", resolved.shape.radius.md); set(base, "--siab-radius-none", resolved.shape.radius.none); set(base, "--siab-radius-sm", resolved.shape.radius.sm); set(base, "--siab-radius-md", resolved.shape.radius.md); set(base, "--siab-radius-lg", resolved.shape.radius.lg); set(base, "--siab-radius-xl", resolved.shape.radius.xl); set(base, "--siab-radius-2xl", resolved.shape.radius["2xl"]); set(base, "--siab-radius-3xl", resolved.shape.radius["3xl"]); set(base, "--siab-radius-4xl", resolved.shape.radius["4xl"]); set(base, "--siab-radius-full", resolved.shape.radius.full)
  const root = rootSelector(scope)
  const canvasDarkRoot = `${root}[data-rt-mode="dark"]`
  const publicDarkRoot = scope === ":root"
    ? `${root}[data-siab-color-mode="dark"]`
    : `html[data-siab-color-mode="dark"] ${root}`
  const darkRoot = `${canvasDarkRoot},${publicDarkRoot}`
  const reference = `${root} :where([data-provider-token-mode="reference"])`
  const referenceDark = `${canvasDarkRoot} :where([data-provider-token-mode="reference"]),${publicDarkRoot} :where([data-provider-token-mode="reference"])`
  // Exact globals from the pinned upstream preview at 46c2e50. Tenant mode
  // uses the resolved theme above; reference mode exists only for source audit.
  const referenceRadii = "--radius:0.625rem;--siab-radius-sm:0.375rem;--siab-radius-md:0.5rem;--siab-radius-lg:0.625rem;--siab-radius-xl:0.875rem;--siab-radius-2xl:1rem;--siab-radius-3xl:1.5rem;--siab-radius-4xl:2rem"
  const lightTokens = `${referenceRadii};--background:oklch(1 0 0);--foreground:oklch(0.145 0 0);--card:oklch(1 0 0);--card-foreground:oklch(0.145 0 0);--popover:oklch(1 0 0);--popover-foreground:oklch(0.145 0 0);--primary:oklch(0.205 0 0);--primary-foreground:oklch(0.985 0 0);--secondary:var(--siab-upstream-neutral-1000);--secondary-foreground:oklch(0.205 0 0);--muted:oklch(0.97 0 0);--muted-foreground:oklch(0.556 0 0);--accent:oklch(0.97 0 0);--accent-foreground:oklch(0.205 0 0);--destructive:oklch(0.58 0.22 27);--border:oklch(0.922 0 0);--input:oklch(0.922 0 0);--ring:oklch(0.708 0 0)`
  const darkTokens = `${referenceRadii};--background:oklch(0.145 0 0);--foreground:oklch(0.985 0 0);--card:oklch(0.205 0 0);--card-foreground:oklch(0.985 0 0);--popover:oklch(0.205 0 0);--popover-foreground:oklch(0.985 0 0);--primary:oklch(0.87 0 0);--primary-foreground:oklch(0.205 0 0);--secondary:oklch(0.269 0 0);--secondary-foreground:oklch(0.985 0 0);--muted:oklch(0.205 0 0);--muted-foreground:oklch(0.708 0 0);--accent:oklch(0.371 0 0);--accent-foreground:oklch(0.985 0 0);--destructive:oklch(0.704 0.191 22.216);--border:oklch(1 0 0 / 10%);--input:oklch(1 0 0 / 15%);--ring:oklch(0.556 0 0)`
  return `${root}{${base.join(";")};background-color:var(--background);color:var(--foreground);color-scheme:light} ${darkRoot}{${dark.join(";")};color-scheme:dark} ${reference}{${lightTokens}} ${referenceDark}{${darkTokens}}`
}
