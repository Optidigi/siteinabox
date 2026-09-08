"use client"

import * as React from "react"
import { Button } from "@siteinabox/ui/components/button"
import { neoTray } from "@siteinabox/ui/lib/retro"
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
      className={cn(neoTray, "inline-flex items-center gap-1 p-1", className)}
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
  title,
  className,
  children,
}: {
  active?: boolean
  onClick: () => void
  ariaLabel: string
  title?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="icon-sm"
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      title={title}
      className={className}
    >
      {children}
    </Button>
  )
}
