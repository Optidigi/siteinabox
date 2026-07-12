"use client"

import * as React from "react"
import { Button } from "@siteinabox/ui/components/button"
import { cn } from "@siteinabox/ui/lib/utils"
import { ShineBorder } from "@/components/common/shine-border"

export interface MobileInlinePillProps {
  icon: React.ReactNode
  ariaLabel: string
  active?: boolean
  onClick: () => void
  buttonRef?: React.Ref<HTMLButtonElement>
  dataAttrs?: Record<string, string | undefined>
  sizeClassName?: string
  shine?: boolean
}

/**
 * Circular pill control for inline mobile toolbars (theme bar, etc.).
 * Uses theme tokens so a parent `.dark` wrapper can invert chrome against the site.
 */
export function MobileInlinePill({
  icon,
  ariaLabel,
  active = false,
  onClick,
  buttonRef,
  dataAttrs,
  sizeClassName = "size-12",
  shine = false,
}: MobileInlinePillProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      ref={buttonRef}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      {...(dataAttrs ?? {})}
      className={cn(
        sizeClassName,
        "relative shrink-0 overflow-hidden rounded-full border shadow-lg transition-all duration-200",
        active
          ? "border-primary bg-background text-foreground ring-2 ring-primary/35 hover:bg-background"
          : "border-border/60 bg-background text-foreground hover:bg-background/90",
      )}
    >
      {shine && (
        <ShineBorder
          borderWidth={1}
          duration={14}
          shineColor={["transparent", "white", "white", "white", "transparent"]}
        />
      )}
      {icon}
    </Button>
  )
}
