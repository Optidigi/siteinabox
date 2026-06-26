"use client"
import * as React from "react"
import { ToggleGroup, ToggleGroupItem } from "@siteinabox/ui/components/toggle-group"
import { Square, Squircle, Circle } from "lucide-react"
import type { ThemeTokens } from "@/lib/theme/schema"

export type RadiusLevel = {
  id: string
  label: string
  value: string
  icon?: "square" | "squircle" | "circle"
}

export type DensityLevel = {
  id: NonNullable<ThemeTokens["density"]>
  label: string
}

export type StylePresetLevel = {
  id: string
  label: string
}

export const DEFAULT_RADIUS_LEVELS: RadiusLevel[] = [
  { id: "sharp", label: "Sharp", value: "0", icon: "square" },
  { id: "soft", label: "Soft", value: "0.5rem", icon: "squircle" },
  { id: "round", label: "Round", value: "1.5rem", icon: "circle" },
]

export const DEFAULT_DENSITY_LEVELS: DensityLevel[] = [
  { id: "compact", label: "Compact" },
  { id: "comfortable", label: "Comfortable" },
  { id: "spacious", label: "Spacious" },
]

export const DEFAULT_STYLE_PRESET_LEVELS: StylePresetLevel[] = [
  { id: "warm-care", label: "Warm Care" },
  { id: "industrial-cleaning", label: "Industrial" },
]

function iconFor(level: RadiusLevel): React.ComponentType<{ className?: string }> {
  if (level.icon === "circle") return Circle
  if (level.icon === "squircle") return Squircle
  return Square
}

function findRadiusLevel(radius: string | undefined, levels: RadiusLevel[]): string | undefined {
  return levels.find((l) => l.value === radius)?.id
}

export const RadiusControl: React.FC<{
  radius: ThemeTokens["radius"]
  levels?: RadiusLevel[]
  onChange: (next: { radius?: string }) => void
}> = ({ radius, levels = DEFAULT_RADIUS_LEVELS, onChange }) => {
  const activeLevel = findRadiusLevel(radius, levels)

  return (
    <div className="flex items-center gap-2">
      <ToggleGroup
        type="single"
        value={activeLevel ?? ""}
        onValueChange={(id) => {
          if (!id) return
          const level = levels.find((l) => l.id === id)
          if (level) onChange({ radius: level.value })
        }}
        className="gap-1"
      >
        {levels.map((level) => {
          const Icon = iconFor(level)
          return (
            <ToggleGroupItem
              key={level.id}
              value={level.id}
              aria-label={level.label}
              className="size-9 rounded-md border border-border bg-background p-0 data-[state=on]:border-primary data-[state=on]:bg-primary/5"
            >
              <Icon className="size-4" aria-hidden />
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>
    </div>
  )
}

export const ShapeControl: React.FC<{
  theme: ThemeTokens | null
  radiusLevels?: RadiusLevel[]
  densityLevels?: DensityLevel[]
  stylePresetLevels?: StylePresetLevel[]
  onChange: (next: Pick<ThemeTokens, "radius" | "density" | "stylePreset">) => void
}> = ({
  theme,
  radiusLevels = DEFAULT_RADIUS_LEVELS,
  densityLevels = DEFAULT_DENSITY_LEVELS,
  stylePresetLevels = DEFAULT_STYLE_PRESET_LEVELS,
  onChange,
}) => {
  const activeRadiusLevel = findRadiusLevel(theme?.radius, radiusLevels)

  return (
    <div className="flex flex-col gap-3">
      <ToggleGroup
        type="single"
        value={activeRadiusLevel ?? ""}
        onValueChange={(id) => {
          if (!id) return
          const level = radiusLevels.find((entry) => entry.id === id)
          if (level) onChange({ radius: level.value })
        }}
        className="justify-start gap-1"
      >
        {radiusLevels.map((level) => {
          const Icon = iconFor(level)
          return (
            <ToggleGroupItem
              key={level.id}
              value={level.id}
              aria-label={level.label}
              className="size-9 rounded-md border border-border bg-background p-0 data-[state=on]:border-primary data-[state=on]:bg-primary/5"
            >
              <Icon className="size-4" aria-hidden />
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>

      <ToggleGroup
        type="single"
        value={theme?.density ?? ""}
        onValueChange={(density) => {
          if (density === "compact" || density === "comfortable" || density === "spacious") {
            onChange({ density })
          }
        }}
        className="justify-start gap-1"
      >
        {densityLevels.map((level) => (
          <ToggleGroupItem
            key={level.id}
            value={level.id}
            aria-label={level.label}
            className="h-9 rounded-md border border-border bg-background px-3 text-xs data-[state=on]:border-primary data-[state=on]:bg-primary/5"
          >
            {level.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <ToggleGroup
        type="single"
        value={theme?.stylePreset ?? ""}
        onValueChange={(stylePreset) => {
          if (stylePreset && stylePresetLevels.some((level) => level.id === stylePreset)) {
            onChange({ stylePreset })
          }
        }}
        className="justify-start gap-1"
      >
        {stylePresetLevels.map((level) => (
          <ToggleGroupItem
            key={level.id}
            value={level.id}
            aria-label={level.label}
            className="h-9 rounded-md border border-border bg-background px-3 text-xs data-[state=on]:border-primary data-[state=on]:bg-primary/5"
          >
            {level.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
