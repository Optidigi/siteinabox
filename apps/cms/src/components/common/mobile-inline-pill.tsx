"use client"

import * as React from "react"
import { cn } from "@siteinabox/ui/lib/utils"

export interface MobileInlinePillProps {
  icon: React.ReactNode
  ariaLabel: string
  active?: boolean
  onClick: () => void
  buttonRef?: React.Ref<HTMLButtonElement>
  dataAttrs?: Record<string, string | undefined>
}

/**
 * Circular pill control for inline mobile toolbars (theme bar, etc.).
 * Matches the inverted MobileFloatingPill surface; active state rings the pill.
 */
export function MobileInlinePill({
  icon,
  ariaLabel,
  active = false,
  onClick,
  buttonRef,
  dataAttrs,
}: MobileInlinePillProps) {
  return (
    <button
      type="button"
      ref={buttonRef}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      {...(dataAttrs ?? {})}
      className={cn(
        "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border shadow-lg transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        active
          ? "border-primary bg-background text-foreground ring-2 ring-primary/35"
          : "border-transparent bg-foreground text-background",
      )}
    >
      {icon}
    </button>
  )
}
