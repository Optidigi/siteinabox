"use client"
import * as React from "react"
import { ToggleGroup, ToggleGroupItem } from "@siteinabox/ui/components/toggle-group"
import { MobilePickerOption } from "@/components/common/mobile-picker-option"
import { InlineToolbarGroup, InlineToolbarOption } from "@/components/common/inline-toolbar-group"
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

const SHAPE_CORNER_RADIUS: Record<ShapeSchemeId, number> = {
  sharp: 0,
  soft: 3,
  rounded: 6,
}

function ShapeCornerGlyph({ shapeId, className }: { shapeId: ShapeSchemeId; className?: string }) {
  const radius = SHAPE_CORNER_RADIUS[shapeId] ?? SHAPE_CORNER_RADIUS.soft
  const path =
    radius === 0
      ? "M4 12V4H12"
      : `M4 12V${4 + radius}Q4 4 ${4 + radius} 4H12`

  return (
    <svg viewBox="0 0 16 16" className={cn("size-4 shrink-0", className)} aria-hidden>
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
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
  layout?: "toggle" | "pill" | "segment"
  sizeClassName?: string
}> = ({ shapeId, radiusLevels = [], onChange, layout = "toggle", sizeClassName }) => {
  const activeId = shapeId ?? DEFAULT_THEME_TOKEN_SPEC.shape.schemeId

  if (layout === "segment") {
    return (
      <InlineToolbarGroup>
        {radiusLevels.map((level) => {
          const isActive = activeId === level.id
          return (
            <InlineToolbarOption
              key={level.id}
              active={isActive}
              onClick={() => onChange({ schemeId: level.id })}
              ariaLabel={level.label}
            >
              <ShapeCornerGlyph shapeId={level.id} />
            </InlineToolbarOption>
          )
        })}
      </InlineToolbarGroup>
    )
  }

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
            >
              <Icon className={sizeClassName === "size-8" ? "size-3.5 stroke-[1.5]" : "size-5"} aria-hidden />
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
          const Icon = densityIconFor(level)
          const isActive = activeId === level.id
          return (
            <MobilePickerOption
              key={level.id}
              active={isActive}
              onClick={() => onChange({ schemeId: level.id })}
              ariaLabel={level.label}
              sizeClassName={sizeClassName}
            >
              {Icon ? (
                <Icon className={sizeClassName === "size-8" ? "size-3.5 stroke-[1.5]" : "size-4"} aria-hidden />
              ) : (
                level.label
              )}
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
