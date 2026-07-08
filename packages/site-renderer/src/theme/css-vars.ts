import type { ThemeTokenSpec } from "@siteinabox/contracts"
import { resolveThemeTokens } from "./resolve"

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

function hexToRgb(value: string | undefined | null): { r: number; g: number; b: number } | null {
  if (!value) return null
  const hex = value.trim().replace(/^#/, "")
  const expanded = hex.length === 3 ? hex.split("").map((part) => `${part}${part}`).join("") : hex
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return null
  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  }
}

function relativeLuminance(color: { r: number; g: number; b: number }) {
  const channel = (value: number) => {
    const srgb = value / 255
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b)
}

function contrastRatio(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) {
  const lighter = Math.max(relativeLuminance(a), relativeLuminance(b))
  const darker = Math.min(relativeLuminance(a), relativeLuminance(b))
  return (lighter + 0.05) / (darker + 0.05)
}

const onAccentColor = (value: string | undefined | null, accent?: string | undefined | null) => {
  if (value) return value
  const accentRgb = hexToRgb(accent)
  if (!accentRgb) return "#ffffff"
  const white = { r: 255, g: 255, b: 255 }
  const ink = { r: 17, g: 24, b: 39 }
  return contrastRatio(accentRgb, white) >= contrastRatio(accentRgb, ink) ? "#ffffff" : "#111827"
}

