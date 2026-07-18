"use client"

import * as React from "react"
import { DEFAULT_THEME_TOKEN_SPEC } from "@siteinabox/contracts"
import { Button } from "@siteinabox/ui/components/button"
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@siteinabox/ui/components/popover"
import { Dices, Palette, RotateCcw, SquareRoundCorner, Type } from "lucide-react"
import { PalettePicker } from "@/components/editor/theme/palette-picker"
import { FontPicker } from "@/components/editor/theme/font-picker"
import { ShapeControl } from "@/components/editor/theme/radius-control"
import type { ThemeTokens } from "@/lib/theme/schema"
import { normalizeThemeForSave } from "@/lib/theme/normalizeTheme"
import type { RtManifest } from "@/lib/richText/manifest"
import type { ColorPreset, FontPreset, ShapePreset } from "@/lib/theme/presets"
import { useTranslations } from "next-intl"

type Segment = "colors" | "fonts" | "shape"
type AppearanceMode = NonNullable<ThemeTokens["appearance"]>["mode"]

const MOBILE_RANDOM_MODES: AppearanceMode[] = ["light", "dark"]

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null
  return items[Math.floor(Math.random() * items.length)] ?? null
}

export function EditorThemeToolbar({
  theme,
  manifest: _manifest,
  onThemeChange,
  palettes,
  fonts,
  radiusLevels,
}: {
  theme: ThemeTokens | null
  manifest: RtManifest
  onThemeChange: React.Dispatch<React.SetStateAction<ThemeTokens | null>>
  palettes: ColorPreset[]
  fonts: FontPreset[]
  radiusLevels?: ShapePreset[]
}) {
  const t = useTranslations("editor")
  // Theme edits are *not* autosaved — they flow up via onThemeChange so the
  // parent form can track them in the same dirty/Save cycle as page-form
  // fields. The previous debounced setTenantTheme inside the theme toolbar was a
  // behaviour outlier (silent autosave to a different document); routing
  // through the explicit Save button is what users expect.
  function handleUpdate(partial: Partial<ThemeTokens>) {
    onThemeChange((current) => normalizeThemeForSave({ ...(current ?? theme ?? {}), ...partial } as ThemeTokens))
  }

  function handleShuffle() {
    const palette = pickRandom(palettes)
    const font = pickRandom(fonts)
    const shape = pickRandom(radiusLevels ?? [])
    const mode = pickRandom(MOBILE_RANDOM_MODES) ?? "light"

    onThemeChange((current) =>
      normalizeThemeForSave({
        ...(current ?? theme ?? DEFAULT_THEME_TOKEN_SPEC),
        version: 3,
        appearance: { mode },
        ...(palette ? { colors: { schemeId: palette.id } } : {}),
        ...(font ? { fonts: { schemeId: font.id } } : {}),
        ...(shape ? { shape: { schemeId: shape.id } } : {}),
      } as ThemeTokens),
    )
  }

  function handleDefault() {
    onThemeChange(normalizeThemeForSave(DEFAULT_THEME_TOKEN_SPEC))
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
  })

  return (
    <>
      <div className="flex justify-center py-2 md:hidden">
        <div className="rounded-lg border border-border bg-background/95 p-1 shadow-lg backdrop-blur-sm">
          <div
            role="group"
            aria-label={t("themeControls")}
            className="inline-flex items-center gap-1"
          >
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleShuffle}
              className="h-8 rounded-md px-2.5"
            >
              <Dices className="size-4" aria-hidden />
              <span className="ml-1.5">{t("shuffle")}</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleDefault}
              className="h-8 rounded-md px-2.5"
            >
              <RotateCcw className="size-4" aria-hidden />
              <span className="ml-1.5">{t("default")}</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="hidden md:block">
        <Popover open={openSegment != null} onOpenChange={(open) => !open && setOpenSegment(null)}>
          <PopoverAnchor asChild>
            <div className="flex justify-center py-2">
              <div className="rounded-lg border border-border bg-background/95 p-1 shadow-lg backdrop-blur-sm">
                <div className="inline-flex items-center gap-1" role="group" aria-label={t("themeControls")}>
                  {([
                    ["colors", t("colours"), t("colourPalette"), Palette],
                    ["fonts", t("fonts"), t("fontPairings"), Type],
                    ["shape", t("shape"), t("cornerRadius"), SquareRoundCorner],
                  ] as const).map(([segment, label, ariaLabel, Icon]) => (
                    <Button
                      key={segment}
                      ref={(element) => { segmentRefs.current[segment] = element }}
                      type="button"
                      size="sm"
                      variant={openSegment === segment ? "secondary" : "ghost"}
                      aria-label={ariaLabel}
                      aria-pressed={openSegment === segment}
                      className="h-8 rounded-md px-3"
                      onClick={() => setOpenSegment((current) => (current === segment ? null : segment))}
                    >
                      <Icon className="size-4" aria-hidden />
                      <span className="ml-1.5">{label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </PopoverAnchor>
          <PopoverContent
            side="bottom"
            align="center"
            sideOffset={4}
            className="w-auto max-w-[calc(100vw-2rem)] rounded-md border border-border/40 bg-card/95 shadow-md backdrop-blur-sm p-3"
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
          </PopoverContent>
        </Popover>
      </div>
    </>
  )
}
