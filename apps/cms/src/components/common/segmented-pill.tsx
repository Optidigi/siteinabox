"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { Button } from "@siteinabox/ui/components/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@siteinabox/ui/components/tooltip"
import { cn } from "@siteinabox/ui/lib/utils"

/**
 * Shared segmented-pill control matching the ModeToggle (Canvas / Sidebar)
 * visual: a rounded-md `bg-muted/30` capsule containing filled-on-active /
 * ghost-on-inactive shadcn Buttons.
 *
 * Used by `ModeToggle` (2-state, always one active).
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
      className={cn(
        size === "lg"
          ? "inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 p-1"
          : "inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 p-0.5",
        className,
      )}
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
            size="sm"
            variant={isActive ? "default" : "ghost"}
            aria-pressed={isActive}
            aria-label={item.ariaLabel ?? item.label}
            ref={itemRef ? (el) => itemRef(item.value, el) : undefined}
            onClick={onClick}
            className={cn(
              size === "lg" ? "h-9 rounded-md px-3 text-sm" : "h-7 rounded-sm px-2",
            )}
          >
            <Icon className={cn(size === "lg" ? "size-5" : "size-4")} aria-hidden />
            <span className={cn(size === "lg" ? "ml-2" : "ml-1.5", labelBreakpoint === "md" && "hidden md:inline")}>
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
