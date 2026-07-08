"use client"

import * as React from "react"
import { Button } from "@siteinabox/ui/components/button"
import { cn } from "@siteinabox/ui/lib/utils"

export function InlineToolbarGroup({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1",
        className,
      )}
    >
      {children}
    </div>
  )
}

export function InlineToolbarDivider() {
  return <div className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden />
}

export function InlineToolbarOption({
  active = false,
  onClick,
  ariaLabel,
  className,
  children,
}: {
  active?: boolean
  onClick: () => void
  ariaLabel: string
  className?: string
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
        "size-8 shrink-0 rounded-md text-foreground",
        active
          ? "bg-background shadow-sm hover:bg-background"
          : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
        className,
      )}
    >
      {children}
    </Button>
  )
}
