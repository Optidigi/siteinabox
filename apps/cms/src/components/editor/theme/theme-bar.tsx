"use client"

import * as React from "react"
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@siteinabox/ui/components/popover"
import { Palette, Type, SquareRoundCorner, SlidersHorizontal } from "lucide-react"
import { PalettePicker } from "@/components/editor/theme/palette-picker"
import { FontPicker } from "@/components/editor/theme/font-picker"
import {
  DensityControl,
  ShapeControl,
} from "@/components/editor/theme/radius-control"
import type { ThemeTokens } from "@/lib/theme/schema"
import { normalizeThemeForSave } from "@/lib/theme/normalizeTheme"
import type { RtManifest } from "@/lib/richText/manifest"
import type { ColorPreset, DensityPreset, FontPreset, ShapePreset } from "@/lib/theme/presets"
import { SegmentedPill } from "@/components/common/segmented-pill"
import { FLOATING_PILL_CLASS } from "@/components/editor/mode/mode-bar"
import { cn } from "@siteinabox/ui/lib/utils"
import { useTranslations } from "next-intl"

type Segment = "colors" | "fonts" | "shape" | "density"

export function ThemeBar({
  theme,
  manifest: _manifest,
  onThemeChange,
  palettes,
  fonts,
  radiusLevels,
  densityLevels,
}: {
  theme: ThemeTokens | null
  manifest: RtManifest
  onThemeChange: React.Dispatch<React.SetStateAction<ThemeTokens | null>>
  palettes: ColorPreset[]
  fonts: FontPreset[]
  radiusLevels?: ShapePreset[]
  densityLevels?: DensityPreset[]
}) {
  const t = useTranslations("editor")
  // Theme edits are *not* autosaved — they flow up via onThemeChange so the
  // parent form can track them in the same dirty/Save cycle as page-form
  // fields. The previous debounced setTenantTheme inside ThemeBar was a
  // behaviour outlier (silent autosave to a different document); routing
  // through the explicit Save button is what users expect.
  function handleUpdate(partial: Partial<ThemeTokens>) {
    onThemeChange((current) => normalizeThemeForSave({ ...(current ?? theme ?? {}), ...partial } as ThemeTokens))
  }

  const [openSegment, setOpenSegment] = React.useState<Segment | null>(null)

  // Fix #1: track the last-open segment so onCloseAutoFocus can return focus
  // to the correct button even when openSegment has already been set to null
  // by onOpenChange (Escape / outside-click path).
  const lastOpenSegmentRef = React.useRef<Segment | null>(null)
  React.useEffect(() => {
    if (openSegment) lastOpenSegmentRef.current = openSegment
  }, [openSegment])

  const segmentRefs = React.useRef<Record<Segment, HTMLButtonElement | null>>({
    colors: null,
    fonts: null,
    shape: null,
    density: null,
  })

  return (
    <Popover open={openSegment != null} onOpenChange={(open) => !open && setOpenSegment(null)}>
      <PopoverAnchor asChild>
        <div className="flex justify-center py-2">
          <div className={cn(FLOATING_PILL_CLASS)}>
            <SegmentedPill<Segment>
              ariaLabel={t("themeControls")}
              value={openSegment}
              onValueChange={(next) => setOpenSegment(next)}
              itemRef={(value, el) => { segmentRefs.current[value] = el }}
              items={[
                { value: "colors", label: t("colours"), icon: Palette, ariaLabel: t("colourPalette") },
                { value: "fonts", label: t("fonts"), icon: Type, ariaLabel: t("fontPairings") },
                { value: "shape", label: t("shape"), icon: SquareRoundCorner, ariaLabel: t("cornerRadius") },
                { value: "density", label: t("density"), icon: SlidersHorizontal, ariaLabel: t("spacingDensity") },
              ]}
            />
          </div>
        </div>
      </PopoverAnchor>
        <PopoverContent
          side="bottom"
          align="center"
          sideOffset={4}
          className="w-auto max-w-[calc(100vw-2rem)] rounded-md border border-border/40 bg-card/95 shadow-md backdrop-blur-sm p-3"
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
              palettes={palettes}
              value={theme?.colors?.schemeId}
              mode={theme?.appearance?.mode ?? "light"}
              onChange={(patch) => handleUpdate(patch)}
            />
          )}
          {openSegment === "fonts" && (
            <FontPicker
              fonts={fonts}
              value={theme?.fonts?.schemeId}
              onChange={(next) => handleUpdate({ fonts: next })}
            />
          )}
          {openSegment === "shape" && (
            <ShapeControl
              shapeId={theme?.shape?.schemeId}
              radiusLevels={radiusLevels}
              onChange={(next) => handleUpdate({ shape: next })}
            />
          )}
          {openSegment === "density" && (
            <DensityControl
              densityId={theme?.density?.schemeId}
              levels={densityLevels}
              onChange={(next) => handleUpdate({ density: next })}
            />
          )}
        </PopoverContent>
      </Popover>
  )
}
