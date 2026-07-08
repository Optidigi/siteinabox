"use client"
import * as React from "react"
import { ToggleGroup, ToggleGroupItem } from "@siteinabox/ui/components/toggle-group"
import { MobilePickerOption } from "@/components/common/mobile-picker-option"
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

function shapePillRadiusClass(id: ShapeSchemeId): string {
  if (id === "rounded") return "rounded-full"
  if (id === "sharp") return "rounded-sm"
  return "rounded-xl"
}

export const ShapeControl: React.FC<{
  shapeId: ShapeSchemeId | undefined
  radiusLevels?: ShapePreset[]
  onChange: (next: { schemeId: ShapeSchemeId }) => void
  layout?: "toggle" | "pill"
  sizeClassName?: string
}> = ({ shapeId, radiusLevels = [], onChange, layout = "toggle", sizeClassName }) => {
  const activeId = shapeId ?? DEFAULT_THEME_TOKEN_SPEC.shape.schemeId

  if (layout === "pill") {
    return (
      <div className={cn("flex justify-center", sizeClassName === "size-8" ? "gap-1.5" : "gap-3")}>
        {radiusLevels.map((level) => {
          const Icon = iconFor(level)
          const isActive = activeId === level.id
          return (
            <MobilePickerOption
              key={level.id}
              active={isActive}
              onClick={() => onChange({ schemeId: level.id })}
              ariaLabel={level.label}
              sizeClassName={sizeClassName}
              className={shapePillRadiusClass(level.id)}
            >
              <Icon className="size-5" aria-hidden />
            </MobilePickerOption>
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
  sizeClassName?: string
}> = ({ densityId, levels = [], onChange, layout = "toggle", sizeClassName }) => {
  const activeId = densityId ?? DEFAULT_THEME_TOKEN_SPEC.density.schemeId

  if (layout === "spacing") {
    return (
      <div className={cn("flex justify-center", sizeClassName === "size-8" ? "gap-1.5" : "gap-3")}>
        {levels.map((level) => {
          const isActive = activeId === level.id
          return (
            <MobilePickerOption
              key={level.id}
              active={isActive}
              onClick={() => onChange({ schemeId: level.id })}
              ariaLabel={level.label}
              sizeClassName={sizeClassName}
            >
              <DensitySpacingGlyph densityId={level.id} />
            </MobilePickerOption>
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
