"use client"
import * as React from "react"
import type { FontSchemeId } from "@siteinabox/contracts"
import { DEFAULT_THEME_TOKEN_SPEC } from "@siteinabox/contracts"
import type { FontPreset } from "@/lib/theme/presets"
import { formatRuntimeCssValue, useCspStyleRule } from "@siteinabox/ui/lib/csp-style"

export const FontPicker: React.FC<{
  fonts: FontPreset[]
  value: FontSchemeId | undefined
  onChange: (next: { schemeId: FontSchemeId }) => void
}> = ({ fonts, value, onChange }) => {
  const activeId = value ?? DEFAULT_THEME_TOKEN_SPEC.fonts.schemeId

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
