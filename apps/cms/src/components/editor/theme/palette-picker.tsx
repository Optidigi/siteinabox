"use client"
import * as React from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@siteinabox/ui/components/popover"
import { Plus, Sun, Moon } from "lucide-react"
import type { ThemeTokens } from "@/lib/theme/schema"
import { useAnchorRtCanvas } from "@/components/editor/hooks/use-rt-canvas-anchor"
import { Switch } from "@siteinabox/ui/components/switch"
import { formatCssColorValue, useCspStyleRule } from "@siteinabox/ui/lib/csp-style"
import { cn } from "@siteinabox/ui/lib/utils"
import { useTranslations } from "next-intl"

type Palette = NonNullable<ThemeTokens["palette"]>

export type PalettePreset = {
  id: string
  label: string
  light: Palette
  dark: Palette
}

// Resolves the canvas's "no overrides" colours by mounting a hidden
// `.rt-canvas` anchor and reading its computed CSS. We temporarily
// DISABLE the `<style data-rt-theme-overrides>` tag during the read so we
// see only the base tenant CSS — that's what "Default" represents (the
// manifest / site defaults). Without that disable, the anchor reads the
// currently-applied palette and the Default swatch appears to mirror
// whichever preset the user just clicked.
const DEFAULT_FALLBACK = {
  light: { accent: "#18181b", bg: "#ffffff" } as Palette, // lint:no-css:ignore — color input fallback data
  dark: { accent: "#fafafa", bg: "#09090b" } as Palette, // lint:no-css:ignore — color input fallback data
}

function useDefaultPalettes(): { light: Palette; dark: Palette } {
  const anchor = useAnchorRtCanvas()
  const [resolved, setResolved] = React.useState<{ light: Palette; dark: Palette }>(DEFAULT_FALLBACK)
  React.useEffect(() => {
    if (!anchor) return
    // Disable the runtime overlay so the read sees only the base tenant
    // CSS — i.e. the manifest defaults. Re-enable synchronously after.
    const overlay = document.querySelector<HTMLStyleElement>("style[data-rt-theme-overrides]")
    const wasDisabled = overlay?.disabled ?? false
    if (overlay) overlay.disabled = true
    const read = (mode: "light" | "dark"): Palette => {
      anchor.setAttribute("data-rt-mode", mode)
      const cs = getComputedStyle(anchor)
      const accent = (cs.getPropertyValue("--color-accent") || cs.getPropertyValue("--rt-tenant-color-accent")).trim()
      const bg = (cs.getPropertyValue("--color-bg") || cs.getPropertyValue("--rt-tenant-color-bg")).trim()
      return { accent, bg }
    }
    const light = read("light")
    const dark = read("dark")
    anchor.removeAttribute("data-rt-mode")
    if (overlay) overlay.disabled = wasDisabled
    setResolved({
      light: {
        accent: light.accent || DEFAULT_FALLBACK.light.accent!,
        bg: light.bg || DEFAULT_FALLBACK.light.bg!,
      },
      dark: {
        // Dark accent: prefer the dark-mode read; if identical to light
        // (no tenant dark overlay exists), keep the tenant accent and
        // pair it with a dark surface so the swatch is visibly dark AND
        // visibly tenant-themed.
        accent: dark.accent && dark.accent !== light.accent
          ? dark.accent
          : light.accent || DEFAULT_FALLBACK.dark.accent!,
        bg: dark.bg && dark.bg !== light.bg
          ? dark.bg
          : DEFAULT_FALLBACK.dark.bg!,
      },
    })
  }, [anchor])
  return resolved
}

// `<input type="color">` requires a literal #rrggbb string; CSS custom
// properties (var(--…)) are silently rejected and fall back to #000000. lint:no-css:ignore
// Used when the tenant has no palette saved yet.
const COLOR_INPUT_FALLBACK_HEX = "#888888" // lint:no-css:ignore — native color input requires literal hex

