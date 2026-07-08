"use client"

import * as React from "react"
import { DEFAULT_THEME_TOKEN_SPEC } from "@siteinabox/contracts"
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@siteinabox/ui/components/popover"
import { Palette, SlidersHorizontal, SquareRoundCorner, Type } from "lucide-react"
import { MobileInlinePill } from "@/components/common/mobile-inline-pill"
import { FontPicker } from "@/components/editor/theme/font-picker"
import { PalettePicker } from "@/components/editor/theme/palette-picker"
import { DensityControl, ShapeControl } from "@/components/editor/theme/radius-control"
import type { ThemeTokens } from "@/lib/theme/schema"
import { normalizeThemeForSave } from "@/lib/theme/normalizeTheme"
import { DENSITY_PRESETS, FONT_PRESETS, PALETTE_PRESETS, RADIUS_PRESETS } from "@/lib/theme/presets"
import { useTranslations } from "next-intl"

type Segment = "colors" | "fonts" | "shape" | "density"

const PREVIEW_THEME_TOOLBAR_CLOSE_EVENT = "siab:preview-theme-toolbar-close"

const THEME_PILL_ITEMS: Array<{
  value: Segment
  icon: React.ComponentType<{ className?: string }>
  labelKey: "colourPalette" | "fontPairings" | "cornerRadius" | "spacingDensity"
}> = [
  { value: "colors", icon: Palette, labelKey: "colourPalette" },
  { value: "fonts", icon: Type, labelKey: "fontPairings" },
  { value: "shape", icon: SquareRoundCorner, labelKey: "cornerRadius" },
  { value: "density", icon: SlidersHorizontal, labelKey: "spacingDensity" },
]

export function PreviewMobileThemeBar({
  theme,
  onThemeChange,
}: {
  theme: ThemeTokens | null
  onThemeChange: React.Dispatch<React.SetStateAction<ThemeTokens | null>>
}) {
  const t = useTranslations("editor")
  const previewT = useTranslations("preview")
  const [openSegment, setOpenSegment] = React.useState<Segment | null>(null)
  const lastOpenSegmentRef = React.useRef<Segment | null>(null)
  const segmentRefs = React.useRef<Record<Segment, HTMLButtonElement | null>>({
    colors: null,
    fonts: null,
    shape: null,
    density: null,
  })

  React.useEffect(() => {
    if (openSegment) lastOpenSegmentRef.current = openSegment
  }, [openSegment])

  React.useEffect(() => {
    const close = () => setOpenSegment(null)
    window.addEventListener(PREVIEW_THEME_TOOLBAR_CLOSE_EVENT, close)
    return () => window.removeEventListener(PREVIEW_THEME_TOOLBAR_CLOSE_EVENT, close)
  }, [])

  function handleUpdate(partial: Partial<ThemeTokens>) {
    onThemeChange((current) =>
      normalizeThemeForSave({ ...(current ?? theme ?? DEFAULT_THEME_TOKEN_SPEC), ...partial } as ThemeTokens),
    )
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] z-30 flex justify-center md:hidden">
      <Popover open={openSegment != null} onOpenChange={(open) => !open && setOpenSegment(null)}>
        <PopoverAnchor asChild>
          <div
            role="group"
            aria-label={previewT("themeControls")}
            className="pointer-events-auto flex items-center gap-2"
          >
            {THEME_PILL_ITEMS.map(({ value, icon: Icon, labelKey }) => (
              <MobileInlinePill
                key={value}
                icon={<Icon className="size-5" aria-hidden />}
                ariaLabel={t(labelKey)}
                active={openSegment === value}
                onClick={() => setOpenSegment((current) => (current === value ? null : value))}
                buttonRef={(el) => {
                  segmentRefs.current[value] = el
                }}
                dataAttrs={{ "data-mobile-preview-theme-pill": value }}
              />
            ))}
          </div>
        </PopoverAnchor>
        <PopoverContent
          side="top"
          align="center"
          sideOffset={12}
          className="w-auto max-w-[calc(100vw-2rem)] rounded-md border border-border/40 bg-card/95 p-3 shadow-md backdrop-blur-sm"
          onPointerDownOutside={() => setOpenSegment(null)}
          onFocusOutside={() => setOpenSegment(null)}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => {
            const target = lastOpenSegmentRef.current
            if (target) {
              e.preventDefault()
              segmentRefs.current[target]?.focus()
            }
          }}
        >
          {openSegment === "colors" && (
            <PalettePicker
              palettes={PALETTE_PRESETS}
              value={theme?.colors?.schemeId}
              mode={theme?.appearance?.mode ?? "light"}
              onChange={(patch) => handleUpdate(patch)}
            />
          )}
          {openSegment === "fonts" && (
            <FontPicker
              fonts={FONT_PRESETS}
              value={theme?.fonts?.schemeId}
              layout="glyph"
              onChange={(next) => handleUpdate({ fonts: next })}
            />
          )}
          {openSegment === "shape" && (
            <ShapeControl
              shapeId={theme?.shape?.schemeId}
              radiusLevels={RADIUS_PRESETS}
              onChange={(next) => handleUpdate({ shape: next })}
            />
          )}
          {openSegment === "density" && (
            <DensityControl
              densityId={theme?.density?.schemeId}
              levels={DENSITY_PRESETS}
              layout="spacing"
              onChange={(next) => handleUpdate({ density: next })}
            />
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
