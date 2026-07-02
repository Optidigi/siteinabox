"use client"

import * as React from "react"
import { Button } from "@siteinabox/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { cn } from "@siteinabox/ui/lib/utils"
import { ChevronDown } from "lucide-react"

type ResponsiveOperationsCardProps = {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
  className?: string
  contentClassName?: string
}

export function ResponsiveOperationsCard({
  title,
  defaultOpen = false,
  children,
  className,
  contentClassName,
}: ResponsiveOperationsCardProps) {
  const [open, setOpen] = React.useState(defaultOpen)
  const contentId = React.useId()

  return (
    <Card className={cn("overflow-hidden py-0 md:py-6", className)}>
      <CardHeader className="hidden md:flex">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <Button
        type="button"
        variant="ghost"
        className="flex h-auto w-full items-center justify-between gap-3 rounded-none px-6 py-4 text-left md:hidden"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="text-base font-semibold">{title}</span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </Button>
      <CardContent
        id={contentId}
        className={cn("pb-6 md:pb-0", contentClassName, !open && "hidden md:grid")}
      >
        {children}
      </CardContent>
    </Card>
  )
}
