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

export const DEFAULT_RADIUS_LEVELS: RadiusLevel[] = [
  { id: "sharp", label: "Sharp", value: "0", icon: "square" },
  { id: "soft", label: "Soft", value: "0.5rem", icon: "squircle" },
  { id: "round", label: "Round", value: "1.5rem", icon: "circle" },
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
              className="size-9 rounded-md border border-border bg-background data-[state=on]:border-primary data-[state=on]:bg-primary/5"
            >
              <Icon className="size-4" aria-hidden />
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>
    </div>
  )
}
