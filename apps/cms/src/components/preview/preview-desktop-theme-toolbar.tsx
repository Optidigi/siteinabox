"use client"

import * as React from "react"
import { DEFAULT_THEME_TOKEN_SPEC } from "@siteinabox/contracts"
import { Separator } from "@siteinabox/ui/components/separator"
import { FontPicker } from "@/components/editor/theme/font-picker"
import { PalettePicker } from "@/components/editor/theme/palette-picker"
import { DensityControl, ShapeControl } from "@/components/editor/theme/radius-control"
import type { ThemeTokens } from "@/lib/theme/schema"
import { normalizeThemeForSave } from "@/lib/theme/normalizeTheme"
import { DENSITY_PRESETS, FONT_PRESETS, PALETTE_PRESETS, RADIUS_PRESETS } from "@/lib/theme/presets"
import { useTranslations } from "next-intl"

export const PREVIEW_DESKTOP_INLINE_CONTROL_SIZE = "size-8"

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
      normalizeThemeForSave({ ...(current ?? theme ?? DEFAULT_THEME_TOKEN_SPEC), ...partial } as ThemeTokens),
    )
  }

  return (
    <div
      role="group"
      aria-label={previewT("themeControls")}
      className="hidden md:inline-flex md:items-center md:gap-3"
    >
      <PalettePicker
        palettes={PALETTE_PRESETS}
        value={theme?.colors?.schemeId}
        mode={theme?.appearance?.mode ?? "light"}
        layout="inline"
        swatchSizeClassName={PREVIEW_DESKTOP_INLINE_CONTROL_SIZE}
        onChange={(patch) => handleUpdate(patch)}
      />
      <Separator orientation="vertical" className="mx-1 h-8" />
      <ShapeControl
        shapeId={theme?.shape?.schemeId}
        radiusLevels={RADIUS_PRESETS}
        layout="pill"
        sizeClassName={PREVIEW_DESKTOP_INLINE_CONTROL_SIZE}
        onChange={(next) => handleUpdate({ shape: next })}
      />
      <Separator orientation="vertical" className="mx-1 h-8" />
      <FontPicker
        fonts={FONT_PRESETS}
        value={theme?.fonts?.schemeId}
        layout="glyph"
        sizeClassName={PREVIEW_DESKTOP_INLINE_CONTROL_SIZE}
        onChange={(next) => handleUpdate({ fonts: next })}
      />
      <Separator orientation="vertical" className="mx-1 h-8" />
      <DensityControl
        densityId={theme?.density?.schemeId}
        levels={DENSITY_PRESETS}
        layout="spacing"
        sizeClassName={PREVIEW_DESKTOP_INLINE_CONTROL_SIZE}
        onChange={(next) => handleUpdate({ density: next })}
      />
    </div>
  )
}
