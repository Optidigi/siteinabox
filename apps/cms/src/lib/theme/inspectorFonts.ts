import type { CSSProperties } from "react"
import type { ThemeTokens } from "./schema"
import type { ElementRole } from "@/components/editor/canvas/blockElements"
import { resolveThemeTokens } from "@siteinabox/site-renderer/theme/resolve"

export function inspectorFontStyle(theme: ThemeTokens | null | undefined): CSSProperties {
  const resolved = resolveThemeTokens(theme)
  return {
    "--rt-inspector-font-title": resolved.fonts.roles.display ?? resolved.fonts.roles.heading,
    "--rt-inspector-font-heading": resolved.fonts.roles.heading,
    "--rt-inspector-font-text": resolved.fonts.roles.body,
  } as CSSProperties
}

export function roleToFontFamily(role: ElementRole | undefined): string {
  switch (role) {
    case "title":   return "var(--rt-inspector-font-title, inherit)"
    case "heading": return "var(--rt-inspector-font-heading, inherit)"
    case "text":    return "var(--rt-inspector-font-text, inherit)"
    case "script":  return "inherit"
    default:        return "inherit"
  }
}
