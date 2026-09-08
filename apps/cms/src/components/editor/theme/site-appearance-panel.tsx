"use client"

import * as React from "react"
import { DEFAULT_THEME_TOKEN_SPEC } from "@siteinabox/contracts"
import { Button } from "@siteinabox/ui/components/button"
import { Label } from "@siteinabox/ui/components/label"
import { Switch } from "@siteinabox/ui/components/switch"
import { Dices, RotateCcw } from "lucide-react"
import { PalettePicker } from "@/components/editor/theme/palette-picker"
import { FontPicker } from "@/components/editor/theme/font-picker"
import { ShapeControl } from "@/components/editor/theme/radius-control"
import { BackgroundModeControl } from "@/components/editor/theme/background-mode-control"
import type { ThemeTokens } from "@/lib/theme/schema"
import { mergeThemePatch, normalizeThemeForSave, type ThemePatch } from "@/lib/theme/normalizeTheme"
import type { ColorPreset, FontPreset, ShapePreset } from "@/lib/theme/presets"
import { useTranslations } from "next-intl"

type AppearanceMode = NonNullable<ThemeTokens["appearance"]>["mode"]

const SITE_LOOK_RANDOM_MODES: AppearanceMode[] = ["light", "dark"]

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null
  return items[Math.floor(Math.random() * items.length)] ?? null
}

function LookCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-border bg-card p-4">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  )
}

export function SiteAppearancePanel({
  theme,
  onThemeChange,
  palettes,
  fonts,
  radiusLevels,
}: {
  theme: ThemeTokens | null
  onThemeChange: React.Dispatch<React.SetStateAction<ThemeTokens | null>>
  palettes: ColorPreset[]
  fonts: FontPreset[]
  radiusLevels?: ShapePreset[]
}) {
  const t = useTranslations("editor")

  function handleUpdate(partial: ThemePatch) {
    onThemeChange((current) => mergeThemePatch(current ?? theme, partial))
  }

  function handleShuffle() {
    const palette = pickRandom(palettes)
    const font = pickRandom(fonts)
    const shape = pickRandom(radiusLevels ?? [])
    const mode = pickRandom(SITE_LOOK_RANDOM_MODES) ?? "light"

    onThemeChange((current) => mergeThemePatch(current ?? theme ?? DEFAULT_THEME_TOKEN_SPEC, {
      version: 3,
      appearance: { mode },
      ...(palette ? { colors: { schemeId: palette.id } } : {}),
      ...(font ? { fonts: { schemeId: font.id } } : {}),
      ...(shape ? { shape: { schemeId: shape.id } } : {}),
    }))
  }

  function handleDefault() {
    onThemeChange(normalizeThemeForSave(DEFAULT_THEME_TOKEN_SPEC))
  }

  const isDark = (theme?.appearance?.mode ?? "light") === "dark"

  return (
    <div data-siab-site-look className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("siteLookDescription")}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={handleShuffle}>
          <Dices className="size-4" aria-hidden />
          {t("shuffle")}
        </Button>
        <Button type="button" variant="outline" onClick={handleDefault}>
          <RotateCcw className="size-4" aria-hidden />
          {t("default")}
        </Button>
      </div>

      <LookCard title={t("appearance")}>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="site-look-dark-mode">{t("darkMode")}</Label>
          <Switch
            id="site-look-dark-mode"
            checked={isDark}
            onCheckedChange={(checked) => handleUpdate({ appearance: { mode: checked ? "dark" : "light" } })}
            aria-label={t("toggleDarkMode")}
          />
        </div>
      </LookCard>

      <LookCard title={t("colourPalette")}>
        <PalettePicker
          palettes={palettes}
          value={theme?.colors?.schemeId}
          mode={theme?.appearance?.mode ?? "light"}
          layout="settings"
          onChange={(patch) => handleUpdate(patch)}
        />
      </LookCard>

      <LookCard title={t("fontPairings")}>
        <FontPicker
          fonts={fonts}
          value={theme?.fonts?.schemeId}
          layout="settings"
          onChange={(next) => handleUpdate({ fonts: next })}
        />
      </LookCard>

      <LookCard title={t("cornerRadius")}>
        <ShapeControl
          shapeId={theme?.shape?.schemeId}
          radiusLevels={radiusLevels}
          layout="settings"
          onChange={(next) => handleUpdate({ shape: next })}
        />
      </LookCard>

      <LookCard title={t("backgroundMode")}>
        <BackgroundModeControl
          value={theme?.appearance?.backgroundMode}
          layout="settings"
          onChange={(backgroundMode) => handleUpdate({ appearance: { backgroundMode } })}
        />
      </LookCard>
    </div>
  )
}
