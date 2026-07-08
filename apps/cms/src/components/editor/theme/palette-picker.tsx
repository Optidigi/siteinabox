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
  layout?: "default" | "mobile"
  swatchSizeClassName?: string
}> = ({ palettes, value, mode, onChange, layout = "default", swatchSizeClassName }) => {
  const t = useTranslations("editor")
  const activeId = value ?? DEFAULT_THEME_TOKEN_SPEC.colors.schemeId
  const activeMode = mode === "system" ? DEFAULT_THEME_TOKEN_SPEC.appearance.mode : mode
  const swatchSize = layout === "mobile" ? (swatchSizeClassName ?? "size-12") : "size-8"

  const modeToggle = (
    <div className={cn("flex items-center gap-1.5 text-muted-foreground", layout === "mobile" && "justify-center")}>
      <Sun className={cn("size-3.5", activeMode === "light" && "text-foreground")} aria-hidden />
      <Switch
        checked={activeMode === "dark"}
        onCheckedChange={(checked) => onChange({ appearance: { mode: checked ? "dark" : "light" } })}
        aria-label={t("toggleDarkMode")}
      />
      <Moon className={cn("size-3.5", activeMode === "dark" && "text-foreground")} aria-hidden />
    </div>
  )

  const swatches = (
    <div className={cn("flex flex-wrap items-center gap-3", layout === "mobile" && "justify-center")}>
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
              "block rounded-full shadow-sm transition-all duration-200",
              swatchSize,
              activeId === preset.id
                ? "ring-2 ring-ring ring-offset-2 ring-offset-popover"
                : "ring-1 ring-inset ring-black/10 hover:shadow-md hover:scale-[1.04]",
            )}
          />
        </button>
      ))}
    </div>
  )

  if (layout === "mobile") {
    return (
      <div className="flex w-full flex-col items-center gap-4">
        {modeToggle}
        {swatches}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      {modeToggle}
      {swatches}
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
