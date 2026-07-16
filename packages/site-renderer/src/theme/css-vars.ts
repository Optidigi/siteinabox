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
  const write = (parts: string[], mode: typeof resolved.light) => {
    set(parts, "--background", mode.surface); set(parts, "--foreground", mode.ink); set(parts, "--card", mode.surface); set(parts, "--card-foreground", mode.ink)
    set(parts, "--popover", mode.surface); set(parts, "--popover-foreground", mode.ink); set(parts, "--primary", mode.accent[600]); set(parts, "--primary-foreground", mode.onAccent)
    set(parts, "--secondary", mode.neutral[100]); set(parts, "--secondary-foreground", mode.ink); set(parts, "--muted", mode.neutral[100]); set(parts, "--muted-foreground", mode.muted)
    set(parts, "--accent", mode.accent[100]); set(parts, "--accent-foreground", mode.ink); set(parts, "--border", mode.rule); set(parts, "--input", mode.rule); set(parts, "--ring", mode.accent[500])
    set(parts, "--color-bg", mode.surface); set(parts, "--color-ink", mode.ink); set(parts, "--color-ink-muted", mode.muted); set(parts, "--color-accent", mode.accent[600])
    for (const shade of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const) {
      set(parts, `--siab-neutral-${shade}`, mode.neutral[shade])
      set(parts, `--siab-accent-${shade}`, mode.accent[shade])
    }
  }
  write(base, resolved.light); write(dark, resolved.dark)
  set(base, "--font-title", resolved.fonts.roles.display ?? resolved.fonts.roles.heading); set(base, "--font-heading", resolved.fonts.roles.heading); set(base, "--font-text", resolved.fonts.roles.body); set(base, "--font-sans", resolved.fonts.roles.body); set(base, "--font-serif", resolved.fonts.roles.heading); set(base, "--font-mono", resolved.fonts.roles.mono)
  set(base, "--radius", resolved.shape.radius.md); set(base, "--radius-none", resolved.shape.radius.none); set(base, "--radius-sm", resolved.shape.radius.sm); set(base, "--radius-md", resolved.shape.radius.md); set(base, "--radius-lg", resolved.shape.radius.lg); set(base, "--radius-xl", resolved.shape.radius.xl); set(base, "--radius-2xl", resolved.shape.radius["2xl"]); set(base, "--radius-3xl", resolved.shape.radius["3xl"]); set(base, "--radius-4xl", resolved.shape.radius["4xl"]); set(base, "--radius-full", resolved.shape.radius.full)
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
  const lightTokens = "--radius:0.625rem;--background:oklch(1 0 0);--foreground:oklch(0.145 0 0);--card:oklch(1 0 0);--card-foreground:oklch(0.145 0 0);--popover:oklch(1 0 0);--popover-foreground:oklch(0.145 0 0);--primary:oklch(0.205 0 0);--primary-foreground:oklch(0.985 0 0);--secondary:var(--siab-upstream-neutral-1000);--secondary-foreground:oklch(0.205 0 0);--muted:oklch(0.97 0 0);--muted-foreground:oklch(0.556 0 0);--accent:oklch(0.97 0 0);--accent-foreground:oklch(0.205 0 0);--destructive:oklch(0.58 0.22 27);--border:oklch(0.922 0 0);--input:oklch(0.922 0 0);--ring:oklch(0.708 0 0)"
  const darkTokens = "--radius:0.625rem;--background:oklch(0.145 0 0);--foreground:oklch(0.985 0 0);--card:oklch(0.205 0 0);--card-foreground:oklch(0.985 0 0);--popover:oklch(0.205 0 0);--popover-foreground:oklch(0.985 0 0);--primary:oklch(0.87 0 0);--primary-foreground:oklch(0.205 0 0);--secondary:oklch(0.269 0 0);--secondary-foreground:oklch(0.985 0 0);--muted:oklch(0.205 0 0);--muted-foreground:oklch(0.708 0 0);--accent:oklch(0.371 0 0);--accent-foreground:oklch(0.985 0 0);--destructive:oklch(0.704 0.191 22.216);--border:oklch(1 0 0 / 10%);--input:oklch(1 0 0 / 15%);--ring:oklch(0.556 0 0)"
  return `${root}{${base.join(";")};background-color:var(--background);color:var(--foreground);color-scheme:light} ${darkRoot}{${dark.join(";")};color-scheme:dark} ${reference}{${lightTokens}} ${referenceDark}{${darkTokens}}`
}
