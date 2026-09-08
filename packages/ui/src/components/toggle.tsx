"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Toggle as TogglePrimitive } from "radix-ui"

import { cn } from "../lib/utils"
import { blurAfterPointerClick, neoFocus, neoPress } from "../lib/retro"

const toggleVariants = cva(
  `inline-flex items-center justify-center gap-2 rounded-base border-2 border-border bg-card text-sm font-heading whitespace-nowrap text-foreground ${neoFocus} disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[state=on]:bg-main data-[state=on]:text-main-foreground`,
  {
    variants: {
      variant: {
        default: neoPress,
        outline: neoPress,
      },
      size: {
        default: "h-9 min-w-9 px-2",
        sm: "h-8 min-w-8 px-1.5",
        lg: "h-10 min-w-10 px-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant,
  size,
  onPointerUp,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
      onPointerUp={(event) => {
        onPointerUp?.(event)
        if (event.defaultPrevented) return
        blurAfterPointerClick(event)
      }}
    />
  )
}

export { Toggle, toggleVariants }
