import type { ThemeTokenSpec } from "@siteinabox/contracts"
import { resolveThemeTokens } from "./resolve"

export const PUBLIC_RENDERER_THEME_SCOPE = ".site-renderer[data-siab-site-renderer] .rt-canvas" as const
export type ThemeCssVarScope = ".rt-canvas" | ":root" | typeof PUBLIC_RENDERER_THEME_SCOPE
const set = (parts: string[], name: string, value: string | undefined | null) => { if (value) parts.push(`${name}:${value}`) }
const rootSelector = (scope: ThemeCssVarScope) => scope === ":root" ? "html:root" : scope
export function themeMode(theme: ThemeTokenSpec | null | undefined): "light" | "dark" { return theme?.appearance?.mode === "dark" ? "dark" : "light" }

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
  set(base, "--site-density", resolved.density.id); set(base, "--site-section-padding-y", resolved.density.sectionPaddingY.base); set(base, "--site-section-padding-y-sm", resolved.density.sectionPaddingY.sm ?? resolved.density.sectionPaddingY.base); set(base, "--site-section-padding-y-lg", resolved.density.sectionPaddingY.lg ?? resolved.density.sectionPaddingY.sm ?? resolved.density.sectionPaddingY.base)
  const root = rootSelector(scope), darkRoot = `${root}[data-rt-mode="dark"]`
  const reference = `${root} :where([data-provider-token-mode="reference"])`, referenceDark = `${darkRoot} :where([data-provider-token-mode="reference"])`
  const lightTokens = "--background:#fff;--foreground:#09090b;--card:#fff;--card-foreground:#09090b;--popover:#fff;--popover-foreground:#09090b;--primary:#18181b;--primary-foreground:#fafafa;--secondary:#f4f4f5;--secondary-foreground:#18181b;--muted:#f4f4f5;--muted-foreground:#71717a;--accent:#f4f4f5;--accent-foreground:#18181b;--border:#e4e4e7;--input:#e4e4e7;--ring:#a1a1aa"
  const darkTokens = "--background:#09090b;--foreground:#fafafa;--card:#09090b;--card-foreground:#fafafa;--popover:#09090b;--popover-foreground:#fafafa;--primary:#fafafa;--primary-foreground:#18181b;--secondary:#27272a;--secondary-foreground:#fafafa;--muted:#27272a;--muted-foreground:#a1a1aa;--accent:#27272a;--accent-foreground:#fafafa;--border:#27272a;--input:#27272a;--ring:#71717a"
  return `${root}{${base.join(";")};background-color:var(--background);color:var(--foreground)} ${darkRoot}{${dark.join(";")}} ${reference}{${lightTokens}} ${referenceDark}{${darkTokens}}`
}
