import * as React from "react"
import type { ThemeTokenSpec } from "@siteinabox/contracts"

const DEFAULT_DARK = {
  bg: "#09090b",
  ink: "#fafafa",
  muted: "#a1a1aa",
  card: "#18181b",
  secondary: "#27272a",
  rule: "rgba(255, 255, 255, 0.12)",
} as const

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
  return [
    ["--radius-sm", `${Math.max(parsed.num - 0.25, 0)}${parsed.unit}`],
    ["--radius-md", md],
    ["--radius-lg", `${parsed.num + 0.5}${parsed.unit}`],
  ]
}

function set(parts: string[], prop: string, value: string | undefined | null) {
  if (value != null && value !== "") parts.push(`${prop}:${value}`)
}

export function themeMode(theme: ThemeTokenSpec | null | undefined): "light" | "dark" {
  return theme?.mode === "dark" ? "dark" : "light"
}

export function themeToCssVars(
  theme: ThemeTokenSpec | null | undefined,
  scope: ".rt-canvas" | ":root" = ".rt-canvas",
): string {
  if (!theme) return ""

  const baseParts: string[] = []
  const darkParts: string[] = []
  const flatten = scope === ":root" && theme.mode === "dark"

  if (flatten) {
    const dark = theme.darkColors
    if (dark?.accent) set(baseParts, "--color-accent", dark.accent)
    set(baseParts, "--color-bg", dark?.bg ?? DEFAULT_DARK.bg)
    set(baseParts, "--color-ink", dark?.ink ?? DEFAULT_DARK.ink)
    set(baseParts, "--color-ink-muted", dark?.muted ?? DEFAULT_DARK.muted)
    set(baseParts, "--color-card", dark?.card ?? DEFAULT_DARK.card)
    set(baseParts, "--color-secondary", dark?.secondary ?? DEFAULT_DARK.secondary)
    set(baseParts, "--color-rule", dark?.rule ?? DEFAULT_DARK.rule)
  } else {
    const colors = theme.colors
    set(baseParts, "--color-accent", colors?.accent)
    set(baseParts, "--color-bg", colors?.bg)
    set(baseParts, "--color-ink", colors?.ink)
    set(baseParts, "--color-ink-muted", colors?.muted)
    set(baseParts, "--color-card", colors?.card)
    set(baseParts, "--color-secondary", colors?.secondary)
    set(baseParts, "--color-rule", colors?.rule)

    const dark = theme.darkColors
    set(darkParts, "--color-accent", dark?.accent)
    set(darkParts, "--color-bg", dark?.bg)
    set(darkParts, "--color-ink", dark?.ink)
    set(darkParts, "--color-ink-muted", dark?.muted)
    set(darkParts, "--color-card", dark?.card)
    set(darkParts, "--color-secondary", dark?.secondary)
    set(darkParts, "--color-rule", dark?.rule)
  }

  set(baseParts, "--font-title", theme.fonts?.title)
  set(baseParts, "--font-heading", theme.fonts?.heading)
  set(baseParts, "--font-text", theme.fonts?.text)
  set(baseParts, "--font-script", theme.fonts?.script)

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

export function ThemeStyle({
  theme,
  scope = ".rt-canvas",
  nonce,
}: {
  theme?: ThemeTokenSpec | null
  scope?: ".rt-canvas" | ":root"
  nonce?: string
}) {
  const css = themeToCssVars(theme, scope)
  if (!css) return null

  return (
    <style
      nonce={nonce}
      suppressHydrationWarning
      data-siab-theme-overrides
      dangerouslySetInnerHTML={{ __html: css }}
    />
  )
}
