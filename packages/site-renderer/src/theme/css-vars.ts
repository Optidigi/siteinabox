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
  if (parsed.num === 0) {
    return [
      ["--radius-none", "0"],
      ["--radius-xs", "0"],
      ["--radius-sm", "0"],
      ["--radius-md", "0"],
      ["--radius-lg", "0"],
      ["--radius-xl", "0"],
      ["--radius-2xl", "0"],
      ["--radius-3xl", "0"],
      ["--radius-4xl", "0"],
    ]
  }
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

function providerThemeBridgeRules(
  scope: ThemeCssVarScope,
  options: { colors: boolean; fonts: boolean; density: boolean },
): string[] {
  const baseSelector = scope === ":root" ? "html:root" : scope
  const providerRootSelectors = [
    `${baseSelector} :where([data-provider-block="tailwindplus"])`,
    `${baseSelector} :where([data-provider-chrome="tailwindplus"])`,
    `${baseSelector} :where([data-provider-template="tailwindplus"])`,
  ]
  const providerSurfaceRoots = [
    `${baseSelector}:where(.bg-white)`,
    `${baseSelector} :where([data-provider-block="tailwindplus"].bg-white)`,
    `${baseSelector} :where([data-provider-chrome="tailwindplus"].bg-white)`,
    `${baseSelector} :where([data-provider-template="tailwindplus"].bg-white)`,
  ].join(",")
  const providerSurfaceDescendants = [
    `${baseSelector} :where([data-provider-block="tailwindplus"] .bg-white)`,
    `${baseSelector} :where([data-provider-chrome="tailwindplus"] .bg-white)`,
    `${baseSelector} :where([data-provider-template="tailwindplus"] .bg-white)`,
  ].join(",")
  const rootClass = (className: string, pseudo = "") => providerRootSelectors.map((selector) => `${selector}.${className}${pseudo}`).join(",")
  const descendant = (className: string, pseudo = "") => providerRootSelectors.map((selector) => `${selector} .${className}${pseudo}`).join(",")

  const rules: string[] = []
  if (options.colors) rules.push(
    `${providerSurfaceRoots}{background-color:var(--color-tailwindplus-surface,var(--color-bg,#ffffff))}`,
    `${providerSurfaceDescendants}{background-color:var(--color-tailwindplus-card,var(--color-card,var(--color-bg,#ffffff)))}`,
    `${rootClass("bg-gray-50")}{background-color:var(--color-card,var(--color-bg))}`,
    `${descendant("bg-gray-50")}{background-color:var(--color-card,var(--color-bg))}`,
    `${descendant("ring-gray-900\\/10")}{--tw-ring-color:color-mix(in oklab,var(--color-ink) 10%,transparent)}`,
    `${descendant("hover\\:ring-gray-900\\/20", ":hover")}{--tw-ring-color:color-mix(in oklab,var(--color-ink) 20%,transparent)}`,
    `${descendant("outline-gray-300")}{outline-color:var(--color-rule)}`,
    `${descendant("ring-gray-400\\/10")}{--tw-ring-color:color-mix(in oklab,var(--color-ink-muted) 10%,transparent)}`,
  )
  if (options.fonts) rules.push(
    `${providerRootSelectors.map((selector) => `${selector} :is(h1)`).join(",")}{font-family:var(--font-title,var(--font-sans,inherit))}`,
    `${providerRootSelectors.map((selector) => `${selector} :is(h2,h3,h4,dt,legend)`).join(",")}{font-family:var(--font-heading,var(--font-sans,inherit))}`,
    `${providerRootSelectors.map((selector) => `${selector} :is(p,dd,li,label,input,select,textarea,button,a)`).join(",")}{font-family:var(--font-text,var(--font-sans,inherit))}`,
  )
  if (options.density) rules.push(
    `${providerRootSelectors.map((selector) => `${selector}:is(.py-24,.py-32)`).join(",")}{padding-top:var(--site-section-padding-y,6rem);padding-bottom:var(--site-section-padding-y,6rem)}`,
    `@media (min-width:40rem){${providerRootSelectors.map((selector) => `${selector}:is(.sm\\:py-24,.sm\\:py-32)`).join(",")}{padding-top:var(--site-section-padding-y-sm,var(--site-section-padding-y,8rem));padding-bottom:var(--site-section-padding-y-sm,var(--site-section-padding-y,8rem))}}`,
  )
  return rules
}

function sectionSpacingForDensity(density: ThemeTokenSpec["density"]): [string, string] | null {
  if (density === "compact") return ["4rem", "5rem"]
  if (density === "spacious") return ["7rem", "9rem"]
  if (density === "comfortable") return ["6rem", "8rem"]
  return null
}

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
  const hasColors = Boolean(accent || onAccent || bg || ink || muted || card || secondary || rule)
  if (!hasColors) return

  set(parts, "--color-indigo-700", accent)
  set(parts, "--color-indigo-600", accent)
  set(parts, "--color-indigo-500", accent)
  set(parts, "--color-indigo-400", accent)
  set(parts, "--color-indigo-300", accentSoft)
  set(parts, "--color-indigo-200", accentSoft)
  set(parts, "--color-indigo-100", accentSofter)
  set(parts, "--color-indigo-50", accentSofter)
  set(parts, "--color-white", onAccentColor(onAccent))
  set(parts, "--color-tailwindplus-surface", bg)
  set(parts, "--color-tailwindplus-card", card ?? bg)
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
  if (theme.density) {
    set(baseParts, "--site-density", theme.density)
    const sectionSpacing = sectionSpacingForDensity(theme.density)
    if (sectionSpacing) {
      set(baseParts, "--site-section-padding-y", sectionSpacing[0])
      set(baseParts, "--site-section-padding-y-sm", sectionSpacing[1])
    }
  }
  if (theme.stylePreset) set(baseParts, "--site-style-preset", theme.stylePreset)

  const baseSelector = scope === ":root" ? "html:root" : scope
  const darkSelector = scope === ":root" ? "html:root[data-rt-mode=\"dark\"]" : `${scope}[data-rt-mode="dark"]`
  const hasColorBridge = Boolean(
    theme.colors?.bg ||
    theme.colors?.ink ||
    theme.colors?.muted ||
    theme.colors?.card ||
    theme.darkColors?.bg ||
    theme.darkColors?.ink ||
    theme.darkColors?.muted ||
    theme.darkColors?.card ||
    theme.mode === "dark"
  )
  const hasFontBridge = Boolean(theme.fonts?.title || theme.fonts?.heading || theme.fonts?.text || theme.fonts?.script)
  const hasDensityBridge = Boolean(theme.density)
  const rules: string[] = []
  if (baseParts.length > 0) rules.push(`${baseSelector}{${baseParts.join(";")}}`)
  if (darkParts.length > 0) rules.push(`${darkSelector}{${darkParts.join(";")}}`)
  rules.push(...providerThemeBridgeRules(scope, { colors: hasColorBridge, fonts: hasFontBridge, density: hasDensityBridge }))
  return rules.join(" ")
}