function providerThemeBridgeRules(
  scope: ThemeCssVarScope,
  options: { colors: boolean; fonts: boolean; density: boolean },
): string[] {
  const baseSelector = scope === ":root" ? "html:root" : scope
  const providerRootSelectors = [
    `${baseSelector}:where([data-provider-block="tailwindplus"])`,
    `${baseSelector}:where([data-provider-chrome="tailwindplus"])`,
    `${baseSelector}:where([data-provider-template="tailwindplus"])`,
    `${baseSelector}:where([data-provider-top-stack="tailwindplus"])`,
    `${baseSelector} :where([data-provider-block="tailwindplus"])`,
    `${baseSelector} :where([data-provider-chrome="tailwindplus"])`,
    `${baseSelector} :where([data-provider-template="tailwindplus"])`,
    `${baseSelector} :where([data-provider-top-stack="tailwindplus"])`,
  ]
  const providerSurfaceRoots = [
    `${baseSelector}:where(.bg-white)`,
    `${baseSelector} :where([data-provider-block="tailwindplus"].bg-white)`,
    `${baseSelector} :where([data-provider-chrome="tailwindplus"].bg-white)`,
    `${baseSelector} :where([data-provider-template="tailwindplus"].bg-white)`,
    `${baseSelector} :where([data-provider-top-stack="tailwindplus"].bg-white)`,
  ].join(",")
  const providerSurfaceDescendants = [
    `${baseSelector} :where([data-provider-block="tailwindplus"] .bg-white)`,
    `${baseSelector} :where([data-provider-chrome="tailwindplus"] .bg-white)`,
    `${baseSelector} :where([data-provider-template="tailwindplus"] .bg-white)`,
    `${baseSelector} :where([data-provider-top-stack="tailwindplus"] .bg-white)`,
  ].join(",")
  const rootClass = (className: string, pseudo = "") => providerRootSelectors.map((selector) => `${selector}.${className}${pseudo}`).join(",")
  const descendant = (className: string, pseudo = "") => providerRootSelectors.map((selector) => `${selector} .${className}${pseudo}`).join(",")
  const rootClasses = (classNames: string[], pseudo = "") => classNames.map((className) => rootClass(className, pseudo)).join(",")
  const descendants = (classNames: string[], pseudo = "") => classNames.map((className) => descendant(className, pseudo)).join(",")
  const rootsAndDescendants = (classNames: string[], pseudo = "") => [
    rootClasses(classNames, pseudo),
    descendants(classNames, pseudo),
  ].filter(Boolean).join(",")
  const groupHover = (classNames: string[]) => providerRootSelectors
    .flatMap((selector) => classNames.map((className) => `${selector} .group:hover .${className}`))
    .join(",")
  const dataToken = (name: string, value: string, pseudo = "") => providerRootSelectors
    .map((selector) => `${selector} :where([${name}="${value}"])${pseudo}`)
    .join(",")
  const classToken = (token: string, pseudo = "") => providerRootSelectors
    .map((selector) => `${selector} :where([class~="${token}"])${pseudo}`)
    .join(",")
  const classTokens = (tokens: string[], pseudo = "") => tokens.map((token) => classToken(token, pseudo)).join(",")
  const fixedDarkZoneSelectors = [
    ...providerRootSelectors.map((selector) => `${selector} :where([data-theme-zone="fixed-dark"])`),
    ...providerRootSelectors.map((selector) => `${selector}:where([data-theme-zone="fixed-dark"])`),
  ].join(",")
  const fixedDarkTextWhiteSelectors = [
    ...providerRootSelectors.map((selector) => `${selector} :where([data-theme-zone="fixed-dark"]) .text-white`),
    ...providerRootSelectors.map((selector) => `${selector}:where([data-theme-zone="fixed-dark"]) .text-white`),
    ...providerRootSelectors.map((selector) => `${selector} :where([data-theme-zone="fixed-dark"].text-white)`),
    ...providerRootSelectors.map((selector) => `${selector}:where([data-theme-zone="fixed-dark"].text-white)`),
  ].join(",")

  const rules: string[] = []
  if (options.colors) rules.push(
    `${fixedDarkZoneSelectors}{--color-bg:#ffffff;--color-card:#ffffff;--color-ink:#111827;--color-ink-muted:#4b5563;--color-tailwindplus-surface:#ffffff;--color-tailwindplus-card:#ffffff;--siab-neutral-50:#f9fafb;--siab-neutral-100:#f3f4f6;--siab-neutral-200:#e5e7eb;--siab-neutral-300:#d1d5db;--siab-neutral-400:#9ca3af;--siab-neutral-500:#6b7280;--siab-neutral-600:#4b5563;--siab-neutral-700:#374151;--siab-neutral-800:#1f2937;--siab-neutral-900:#111827;--siab-neutral-950:#030712}`,
    `${providerSurfaceRoots}{background-color:var(--color-tailwindplus-surface,var(--color-bg,#ffffff))}`,
    `${providerSurfaceDescendants}{background-color:var(--color-tailwindplus-card,var(--color-card,var(--color-bg,#ffffff)))}`,
    `${rootsAndDescendants(["bg-white\\/60"])}{background-color:color-mix(in oklab,var(--color-tailwindplus-card,var(--color-card,var(--color-bg,#ffffff))) 60%,transparent)}`,
    `${rootsAndDescendants(["bg-gray-50"])}{background-color:var(--siab-neutral-50,#f9fafb)}`,
    `${rootsAndDescendants(["bg-gray-100"])}{background-color:var(--siab-neutral-100,#f3f4f6)}`,
    `${rootsAndDescendants(["hover\\:bg-gray-50"], ":hover")}{background-color:var(--siab-neutral-50,#f9fafb)}`,
    `${rootsAndDescendants(["hover\\:bg-gray-100"], ":hover")}{background-color:var(--siab-neutral-100,#f3f4f6)}`,
    `${rootsAndDescendants(["bg-gray-200"])}{background-color:var(--siab-neutral-200,#e5e7eb)}`,
    `${rootsAndDescendants(["bg-gray-900"])}{background-color:#111827}`,
    `${rootsAndDescendants(["hover\\:bg-gray-700"], ":hover")}{background-color:#374151}`,
    `${fixedDarkTextWhiteSelectors},${rootsAndDescendants(["bg-gray-900.text-white"])}{color:#ffffff}`,
    `${classToken("bg-white/5")}{background-color:rgb(255 255 255 / 0.05)}`,
    `${providerRootSelectors.map((selector) => `${selector} .flex.bg-white :is(input,select)`).join(",")}{background-color:transparent}`,
    `${rootsAndDescendants(["text-gray-950"])}{color:var(--siab-neutral-950,var(--color-ink,#030712))}`,
    `${rootsAndDescendants(["text-gray-900"])}{color:var(--siab-neutral-900,var(--color-ink,#111827))}`,
    `${rootsAndDescendants(["text-gray-800"])}{color:var(--siab-neutral-800,#1f2937)}`,
    `${rootsAndDescendants(["text-gray-700"])}{color:var(--siab-neutral-700,#374151)}`,
    `${rootsAndDescendants(["text-gray-600"])}{color:var(--siab-neutral-600,var(--color-ink-muted,#4b5563))}`,
    `${rootsAndDescendants(["text-gray-500"])}{color:var(--siab-neutral-500,#6b7280)}`,
    `${rootsAndDescendants(["text-gray-400"])}{color:var(--siab-neutral-400,#9ca3af)}`,
    `${rootsAndDescendants(["text-gray-300"])}{color:var(--siab-neutral-300,#d1d5db)}`,
    `${rootsAndDescendants(["placeholder\\:text-gray-400"], "::placeholder")}{color:var(--siab-neutral-400,#9ca3af)}`,
    `${rootsAndDescendants(["placeholder\\:text-gray-500"], "::placeholder")}{color:var(--siab-neutral-500,#6b7280)}`,
    `${groupHover(["group-hover\\:text-gray-600"])}{color:var(--siab-neutral-600,var(--color-ink-muted,#4b5563))}`,
    `${rootsAndDescendants(["text-indigo-700"])}{color:var(--siab-accent-700,#4338ca)}`,
    `${rootsAndDescendants(["text-indigo-600"])}{color:var(--siab-accent-600,var(--color-accent,#4f46e5))}`,
    `${rootsAndDescendants(["text-indigo-500"])}{color:var(--siab-accent-500,#6366f1)}`,
    `${rootsAndDescendants(["text-indigo-400"])}{color:var(--siab-accent-400,#818cf8)}`,
    `${rootsAndDescendants(["bg-indigo-700"])}{background-color:var(--siab-accent-700,#4338ca)}`,
    `${rootsAndDescendants(["bg-indigo-600"])}{background-color:var(--siab-accent-600,var(--color-accent,#4f46e5))}`,
    `${rootsAndDescendants(["bg-indigo-500"])}{background-color:var(--siab-accent-500,#6366f1)}`,
    `${rootsAndDescendants(["bg-indigo-400"])}{background-color:var(--siab-accent-400,#818cf8)}`,
    `${rootsAndDescendants(["hover\\:bg-indigo-500"], ":hover")}{background-color:var(--siab-accent-500,#6366f1)}`,
    `${rootsAndDescendants(["hover\\:bg-indigo-400"], ":hover")}{background-color:var(--siab-accent-400,#818cf8)}`,
    `${rootsAndDescendants(["has-checked\\:bg-indigo-600"], ":has(:checked)")}{background-color:var(--siab-accent-600,var(--color-accent,#4f46e5))}`,
    `${rootsAndDescendants(["outline-indigo-600", "focus\\:outline-indigo-500", "focus-visible\\:outline-indigo-500"])}{outline-color:var(--siab-accent-600,var(--color-accent,#4f46e5))}`,
    `${classToken("has-[input:focus-within]:outline-indigo-600")}{outline-color:var(--siab-accent-600,var(--color-accent,#4f46e5))}`,
    `${rootsAndDescendants(["focus\\:ring-indigo-600"], ":focus")}{--tw-ring-color:var(--siab-accent-600,var(--color-accent,#4f46e5))}`,
    `${rootsAndDescendants(["focus\\:outline-indigo-600"], ":focus")}{outline-color:var(--siab-accent-600,var(--color-accent,#4f46e5))}`,
    `${rootsAndDescendants(["focus-visible\\:outline-indigo-600"], ":focus-visible")}{outline-color:var(--siab-accent-600,var(--color-accent,#4f46e5))}`,
    `${rootsAndDescendants(["bg-indigo-700.text-white", "bg-indigo-600.text-white"])}{color:var(--color-on-accent,#ffffff)}`,
    `${rootsAndDescendants(["bg-indigo-500.text-white"])}{color:var(--color-on-accent-500,var(--color-on-accent,#ffffff))}`,
    `${rootsAndDescendants(["bg-indigo-400.text-white"])}{color:var(--color-on-accent-400,var(--color-on-accent,#ffffff))}`,
    `${providerRootSelectors.map((selector) => `${selector} input[type="checkbox"].text-indigo-600`).join(",")}{accent-color:var(--siab-accent-600,var(--color-accent,#4f46e5))}`,
    `${descendant("ring-gray-900\\/10")},${descendant("-ring-gray-900\\/5")},${descendant("ring-gray-900\\/5")},${descendant("inset-ring-gray-900\\/5")}{--tw-ring-color:color-mix(in oklab,var(--color-ink,#111827) 10%,transparent)}`,
    `${descendant("hover\\:ring-gray-900\\/20", ":hover")}{--tw-ring-color:color-mix(in oklab,var(--color-ink,#111827) 20%,transparent)}`,
    `${descendant("ring-gray-400\\/10")}{--tw-ring-color:color-mix(in oklab,var(--color-ink-muted,#64748b) 10%,transparent)}`,
    `${descendant("ring-indigo-50")},${descendant("inset-ring-indigo-200")},${descendant("hover\\:inset-ring-indigo-300", ":hover")}{--tw-ring-color:color-mix(in oklab,var(--color-accent,#4f46e5) 20%,transparent)}`,
    `${classToken("shadow-indigo-600/10")}{--tw-shadow-color:color-mix(in oklab,var(--color-accent,#4f46e5) 10%,transparent)}`,
    `${classToken("ring-white/10")}{--tw-ring-color:rgb(255 255 255 / 0.1)}`,
    `${descendants(["outline-gray-300", "border-gray-300", "border-gray-200", "divide-gray-200", "stroke-gray-200"])}{border-color:var(--color-rule,rgba(17,24,39,.12));outline-color:var(--color-rule,rgba(17,24,39,.12));stroke:var(--color-rule,rgba(17,24,39,.12))}`,
    `${classTokens(["border-gray-600/10"])}{border-color:color-mix(in oklab,var(--color-ink-muted,#4b5563) 10%,transparent)}`,
    `${classTokens(["border-gray-700"])}{border-color:#374151}`,
    `${classTokens(["border-r-white/10"])}{border-right-color:rgb(255 255 255 / 0.1)}`,
    `${classTokens(["border-b-white/20"])}{border-bottom-color:rgb(255 255 255 / 0.2)}`,
    `${descendants(["outline-black\\/5"])}{outline-color:color-mix(in oklab,var(--color-ink,#111827) 5%,transparent)}`,
    `${classTokens(["outline-white/5"])}{outline-color:rgb(255 255 255 / 0.05)}`,
    `${classTokens(["outline-white/10"])}{outline-color:rgb(255 255 255 / 0.1)}`,
    `${classToken("focus-visible:outline-white", ":focus-visible")}{outline-color:#ffffff}`,
    `${classToken("focus-visible:outline-gray-900", ":focus-visible")}{outline-color:var(--siab-neutral-900,var(--color-ink,#111827))}`,
    `${classTokens(["fill-gray-50"])}{fill:var(--siab-neutral-50,#f9fafb)}`,
    `${classTokens(["fill-gray-900"])}{fill:var(--siab-neutral-900,var(--color-ink,#111827))}`,
    `${classTokens(["from-[#ff80b5]"])}{--tw-gradient-from:var(--color-tailwindplus-source-glow-soft-from,#ff80b5);--tw-gradient-stops:var(--tw-gradient-via-stops,var(--tw-gradient-position),var(--tw-gradient-from)var(--tw-gradient-from-position),var(--tw-gradient-to)var(--tw-gradient-to-position))}`,
    `${classTokens(["to-[#9089fc]"])}{--tw-gradient-to:var(--color-tailwindplus-source-glow-soft-to,#9089fc)}`,
    `${classTokens(["from-[#ff4694]"])}{--tw-gradient-from:var(--color-tailwindplus-source-glow-vivid-from,#ff4694);--tw-gradient-stops:var(--tw-gradient-via-stops,var(--tw-gradient-position),var(--tw-gradient-from)var(--tw-gradient-from-position),var(--tw-gradient-to)var(--tw-gradient-to-position))}`,
    `${classTokens(["to-[#776fff]"])}{--tw-gradient-to:var(--color-tailwindplus-source-glow-vivid-to,#776fff)}`,
    `${dataToken("data-siab-tokenized-gradient", "hero-glow")}{--tw-gradient-from:var(--color-tailwindplus-hero-glow-from,#ff80b5);--tw-gradient-to:var(--color-tailwindplus-hero-glow-to,#9089fc);--tw-gradient-stops:var(--tw-gradient-via-stops,var(--tw-gradient-position),var(--tw-gradient-from)var(--tw-gradient-from-position),var(--tw-gradient-to)var(--tw-gradient-to-position))}`,
    `${dataToken("data-siab-tokenized-gradient", "testimonial-radial")},${classToken("bg-[radial-gradient(45rem_50rem_at_top,var(--color-indigo-100),white)]")}{background-image:radial-gradient(45rem 50rem at top,var(--color-tailwindplus-testimonial-radial-from,var(--color-indigo-100)),var(--color-tailwindplus-testimonial-radial-to,var(--color-tailwindplus-surface,var(--color-bg,#ffffff))))}`,
    `${dataToken("data-siab-tokenized-gradient", "testimonial-skew-panel")}{background-color:var(--color-tailwindplus-testimonial-panel,var(--color-tailwindplus-card,var(--color-bg,#ffffff)))}`,
    `${providerRootSelectors.map((selector) => `${selector}[data-provider-variant="tailwindplus.marketing.logo-cloud.simple-with-heading"] img[src*="-logo-gray-900.svg"]`).join(",")}{filter:var(--tailwindplus-logo-filter,none)}`,
  )
  if (options.fonts) rules.push(
    `${providerRootSelectors.join(",")}{font-family:var(--font-text,var(--font-sans,inherit))}`,
    `${providerRootSelectors.map((selector) => `${selector} :is(p,dd,li,label,input,select,textarea,button,a,span,div,time,strong,small,figcaption)`).join(",")}{font-family:var(--font-text,var(--font-sans,inherit))}`,
    `${providerRootSelectors.map((selector) => `${selector} :is(h1)`).join(",")}{font-family:var(--font-title,var(--font-sans,inherit))}`,
    `${providerRootSelectors.map((selector) => `${selector} :is(h2,h3,h4,dt,legend,blockquote)`).join(",")}{font-family:var(--font-heading,var(--font-sans,inherit))}`,
    `${providerRootSelectors.map((selector) => `${selector} :is(h1,h2,h3,h4,dt,legend,blockquote) :is(span,div,strong,small)`).join(",")}{font-family:inherit}`,
  )
  if (options.density) rules.push(
    `${providerRootSelectors.map((selector) => `${selector}:is(.py-16,.py-24,.py-32)`).join(",")}{padding-top:var(--site-section-padding-y,6rem);padding-bottom:var(--site-section-padding-y,6rem)}`,
    `@media (min-width:40rem){${providerRootSelectors.map((selector) => `${selector}:is(.sm\\:py-24,.sm\\:py-32,.sm\\:py-48)`).join(",")}{padding-top:var(--site-section-padding-y-sm,var(--site-section-padding-y,8rem));padding-bottom:var(--site-section-padding-y-sm,var(--site-section-padding-y,8rem))}}`,
    `@media (min-width:64rem){${providerRootSelectors.map((selector) => `${selector}:is(.lg\\:py-32,.lg\\:py-56)`).join(",")}{padding-top:var(--site-section-padding-y-lg,var(--site-section-padding-y-sm,var(--site-section-padding-y,8rem)));padding-bottom:var(--site-section-padding-y-lg,var(--site-section-padding-y-sm,var(--site-section-padding-y,8rem)))}}`,
  )
  return rules
}

