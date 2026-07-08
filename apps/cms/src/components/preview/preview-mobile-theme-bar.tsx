"use client"

import * as React from "react"
import { DEFAULT_THEME_TOKEN_SPEC } from "@siteinabox/contracts"
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@siteinabox/ui/components/popover"
import { Palette, SquareRoundCorner, Type } from "lucide-react"
import { MobileInlinePill } from "@/components/common/mobile-inline-pill"
import { FontPicker } from "@/components/editor/theme/font-picker"
import { PalettePicker } from "@/components/editor/theme/palette-picker"
import { ShapeControl } from "@/components/editor/theme/radius-control"
import {
  PREVIEW_MOBILE_CHROME_CONTROL_SIZE,
  PREVIEW_MOBILE_CHROME_INSET,
  previewMobileChromeToneClass,
} from "@/components/preview/preview-mobile-chrome-tone"
import type { ThemeTokens } from "@/lib/theme/schema"
import { normalizePreviewThemeForSave } from "@/lib/theme/normalizeTheme"
import { FONT_PRESETS, PALETTE_PRESETS, RADIUS_PRESETS } from "@/lib/theme/presets"
import { cn } from "@siteinabox/ui/lib/utils"
import { useTranslations } from "next-intl"

type Segment = "colors" | "fonts" | "shape"

const PREVIEW_THEME_TOOLBAR_CLOSE_EVENT = "siab:preview-theme-toolbar-close"

const THEME_PILL_ITEMS: Array<{
  value: Segment
  icon: React.ComponentType<{ className?: string }>
  labelKey: "colourPalette" | "fontPairings" | "cornerRadius"
}> = [
  { value: "colors", icon: Palette, labelKey: "colourPalette" },
  { value: "fonts", icon: Type, labelKey: "fontPairings" },
  { value: "shape", icon: SquareRoundCorner, labelKey: "cornerRadius" },
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
      normalizePreviewThemeForSave({ ...(current ?? theme ?? DEFAULT_THEME_TOKEN_SPEC), ...partial } as ThemeTokens),
    )
  }

  function isThemePillTarget(target: EventTarget | null): boolean {
    return target instanceof Element && target.closest("[data-mobile-preview-theme-pill]") != null
  }

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] z-30 md:hidden",
        PREVIEW_MOBILE_CHROME_INSET,
      )}
    >
      <Popover
        open={openSegment != null}
        onOpenChange={(open) => {
          if (!open) setOpenSegment(null)
        }}
      >
        <div
          role="group"
          aria-label={previewT("themeControls")}
          className="pointer-events-auto relative flex items-center justify-center gap-3"
        >
          <PopoverAnchor asChild>
            <div
              className="pointer-events-none absolute top-0 left-1/2 h-px w-px -translate-x-1/2"
              aria-hidden
            />
          </PopoverAnchor>
          {THEME_PILL_ITEMS.map(({ value, icon: Icon, labelKey }) => (
            <MobileInlinePill
              key={value}
              icon={<Icon className="size-5" aria-hidden />}
              ariaLabel={t(labelKey)}
              active={openSegment === value}
              onClick={() =>
                setOpenSegment((current) => (current === value ? null : value))
              }
              buttonRef={(el) => {
                segmentRefs.current[value] = el
              }}
              dataAttrs={{ "data-mobile-preview-theme-pill": value }}
              sizeClassName={PREVIEW_MOBILE_CHROME_CONTROL_SIZE}
            />
          ))}
        </div>
        <PopoverContent
          side="top"
          align="center"
          sideOffset={12}
          className={cn(
            previewMobileChromeToneClass(theme),
            "w-[calc(100vw-1.5rem)] max-w-none",
            "rounded-2xl border border-border/50 bg-popover p-4 text-popover-foreground shadow-xl",
          )}
          onPointerDownOutside={(e) => {
            if (isThemePillTarget(e.target)) {
              e.preventDefault()
              return
            }
            setOpenSegment(null)
          }}
          onFocusOutside={(e) => {
            if (isThemePillTarget(e.target)) {
              e.preventDefault()
              return
            }
            setOpenSegment(null)
          }}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => {
            const target = lastOpenSegmentRef.current
            if (target) {
              e.preventDefault()
              segmentRefs.current[target]?.focus()
            }
          }}
        >
          <div key={openSegment ?? "closed"} className="flex w-full justify-center">
            {openSegment === "colors" && (
              <PalettePicker
                palettes={PALETTE_PRESETS}
                value={theme?.colors?.schemeId}
                mode={theme?.appearance?.mode ?? "light"}
                layout="mobile"
                swatchSizeClassName={PREVIEW_MOBILE_CHROME_CONTROL_SIZE}
                onChange={(patch) => handleUpdate(patch)}
              />
            )}
            {openSegment === "fonts" && (
              <FontPicker
                fonts={FONT_PRESETS}
                value={theme?.fonts?.schemeId}
                layout="glyph"
                sizeClassName={PREVIEW_MOBILE_CHROME_CONTROL_SIZE}
                onChange={(next) => handleUpdate({ fonts: next })}
              />
            )}
            {openSegment === "shape" && (
              <ShapeControl
                shapeId={theme?.shape?.schemeId}
                radiusLevels={RADIUS_PRESETS}
                layout="pill"
                sizeClassName={PREVIEW_MOBILE_CHROME_CONTROL_SIZE}
                onChange={(next) => handleUpdate({ shape: next })}
              />
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
