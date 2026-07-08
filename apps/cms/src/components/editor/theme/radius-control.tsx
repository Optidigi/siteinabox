"use client"
import * as React from "react"
import { ToggleGroup, ToggleGroupItem } from "@siteinabox/ui/components/toggle-group"
import { Button } from "@siteinabox/ui/components/button"
import { AlignVerticalJustifyCenter, AlignVerticalSpaceAround, Circle, Rows3, Square, Squircle } from "lucide-react"
import type { DensitySchemeId, ShapeSchemeId } from "@siteinabox/contracts"
import { DEFAULT_THEME_TOKEN_SPEC } from "@siteinabox/contracts"
import type { DensityPreset, ShapePreset } from "@/lib/theme/presets"
import { cn } from "@siteinabox/ui/lib/utils"

function iconFor(level: ShapePreset): React.ComponentType<{ className?: string }> {
  if (level.icon === "circle") return Circle
  if (level.icon === "squircle") return Squircle
  return Square
}

function densityIconFor(level: DensityPreset): React.ComponentType<{ className?: string }> | null {
  if (level.icon === "space-around") return AlignVerticalSpaceAround
  if (level.icon === "rows") return Rows3
  if (level.icon === "compact") return AlignVerticalJustifyCenter
  return null
}

export const ShapeControl: React.FC<{
  shapeId: ShapeSchemeId | undefined
  radiusLevels?: ShapePreset[]
  onChange: (next: { schemeId: ShapeSchemeId }) => void
}> = ({ shapeId, radiusLevels = [], onChange }) => {
  const activeId = shapeId ?? DEFAULT_THEME_TOKEN_SPEC.shape.schemeId

  return (
    <ToggleGroup
      type="single"
      value={activeId}
      onValueChange={(id) => {
        const level = radiusLevels.find((entry) => entry.id === id)
        if (level) onChange({ schemeId: level.id })
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
  )
}

function densitySpacingGapClass(id: DensitySchemeId): string {
  if (id === "spacious") return "gap-3"
  if (id === "compact") return "gap-0.5"
  return "gap-1.5"
}

function DensitySpacingGlyph({ densityId }: { densityId: DensitySchemeId }) {
  return (
    <div className={cn("flex flex-col items-center", densitySpacingGapClass(densityId))} aria-hidden>
      <span className="h-1.5 w-7 rounded-full bg-current opacity-80" />
      <span className="h-1.5 w-7 rounded-full bg-current opacity-80" />
    </div>
  )
}

export const DensityControl: React.FC<{
  densityId: DensitySchemeId | undefined
  levels?: DensityPreset[]
  onChange: (next: { schemeId: DensitySchemeId }) => void
  layout?: "toggle" | "spacing"
}> = ({ densityId, levels = [], onChange, layout = "toggle" }) => {
  const activeId = densityId ?? DEFAULT_THEME_TOKEN_SPEC.density.schemeId

  if (layout === "spacing") {
    return (
      <div className="flex gap-2">
        {levels.map((level) => {
          const isActive = activeId === level.id
          return (
            <Button
              key={level.id}
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onChange({ schemeId: level.id })}
              aria-pressed={isActive}
              aria-label={level.label}
              className={cn(
                "size-12 rounded-full border text-foreground",
                isActive
                  ? "border-primary bg-background ring-2 ring-primary/35 hover:bg-background"
                  : "border-border bg-muted/40 hover:bg-accent/50",
              )}
            >
              <DensitySpacingGlyph densityId={level.id} />
            </Button>
          )
        })}
      </div>
    )
  }

  return (
    <ToggleGroup
      type="single"
      value={activeId}
      onValueChange={(id) => {
        const level = levels.find((entry) => entry.id === id)
        if (level) onChange({ schemeId: level.id })
      }}
      className="justify-start gap-1"
    >
      {levels.map((level) => {
        const Icon = densityIconFor(level)
        return (
          <ToggleGroupItem
            key={level.id}
            value={level.id}
            aria-label={level.label}
            className="h-9 rounded-md border border-border bg-background px-3 text-xs font-medium data-[state=on]:border-primary data-[state=on]:bg-primary/5"
          >
            {Icon ? <Icon className="size-4" aria-hidden /> : level.label}
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}