export function themeMode(theme: ThemeTokenSpec | null | undefined): "light" | "dark" {
  const resolved = resolveThemeTokens(theme)
  if (resolved.mode === "system") return resolved.systemFallbackMode
  return resolved.mode
}

export function themeToCssVars(
  theme: ThemeTokenSpec | null | undefined,
  scope: ThemeCssVarScope = ".rt-canvas",
): string {
  const resolved = resolveThemeTokens(theme)
  const baseParts: string[] = []
  const darkParts: string[] = []
  const colorSchemeId = theme?.colors?.schemeId ?? "blue-professional"
  const usesNativeTailwindHeroGlow = colorSchemeId === "blue-professional"
  const sourceGlowFor = (mode: typeof resolved.light) => {
    const soft = {
      from: usesNativeTailwindHeroGlow ? "#ff80b5" : mode.accent[300],
      to: usesNativeTailwindHeroGlow ? "#9089fc" : mode.accent[600],
    }
    const vivid = {
      from: usesNativeTailwindHeroGlow ? "#ff4694" : mode.accent[400],
      to: usesNativeTailwindHeroGlow ? "#776fff" : mode.accent[600],
    }
    return { soft, vivid }
  }
  const writeMode = (parts: string[], mode: typeof resolved.light) => {
    const sourceGlow = sourceGlowFor(mode)
    set(parts, "--color-accent", mode.accent[600])
    set(parts, "--color-on-accent", mode.onAccent)
    set(parts, "--color-on-accent-500", onAccentColor(undefined, mode.accent[500]))
    set(parts, "--color-on-accent-400", onAccentColor(undefined, mode.accent[400]))
    set(parts, "--color-bg", mode.surface)
    set(parts, "--color-ink", mode.ink)
    set(parts, "--color-ink-muted", mode.muted)
    set(parts, "--color-card", mode.surface)
    set(parts, "--color-secondary", mode.neutral[50])
    set(parts, "--color-rule", mode.rule)
    set(parts, "--color-tailwindplus-surface", mode.surface)
    set(parts, "--color-tailwindplus-card", mode.surface)
    set(parts, "--color-tailwindplus-testimonial-radial-from", mode.accent[100])
    set(parts, "--color-tailwindplus-testimonial-radial-to", mode.surface)
    set(parts, "--color-tailwindplus-testimonial-panel", mode.surface)
    set(parts, "--color-tailwindplus-source-glow-soft-from", sourceGlow.soft.from)
    set(parts, "--color-tailwindplus-source-glow-soft-to", sourceGlow.soft.to)
    set(parts, "--color-tailwindplus-source-glow-vivid-from", sourceGlow.vivid.from)
    set(parts, "--color-tailwindplus-source-glow-vivid-to", sourceGlow.vivid.to)
    set(parts, "--color-tailwindplus-hero-glow-from", sourceGlow.soft.from)
    set(parts, "--color-tailwindplus-hero-glow-to", sourceGlow.soft.to)
    for (const shade of ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"] as const) {
      set(parts, `--siab-neutral-${shade}`, mode.neutral[shade])
      set(parts, `--siab-accent-${shade}`, mode.accent[shade])
    }
  }

  writeMode(baseParts, resolved.light)
  writeMode(darkParts, resolved.dark)
  set(darkParts, "--color-tailwindplus-testimonial-radial-from", `color-mix(in oklab,${resolved.dark.accent[300]} 28%,${resolved.dark.surface})`)
  set(darkParts, "--color-tailwindplus-testimonial-radial-to", `color-mix(in oklab,${resolved.dark.accent[950]} 42%,${resolved.dark.surface})`)
  set(darkParts, "--color-tailwindplus-testimonial-panel", `color-mix(in oklab,${resolved.dark.accent[950]} 32%,${resolved.dark.surface})`)
  set(darkParts, "--tailwindplus-logo-filter", "invert(1) brightness(1.6) grayscale(1)")

  set(baseParts, "--font-title", resolved.fonts.roles.display ?? resolved.fonts.roles.heading)
  set(baseParts, "--font-heading", resolved.fonts.roles.heading)
  set(baseParts, "--font-text", resolved.fonts.roles.body)
  set(baseParts, "--font-sans", resolved.fonts.roles.body)
  set(baseParts, "--font-serif", resolved.fonts.roles.heading)
  set(baseParts, "--font-mono", resolved.fonts.roles.mono)

  set(baseParts, "--site-density", resolved.density.id)
  set(baseParts, "--site-section-padding-y", resolved.density.sectionPaddingY.base)
  set(baseParts, "--site-section-padding-y-sm", resolved.density.sectionPaddingY.sm ?? resolved.density.sectionPaddingY.base)
  set(baseParts, "--site-section-padding-y-lg", resolved.density.sectionPaddingY.lg ?? resolved.density.sectionPaddingY.sm ?? resolved.density.sectionPaddingY.base)

  set(baseParts, "--radius-none", resolved.shape.radius.none)
  set(baseParts, "--radius-sm", resolved.shape.radius.sm)
  set(baseParts, "--radius-md", resolved.shape.radius.md)
  set(baseParts, "--radius-lg", resolved.shape.radius.lg)
  set(baseParts, "--radius-xl", resolved.shape.radius.xl)
  set(baseParts, "--radius-2xl", resolved.shape.radius["2xl"])
  set(baseParts, "--radius-3xl", resolved.shape.radius["3xl"])
  set(baseParts, "--radius-4xl", resolved.shape.radius["4xl"])
  set(baseParts, "--radius-full", resolved.shape.radius.full)

  const baseSelector = scope === ":root" ? "html:root" : scope
  const darkSelector = scope === ":root" ? "html:root[data-rt-mode=\"dark\"]" : `${scope}[data-rt-mode="dark"]`
  const rules: string[] = []
  if (baseParts.length > 0) rules.push(`${baseSelector}{${baseParts.join(";")}}`)
  if (darkParts.length > 0) rules.push(`${darkSelector}{${darkParts.join(";")}}`)
  rules.push(`${baseSelector}{background-color:var(--color-bg,#ffffff);color:var(--color-ink,#111827)}`)
  rules.push(...providerThemeBridgeRules(scope, { colors: true, fonts: true, density: resolved.density.id !== "comfortable" }))
  const darkProviderSelectors = [
    `${darkSelector}:where([data-provider-block="tailwindplus"])`,
    `${darkSelector}:where([data-provider-chrome="tailwindplus"])`,
    `${darkSelector}:where([data-provider-template="tailwindplus"])`,
    `${darkSelector}:where([data-provider-top-stack="tailwindplus"])`,
    `${darkSelector} :where([data-provider-block="tailwindplus"])`,
    `${darkSelector} :where([data-provider-chrome="tailwindplus"])`,
    `${darkSelector} :where([data-provider-template="tailwindplus"])`,
    `${darkSelector} :where([data-provider-top-stack="tailwindplus"])`,
  ]
  rules.push(
    darkProviderSelectors.map((selector) => `${selector} :is(.text-indigo-700,.text-indigo-600,.text-indigo-500)`).join(",")
      + "{color:var(--siab-accent-400,#818cf8)}",
  )
  return rules.join(" ")
}
