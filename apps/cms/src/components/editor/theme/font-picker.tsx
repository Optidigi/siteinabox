"use client"
import * as React from "react"
import type { ThemeTokens } from "@/lib/theme/schema"
import type { RtManifest } from "@/lib/richText/manifest"
import { formatRuntimeCssValue, useCspStyleRule } from "@siteinabox/ui/lib/csp-style"

type Fonts = NonNullable<ThemeTokens["fonts"]>

export type FontPreset = {
  id: string
  label: string
  fonts: Fonts
}

function fontsMatchPreset(value: Fonts | undefined, preset: Fonts): boolean {
  // Default preset matches when theme.fonts is empty/undefined.
  const isDefault = !preset.title && !preset.heading && !preset.text
  if (isDefault) {
    return !value || (!value.title && !value.heading && !value.text)
  }
  if (!value) return false
  return (
    value.title === preset.title &&
    value.heading === preset.heading &&
    value.text === preset.text
  )
}

function resolveRole(
  role: "title" | "heading" | "text",
  presetFonts: Fonts,
  manifestFonts: Fonts | undefined,
): string {
  // Explicit preset value wins. Otherwise fall back to the manifest's
  // role-mapped default. Otherwise a system default.
  if (presetFonts[role]) return presetFonts[role] as string
  if (manifestFonts?.[role]) return manifestFonts[role] as string
  const FALLBACK: Record<"title" | "heading" | "text", string> = {
    title: "Georgia, serif",
    heading: "system-ui, sans-serif",
    text: "system-ui, sans-serif",
  }
  return FALLBACK[role]
}

export const FontPicker: React.FC<{
  fonts: FontPreset[]
  value: ThemeTokens["fonts"]
  manifest: RtManifest
  onChange: (next: Fonts) => void
}> = ({ fonts, value, manifest, onChange }) => {
  // Manifest fonts — typed escape hatch since RtManifest may not expose
  // a `fonts` field today. If/when it does, prefer it. Otherwise the
  // FALLBACK in resolveRole kicks in.
  const manifestFonts = (manifest as unknown as { fonts?: Fonts }).fonts

  const activeId = fonts.find((p) => fontsMatchPreset(value ?? undefined, p.fonts))?.id

  return (
    // Compact vertical list — each row is the preset name set in its own
    // heading face, so the picker doubles as its own legend (the way macOS
    // / iOS / Figma font menus work). Click target stays large via py-2.
    <div className="flex w-[14rem] flex-col">
      {fonts.map((preset) => {
        const isActive = activeId === preset.id
        const headingFont = resolveRole("heading", preset.fonts, manifestFonts)
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange(preset.fonts)}
            aria-pressed={isActive}
            aria-label={`Apply ${preset.label} font preset`}
            className={[
              "group flex w-full items-center justify-between rounded-sm px-2 py-2 text-left outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring",
              isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
            ].join(" ")}
          >
            <FontPresetLabel font={headingFont} label={preset.label} />
            <span
              aria-hidden
              className={[
                "ml-2 size-1.5 shrink-0 rounded-full transition-opacity",
                isActive ? "bg-primary opacity-100" : "opacity-0",
              ].join(" ")}
            />
          </button>
        )
      })}
    </div>
  )
}

function FontPresetLabel({ font, label }: { font: string; label: string }) {
  const fontValue = formatRuntimeCssValue(font)
  const labelStyle = useCspStyleRule(
    "font-picker-label",
    fontValue ? `font-family:${fontValue};` : null,
  )
  return (
    <>
      {labelStyle.styleElement}
      <span className={`${labelStyle.className} truncate text-[15px] leading-tight`}>
        {label}
      </span>
    </>
  )
}
