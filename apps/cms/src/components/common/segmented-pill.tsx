"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { Button } from "@siteinabox/ui/components/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@siteinabox/ui/components/tooltip"
import { neoTray } from "@siteinabox/ui/lib/retro"
import { cn } from "@siteinabox/ui/lib/utils"

/**
 * Shared segmented control on the operator neo chrome tile.
 * Active = yellow default button; inactive = outline. No second capsule style.
 */
export interface SegmentedPillItem<V extends string> {
  value: V
  label: string
  icon: LucideIcon
  ariaLabel?: string
  tooltip?: string
}

export interface SegmentedPillProps<V extends string> {
  value: V | null
  onValueChange: (next: V | null) => void
  items: SegmentedPillItem<V>[]
  ariaLabel: string
  /** Optional per-item ref callback for focus management. */
  itemRef?: (value: V, el: HTMLButtonElement | null) => void
  /** `"md"` hides the text label below the md breakpoint (icon-only). */
  labelBreakpoint?: "always" | "md"
  /** If false, clicking the active item does NOT deselect (keeps one active). */
  allowDeselect?: boolean
  /** Compact default, or a slightly larger desktop toolbar control. */
  size?: "default" | "lg"
  /** Positioning utilities only — pill surface treatment is baked in. */
  className?: string
}

export function SegmentedPill<V extends string>({
  value,
  onValueChange,
  items,
  ariaLabel,
  itemRef,
  labelBreakpoint = "always",
  allowDeselect = true,
  size = "default",
  className,
}: SegmentedPillProps<V>) {
  const anyTooltip = items.some((i) => i.tooltip)

  const group = (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(neoTray, "inline-flex items-center gap-1.5 p-1.5", className)}
    >
      {items.map((item) => {
        const Icon = item.icon
        const isActive = value === item.value
        const onClick = () => {
          if (isActive && !allowDeselect) return
          onValueChange(isActive ? null : item.value)
        }
        const node = (
          <Button
            key={item.value}
            type="button"
            size={size === "lg" ? "default" : "sm"}
            variant={isActive ? "default" : "outline"}
            aria-pressed={isActive}
            aria-label={item.ariaLabel ?? item.label}
            ref={itemRef ? (el) => itemRef(item.value, el) : undefined}
            onClick={onClick}
          >
            <Icon className={cn(size === "lg" ? "size-5" : "size-4")} aria-hidden />
            <span className={cn(labelBreakpoint === "md" && "hidden md:inline")}>
              {item.label}
            </span>
          </Button>
        )
        return item.tooltip ? (
          <Tooltip key={item.value}>
            <TooltipTrigger asChild>{node}</TooltipTrigger>
            <TooltipContent>{item.tooltip}</TooltipContent>
          </Tooltip>
        ) : (
          node
        )
      })}
    </div>
  )

  return anyTooltip ? <TooltipProvider delayDuration={300}>{group}</TooltipProvider> : group
}
