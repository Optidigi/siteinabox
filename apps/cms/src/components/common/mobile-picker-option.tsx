"use client"

import * as React from "react"
import { Button } from "@siteinabox/ui/components/button"
import { cn } from "@siteinabox/ui/lib/utils"

export function MobilePickerOption({
  active = false,
  onClick,
  ariaLabel,
  className,
  sizeClassName = "size-12",
  children,
}: {
  active?: boolean
  onClick: () => void
  ariaLabel: string
  className?: string
  sizeClassName?: string
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      className={cn(
        sizeClassName,
        "shrink-0 rounded-full border text-foreground shadow-sm",
        active
          ? "border-primary bg-background ring-2 ring-primary/35 hover:bg-background"
          : "border-border bg-muted/40 hover:bg-accent/50",
        className,
      )}
    >
      {children}
    </Button>
  )
}
