"use client"
import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { Switch } from "@siteinabox/ui/components/switch"
import { cn } from "@siteinabox/ui/lib/utils"
import { formatCssColorValue, useCspStyleRule } from "@siteinabox/ui/lib/csp-style"
import type { ColorSchemeId, ThemeModeV2 } from "@siteinabox/contracts"
import type { ColorPreset } from "@/lib/theme/presets"
import { DEFAULT_THEME_TOKEN_SPEC } from "@siteinabox/contracts"
import { useTranslations } from "next-intl"

export const PalettePicker: React.FC<{
  palettes: ColorPreset[]
  value: ColorSchemeId | undefined
  mode: ThemeModeV2
  onChange: (next: { colors?: { schemeId: ColorSchemeId }; appearance?: { mode: ThemeModeV2 } }) => void
}> = ({ palettes, value, mode, onChange }) => {
  const t = useTranslations("editor")
  const activeId = value ?? DEFAULT_THEME_TOKEN_SPEC.colors.schemeId
  const activeMode = mode === "system" ? DEFAULT_THEME_TOKEN_SPEC.appearance.mode : mode

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Sun className={cn("size-3.5", activeMode === "light" && "text-foreground")} aria-hidden />
        <Switch
          checked={activeMode === "dark"}
          onCheckedChange={(checked) => onChange({ appearance: { mode: checked ? "dark" : "light" } })}
          aria-label={t("toggleDarkMode")}
        />
        <Moon className={cn("size-3.5", activeMode === "dark" && "text-foreground")} aria-hidden />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {palettes.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange({ colors: { schemeId: preset.id } })}
            aria-label={t("applyPalette", { label: preset.label })}
            aria-pressed={activeId === preset.id}
            className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PaletteSwatch
              accent={preset.swatch.accent}
              surface={preset.swatch.surface}
              className={cn(
                "block size-8 rounded-full shadow-sm transition-all duration-200",
                activeId === preset.id
                  ? "ring-2 ring-ring ring-offset-1 ring-offset-popover"
                  : "ring-1 ring-inset ring-black/10 hover:shadow-md hover:scale-[1.04]",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

function PaletteSwatch({ accent, surface, className }: { accent: string; surface: string; className: string }) {
  const accentValue = formatCssColorValue(accent) ?? "transparent"
  const surfaceValue = formatCssColorValue(surface) ?? "transparent"
  const swatchStyle = useCspStyleRule(
    "palette-picker-swatch",
    `background:linear-gradient(to right, ${accentValue} 0 50%, ${surfaceValue} 50% 100%);`,
  )
  return (
    <>
      {swatchStyle.styleElement}
      <span aria-hidden className={cn(swatchStyle.className, className)} />
    </>
  )
}
