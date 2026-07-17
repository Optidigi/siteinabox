import type { ThemeTokens } from "./schema"
import { formatRuntimeCssValue } from "@siteinabox/ui/lib/csp-style"
import { resolveThemeTokens } from "@siteinabox/site-renderer/theme/resolve"

export function inspectorThemeDeclarations(theme: ThemeTokens | null | undefined): string {
  const resolved = resolveThemeTokens(theme)
  const title = cssValue(resolved.fonts.roles.display ?? resolved.fonts.roles.heading, "inherit")
  const heading = cssValue(resolved.fonts.roles.heading, "inherit")
  const text = cssValue(resolved.fonts.roles.body, "inherit")
  return [
    `--rt-inspector-font-title:${title}`,
    `--rt-inspector-font-heading:${heading}`,
    `--rt-inspector-font-text:${text}`,
    `--font-title:${title}`,
    `--font-heading:${heading}`,
    `--font-text:${text}`,
    `--color-bg:${cssValue(resolved.light.surface, "transparent")}`,
    `--color-ink:${cssValue(resolved.light.ink, "currentColor")}`,
    `--color-ink-muted:${cssValue(resolved.light.muted, "currentColor")}`,
    `--color-accent:${cssValue(resolved.light.accent[600], "currentColor")}`,
  ].join(";") + ";"
}

export function inspectorFontValue(theme: ThemeTokens | null | undefined, cssVar: string): string {
  const fonts = resolveThemeTokens(theme).fonts.roles
  if (cssVar === "--font-title") return fonts.display ?? fonts.heading
  if (cssVar === "--font-heading") return fonts.heading
  if (cssVar === "--font-text") return fonts.body
  return `var(${cssVar}, inherit)`
}

function cssValue(value: string, fallback: string): string {
  return formatRuntimeCssValue(value) ?? fallback
}
