import type { ThemeTokenSpec } from "@siteinabox/contracts"

const DEFAULT_DARK = {
  onAccent: "#ffffff",
  bg: "#09090b",
  ink: "#fafafa",
  muted: "#a1a1aa",
  card: "#18181b",
  secondary: "#27272a",
  rule: "rgba(255, 255, 255, 0.12)",
} as const

export const PUBLIC_RENDERER_THEME_SCOPE = ".site-renderer[data-siab-site-renderer] .rt-canvas" as const
export type ThemeCssVarScope = ".rt-canvas" | ":root" | typeof PUBLIC_RENDERER_THEME_SCOPE

function parseLength(value: string): { num: number; unit: string } | null {
  const match = value.match(/^([\d.]+)([a-z%]*)$/i)
  if (!match || match[1] === undefined) return null
  const num = Number.parseFloat(match[1])
  if (Number.isNaN(num)) return null
  return { num, unit: match[2] ? match[2] : "rem" }
}

function deriveRadii(md: string): Array<[string, string]> {
  const parsed = parseLength(md)
  if (!parsed) return []
  const offset = (delta: number) => `${Math.max(parsed.num + delta, 0)}${parsed.unit}`
  return [
    ["--radius-none", "0"],
    ["--radius-xs", offset(-0.375)],
    ["--radius-sm", offset(-0.25)],
    ["--radius-md", md],
    ["--radius-lg", offset(0.5)],
    ["--radius-xl", offset(0.75)],
    ["--radius-2xl", offset(1)],
    ["--radius-3xl", offset(1.5)],
    ["--radius-4xl", offset(2)],
  ]
}

function set(parts: string[], prop: string, value: string | undefined | null) {
  if (value != null && value !== "") parts.push(`${prop}:${value}`)
}

const onAccentColor = (value: string | undefined | null) => value ?? "#ffffff"

function setTailwindProviderColorAliases(
  parts: string[],
  colors: ThemeTokenSpec["colors"] | ThemeTokenSpec["darkColors"] | undefined,
  fallback?: Partial<Record<"onAccent" | "bg" | "ink" | "muted" | "card" | "secondary" | "rule", string>>,
) {
  const accent = colors?.accent
  const onAccent = colors?.onAccent ?? fallback?.onAccent
  const bg = colors?.bg ?? fallback?.bg
  const ink = colors?.ink ?? fallback?.ink
  const muted = colors?.muted ?? fallback?.muted
  const card = colors?.card ?? fallback?.card
  const secondary = colors?.secondary ?? fallback?.secondary
  const rule = colors?.rule ?? fallback?.rule

  const accentSoft = accent ? `color-mix(in oklab, ${accent} 16%, white)` : undefined
  const accentSofter = accent ? `color-mix(in oklab, ${accent} 8%, white)` : undefined

  set(parts, "--color-indigo-700", accent)
  set(parts, "--color-indigo-600", accent)
  set(parts, "--color-indigo-500", accent)
  set(parts, "--color-indigo-400", accent)
  set(parts, "--color-indigo-300", accentSoft)
  set(parts, "--color-indigo-200", accentSoft)
  set(parts, "--color-indigo-100", accentSofter)
  set(parts, "--color-indigo-50", accentSofter)
  set(parts, "--color-white", onAccent ?? bg)
  set(parts, "--color-black", ink)
  set(parts, "--color-gray-950", ink)
  set(parts, "--color-gray-900", ink)
  set(parts, "--color-gray-800", ink)
  set(parts, "--color-gray-700", ink)
  set(parts, "--color-gray-600", muted)
  set(parts, "--color-gray-500", muted)
  set(parts, "--color-gray-400", muted)
  set(parts, "--color-gray-300", rule)
  set(parts, "--color-gray-200", rule)
  set(parts, "--color-gray-100", card)
  set(parts, "--color-gray-50", card ?? bg)
  set(parts, "--color-slate-900", ink)
  set(parts, "--color-slate-600", muted)
  set(parts, "--color-slate-300", rule)
  set(parts, "--color-secondary", secondary)
}

export function themeMode(theme: ThemeTokenSpec | null | undefined): "light" | "dark" {
  return theme?.mode === "dark" ? "dark" : "light"
}

