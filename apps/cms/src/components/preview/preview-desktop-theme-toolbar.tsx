"use client"

import * as React from "react"
import { DEFAULT_THEME_TOKEN_SPEC } from "@siteinabox/contracts"
import { FontPicker } from "@/components/editor/theme/font-picker"
import { PalettePicker } from "@/components/editor/theme/palette-picker"
import { ShapeControl } from "@/components/editor/theme/radius-control"
import type { ThemeTokens } from "@/lib/theme/schema"
import { normalizePreviewThemeForSave } from "@/lib/theme/normalizeTheme"
import { FONT_PRESETS, PALETTE_PRESETS, RADIUS_PRESETS } from "@/lib/theme/presets"
import { useTranslations } from "next-intl"

export function PreviewDesktopThemeToolbar({
  theme,
  onThemeChange,
}: {
  theme: ThemeTokens | null
  onThemeChange: React.Dispatch<React.SetStateAction<ThemeTokens | null>>
}) {
  const previewT = useTranslations("preview")

  function handleUpdate(partial: Partial<ThemeTokens>) {
    onThemeChange((current) =>
      normalizePreviewThemeForSave({ ...(current ?? theme ?? DEFAULT_THEME_TOKEN_SPEC), ...partial } as ThemeTokens),
    )
  }

  return (
    <div
      role="group"
      aria-label={previewT("themeControls")}
      className="hidden md:inline-flex md:items-center md:gap-2"
    >
      <PalettePicker
        palettes={PALETTE_PRESETS}
        value={theme?.colors?.schemeId}
        mode={theme?.appearance?.mode ?? "light"}
        layout="inline"
        onChange={(patch) => handleUpdate(patch)}
      />
      <ShapeControl
        shapeId={theme?.shape?.schemeId}
        radiusLevels={RADIUS_PRESETS}
        layout="segment"
        onChange={(next) => handleUpdate({ shape: next })}
      />
      <FontPicker
        fonts={FONT_PRESETS}
        value={theme?.fonts?.schemeId}
        layout="segment"
        onChange={(next) => handleUpdate({ fonts: next })}
      />
    </div>
  )
}
