import type { ThemeTokens } from "@/lib/theme/schema"

const hasValue = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0

export const RENDERER_FONT_FAMILIES = [
  "Inter Variable",
  "Fraunces Variable",
  "Caveat Variable",
] as const

type RendererFontFamily = typeof RENDERER_FONT_FAMILIES[number]
type FontRole = "title" | "heading" | "text" | "script"

const FONT_ALIAS_FALLBACKS: Record<FontRole, RendererFontFamily> = {
  title: "Fraunces Variable",
  heading: "Fraunces Variable",
  text: "Inter Variable",
  script: "Caveat Variable",
}

const normalizeFamilyToken = (value: string): string =>
  value
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .toLowerCase()

export const normalizeRendererFontFamily = (
  value: string | undefined,
  role: FontRole,
): RendererFontFamily | undefined => {
  if (!hasValue(value)) return undefined

  const tokens = value.split(",").map(normalizeFamilyToken).filter(Boolean)
  const joined = tokens.join(" ")

  if (tokens.some((token) => token.includes("fraunces"))) return "Fraunces Variable"
  if (tokens.some((token) => token.includes("caveat"))) return "Caveat Variable"
  if (tokens.some((token) => token.includes("inter"))) return "Inter Variable"
  if (role === "script") return "Caveat Variable"

  if (tokens.some((token) => token === "system-ui" || token === "sans-serif" || token === "arial" || token.includes("sans"))) {
    return "Inter Variable"
  }
  if (tokens.some((token) => token === "serif" || token === "georgia" || token.includes("serif") || token.includes("lora") || token.includes("playfair"))) {
    return "Fraunces Variable"
  }
  if (tokens.some((token) => token === "cursive" || token.includes("script") || token.includes("pacifico") || token.includes("dancing"))) {
    return "Caveat Variable"
  }

  if (joined.length === 0) return undefined
  return FONT_ALIAS_FALLBACKS[role]
}

export const normalizeThemeFonts = (fonts: ThemeTokens["fonts"] | undefined): ThemeTokens["fonts"] | undefined => {
  if (!fonts) return undefined
  const normalized = {
    title: normalizeRendererFontFamily(fonts.title, "title"),
    heading: normalizeRendererFontFamily(fonts.heading, "heading"),
    text: normalizeRendererFontFamily(fonts.text, "text"),
    script: normalizeRendererFontFamily(fonts.script, "script"),
  }
  return pruneRecord(normalized)
}

const pruneRecord = <T extends Record<string, string | undefined>>(
  value: T | undefined,
  normalize?: (key: keyof T, value: string) => string | undefined,
): T | undefined => {
  if (!value) return undefined
  const entries = Object.entries(value).flatMap(([key, entry]) => {
    if (!hasValue(entry)) return []
    const normalized = normalize ? normalize(key as keyof T, entry) : entry
    return hasValue(normalized) ? [[key, normalized]] : []
  })
  if (entries.length === 0) return undefined
  return Object.fromEntries(entries) as T
}

export const normalizeThemeForSave = (theme: ThemeTokens | null | undefined): ThemeTokens | null => {
  if (!theme) return null

  const normalized: ThemeTokens = {}
  const palette = pruneRecord(theme.palette)
  const darkPalette = pruneRecord(theme.darkPalette)
  const fonts = normalizeThemeFonts(theme.fonts)

  if (palette) normalized.palette = palette
  if (darkPalette) normalized.darkPalette = darkPalette
  if (fonts) normalized.fonts = fonts
  if (hasValue(theme.radius)) normalized.radius = theme.radius
  if (theme.density) normalized.density = theme.density
  if (hasValue(theme.stylePreset)) normalized.stylePreset = theme.stylePreset
  if (theme.borderStyle) normalized.borderStyle = theme.borderStyle

  if (theme.mode) normalized.mode = theme.mode

  return Object.keys(normalized).length > 0 ? normalized : null
}