export const PalettePicker: React.FC<{
  palettes: PalettePreset[]
  value: ThemeTokens["palette"]
  darkValue: ThemeTokens["darkPalette"]
  mode: "light" | "dark"
  onChange: (next: { palette?: Palette; darkPalette?: Palette; mode?: "light" | "dark" }) => void
}> = ({ palettes, value, darkValue, mode, onChange }) => {
  const t = useTranslations("editor")
  const slotLabels: Record<keyof Palette, string> = {
    accent: t("paletteSlot.accent"),
    bg: t("paletteSlot.bg"),
    ink: t("paletteSlot.ink"),
    muted: t("paletteSlot.muted"),
  }
  const activePalette = mode === "dark" ? darkValue : value
  const defaults = useDefaultPalettes()

  // "Default" = no overrides on either half. Live-site / manifest tokens win.
  const isDefaultHalf = (half: "light" | "dark"): boolean =>
    mode === half && value == null && darkValue == null

  function isActiveHalf(palette: Palette, half: "light" | "dark"): boolean {
    if (mode !== half) return false
    return (
      palette.accent === activePalette?.accent &&
      palette.bg === activePalette?.bg &&
      palette.ink === activePalette?.ink &&
      palette.muted === activePalette?.muted
    )
  }

  function pick(preset: PalettePreset, half: "light" | "dark") {
    onChange({
      palette: preset.light,
      darkPalette: preset.dark,
      mode: half,
    })
  }

  function pickDefault(half: "light" | "dark") {
    onChange({ palette: undefined, darkPalette: undefined, mode: half })
  }

  function handleCustomSlot(slot: keyof Palette, hex: string) {
    if (mode === "dark") {
      onChange({ darkPalette: { ...(darkValue ?? {}), [slot]: hex } })
    } else {
      onChange({ palette: { ...(value ?? {}), [slot]: hex } })
    }
  }

  // Two hard colour stops so each half fully reaches the centre line.
  // `ring-inset` keeps the rim *inside* the radius so it doesn't eat edge
  // pixels. Active state thickens that same inset ring to `ring-primary` —
  // no offset, no scale shift, swatch content stays full size.
  const swatchFor = (p: Palette) =>
    `linear-gradient(to right, ${p.accent} 0 50%, ${p.bg} 50% 100%)`
  const swatchClass = "block size-8 rounded-full shadow-sm transition-all duration-200"

  type Row = {
    id: string
    label: string
    palette: Palette
    isActive: boolean
    onPick: () => void
  }
  const rows: Row[] = [
    {
      id: "default",
      label: t("default"),
      palette: defaults[mode],
      isActive: isDefaultHalf(mode),
      onPick: () => pickDefault(mode),
    },
    ...palettes.map<Row>((preset) => ({
      id: preset.id,
      label: preset.label,
      palette: mode === "dark" ? preset.dark : preset.light,
      isActive: isActiveHalf(mode === "dark" ? preset.dark : preset.light, mode),
      onPick: () => pick(preset, mode),
    })),
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {/* iOS-style mode toggle: Sun on the off side, Moon on the on side.
            One row of swatches at a time, switched via this control. */}
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Sun className={cn("size-3.5", mode === "light" && "text-foreground")} aria-hidden />
          <Switch
            checked={mode === "dark"}
            onCheckedChange={(checked) => onChange({ mode: checked ? "dark" : "light" })}
            aria-label={t("toggleDarkMode")}
          />
          <Moon className={cn("size-3.5", mode === "dark" && "text-foreground")} aria-hidden />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={row.onPick}
              aria-label={t("applyPalette", { label: row.label })}
              aria-pressed={row.isActive}
              className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <PaletteSwatch
                palette={row.palette}
                className={cn(
                  swatchClass,
                  row.isActive
                    // Active ring uses --ring (consumer's brand/focus token) for
                    // stronger contrast than --primary alone.
                    ? "ring-2 ring-ring ring-offset-1 ring-offset-popover"
                    : "ring-1 ring-inset ring-black/10 hover:shadow-md hover:scale-[1.04]",
                )}
              />
            </button>
          ))}
        </div>

        <div className="border-l border-border/40 self-stretch mx-1" aria-hidden />

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex flex-col items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md p-0.5"
              aria-label={t("customPalette")}
            >
              <span className="size-8 rounded-full border-2 border-dashed border-border/60 flex items-center justify-center text-muted-foreground">
                <Plus className="size-3.5" aria-hidden />
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="end" className="w-72 p-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-muted-foreground">{t("mode")}</span>
              <div className="flex rounded-md border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => onChange({ mode: "light" })}
                  className={[
                    "px-2 py-1 text-xs",
                    mode === "light" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent/30",
                  ].join(" ")}
                >
                  {t("light")}
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ mode: "dark" })}
                  className={[
                    "px-2 py-1 text-xs border-l border-border",
                    mode === "dark" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent/30",
                  ].join(" ")}
                >
                  {t("dark")}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(["accent", "bg", "ink", "muted"] as const).map((slot) => (
                <label key={slot} className="flex flex-col gap-1 text-xs">
                  <span className="text-muted-foreground">{slotLabels[slot]}</span>
                  <input
                    type="color"
                    value={activePalette?.[slot] ?? COLOR_INPUT_FALLBACK_HEX}
                    onChange={(e) => handleCustomSlot(slot, e.target.value)}
                    className="h-8 w-full rounded-md border border-border bg-background cursor-pointer"
                  />
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

function PaletteSwatch({ palette, className }: { palette: Palette; className: string }) {
  const accent = formatCssColorValue(palette.accent) ?? "transparent"
  const bg = formatCssColorValue(palette.bg) ?? "transparent"
  const swatchStyle = useCspStyleRule(
    "palette-picker-swatch",
    `background:linear-gradient(to right, ${accent} 0 50%, ${bg} 50% 100%);`,
  )
  return (
    <>
      {swatchStyle.styleElement}
      <span aria-hidden className={cn(swatchStyle.className, className)} />
    </>
  )
}