export function themeToCssVars(
  theme: ThemeTokenSpec | null | undefined,
  scope: ThemeCssVarScope = ".rt-canvas",
): string {
  if (!theme) return ""

  const baseParts: string[] = []
  const darkParts: string[] = []
  const flatten = scope === ":root" && theme.mode === "dark"

  if (flatten) {
    const dark = theme.darkColors
    if (dark?.accent) set(baseParts, "--color-accent", dark.accent)
    if (dark?.accent || dark?.onAccent || theme.colors?.onAccent) {
      set(baseParts, "--color-on-accent", onAccentColor(dark?.onAccent ?? theme.colors?.onAccent ?? DEFAULT_DARK.onAccent))
    }
    set(baseParts, "--color-bg", dark?.bg ?? DEFAULT_DARK.bg)
    set(baseParts, "--color-ink", dark?.ink ?? DEFAULT_DARK.ink)
    set(baseParts, "--color-ink-muted", dark?.muted ?? DEFAULT_DARK.muted)
    set(baseParts, "--color-card", dark?.card ?? DEFAULT_DARK.card)
    set(baseParts, "--color-secondary", dark?.secondary ?? DEFAULT_DARK.secondary)
    set(baseParts, "--color-rule", dark?.rule ?? DEFAULT_DARK.rule)
    setTailwindProviderColorAliases(baseParts, dark, DEFAULT_DARK)
  } else {
    const colors = theme.colors
    set(baseParts, "--color-accent", colors?.accent)
    if (colors?.accent || colors?.onAccent) set(baseParts, "--color-on-accent", onAccentColor(colors?.onAccent))
    set(baseParts, "--color-bg", colors?.bg)
    set(baseParts, "--color-ink", colors?.ink)
    set(baseParts, "--color-ink-muted", colors?.muted)
    set(baseParts, "--color-card", colors?.card)
    set(baseParts, "--color-secondary", colors?.secondary)
    set(baseParts, "--color-rule", colors?.rule)
    setTailwindProviderColorAliases(baseParts, colors)

    const dark = theme.darkColors
    const useDefaultDark = theme.mode === "dark"
    set(darkParts, "--color-accent", dark?.accent)
    if (dark?.accent || dark?.onAccent || useDefaultDark) {
      set(darkParts, "--color-on-accent", dark?.onAccent ?? DEFAULT_DARK.onAccent)
    }
    set(darkParts, "--color-bg", dark?.bg ?? (useDefaultDark ? DEFAULT_DARK.bg : undefined))
    set(darkParts, "--color-ink", dark?.ink ?? (useDefaultDark ? DEFAULT_DARK.ink : undefined))
    set(darkParts, "--color-ink-muted", dark?.muted ?? (useDefaultDark ? DEFAULT_DARK.muted : undefined))
    set(darkParts, "--color-card", dark?.card ?? (useDefaultDark ? DEFAULT_DARK.card : undefined))
    set(darkParts, "--color-secondary", dark?.secondary ?? (useDefaultDark ? DEFAULT_DARK.secondary : undefined))
    set(darkParts, "--color-rule", dark?.rule ?? (useDefaultDark ? DEFAULT_DARK.rule : undefined))
    setTailwindProviderColorAliases(darkParts, dark, useDefaultDark ? DEFAULT_DARK : undefined)
  }

  set(baseParts, "--font-title", theme.fonts?.title)
  set(baseParts, "--font-heading", theme.fonts?.heading)
  set(baseParts, "--font-text", theme.fonts?.text)
  set(baseParts, "--font-script", theme.fonts?.script)

  // Legacy renderer utilities consume --font-sans / --font-serif / --font-script
  // aliases. Mirror role fonts when set so ThemeBar edits reach existing markup.
  set(baseParts, "--font-sans", theme.fonts?.text)
  set(baseParts, "--font-serif", theme.fonts?.heading ?? theme.fonts?.title)

  if (theme.radius) {
    for (const [prop, value] of deriveRadii(theme.radius)) set(baseParts, prop, value)
  }

  set(baseParts, "--border-style", theme.borderStyle)
  if (theme.density) set(baseParts, "--site-density", theme.density)
  if (theme.stylePreset) set(baseParts, "--site-style-preset", theme.stylePreset)

  const baseSelector = scope === ":root" ? "html:root" : scope
  const darkSelector = scope === ":root" ? "html:root[data-rt-mode=\"dark\"]" : `${scope}[data-rt-mode="dark"]`
  const rules: string[] = []
  if (baseParts.length > 0) rules.push(`${baseSelector}{${baseParts.join(";")}}`)
  if (darkParts.length > 0) rules.push(`${darkSelector}{${darkParts.join(";")}}`)
  return rules.join(" ")
}
