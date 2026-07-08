"use client"
import * as React from "react"
import type { FontSchemeId } from "@siteinabox/contracts"
import { DEFAULT_THEME_TOKEN_SPEC } from "@siteinabox/contracts"
import type { FontPreset } from "@/lib/theme/presets"
import { MobilePickerOption } from "@/components/common/mobile-picker-option"
import { InlineToolbarGroup, InlineToolbarOption } from "@/components/common/inline-toolbar-group"
import { formatFontFamilyCssValue, formatRuntimeCssValue, useCspStyleRule } from "@siteinabox/ui/lib/csp-style"
import { cn } from "@siteinabox/ui/lib/utils"

const FONT_GLYPH_PREVIEW_FAMILIES: Record<FontSchemeId, string> = {
  "clear-modern": '"Inter Variable", Inter, var(--font-sans), ui-sans-serif, system-ui, sans-serif',
  "classic-editorial": '"Fraunces Variable", Georgia, ui-serif, serif',
  "friendly-organic": 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
}

export const FontPicker: React.FC<{
  fonts: FontPreset[]
  value: FontSchemeId | undefined
  onChange: (next: { schemeId: FontSchemeId }) => void
  layout?: "list" | "row" | "glyph" | "segment"
  sizeClassName?: string
}> = ({ fonts, value, onChange, layout = "list", sizeClassName }) => {
  const activeId = value ?? DEFAULT_THEME_TOKEN_SPEC.fonts.schemeId

  if (layout === "segment") {
    return (
      <InlineToolbarGroup>
        {fonts.map((preset) => {
          const isActive = activeId === preset.id
          return (
            <InlineToolbarOption
              key={preset.id}
              active={isActive}
              onClick={() => onChange({ schemeId: preset.id })}
              ariaLabel={`Apply ${preset.label} font preset`}
            >
              <FontPresetGlyph fontId={preset.id} size="segment" />
            </InlineToolbarOption>
          )
        })}
      </InlineToolbarGroup>
    )
  }

  if (layout === "glyph") {
    return (
      <div className={cn("flex justify-center", sizeClassName === "size-8" ? "gap-1.5" : "gap-3")}>
        {fonts.map((preset) => {
          const isActive = activeId === preset.id
          return (
            <MobilePickerOption
              key={preset.id}
              active={isActive}
              onClick={() => onChange({ schemeId: preset.id })}
              ariaLabel={`Apply ${preset.label} font preset`}
              sizeClassName={sizeClassName}
            >
              <FontPresetGlyph fontId={preset.id} compact={sizeClassName === "size-8"} />
            </MobilePickerOption>
          )
        })}
      </div>
    )
  }

  if (layout === "row") {
    return (
      <div className="flex max-w-[min(100vw-2rem,20rem)] flex-wrap gap-2">
        {fonts.map((preset) => {
          const isActive = activeId === preset.id
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange({ schemeId: preset.id })}
              aria-pressed={isActive}
              aria-label={`Apply ${preset.label} font preset`}
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1.5 text-left outline-none transition-colors",
                "focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-background hover:bg-accent/50",
              )}
            >
              <FontPresetLabel font={preset.previewFont} label={preset.label} compact />
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex w-[14rem] flex-col">
      {fonts.map((preset) => {
        const isActive = activeId === preset.id
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange({ schemeId: preset.id })}
            aria-pressed={isActive}
            aria-label={`Apply ${preset.label} font preset`}
            className={[
              "group flex w-full items-center justify-between rounded-sm px-2 py-2 text-left outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring",
              isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
            ].join(" ")}
          >
            <FontPresetLabel font={preset.previewFont} label={preset.label} />
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

function FontPresetLabel({
  font,
  label,
  compact = false,
}: {
  font: string
  label: string
  compact?: boolean
}) {
  const fontValue = formatFontFamilyCssValue(font) ?? formatRuntimeCssValue(font)
  const labelStyle = useCspStyleRule(
    "font-picker-label",
    fontValue ? `font-family:${fontValue};` : null,
  )
  return (
    <>
      {labelStyle.styleElement}
      <span
        className={cn(
          labelStyle.className,
          "truncate leading-tight",
          compact ? "text-sm" : "text-[15px]",
        )}
      >
        {label}
      </span>
    </>
  )
}

function FontPresetGlyph({
  fontId,
  compact = false,
  size = compact ? "compact" : "default",
}: {
  fontId: FontSchemeId
  compact?: boolean
  size?: "compact" | "segment" | "default"
}) {
  const fontValue = formatFontFamilyCssValue(FONT_GLYPH_PREVIEW_FAMILIES[fontId])
  const glyphStyle = useCspStyleRule(
    `font-picker-glyph-${fontId}`,
    fontValue ? `font-family:${fontValue};` : null,
  )
  const resolvedSize = compact ? "compact" : size
  return (
    <>
      {glyphStyle.styleElement}
      <span
        className={cn(
          glyphStyle.className,
          "inline-flex items-baseline leading-none",
          resolvedSize === "compact" && "text-sm",
          resolvedSize === "segment" && "text-base",
          resolvedSize === "default" && "text-lg",
        )}
        aria-hidden
      >
        {resolvedSize === "segment" ? (
          "A"
        ) : (
          <>
            <span className="text-[0.72em]">A</span>
            <span className="text-[0.92em]">a</span>
          </>
        )}
      </span>
    </>
  )
}
